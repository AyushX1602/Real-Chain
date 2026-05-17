// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PropertyToken.sol";
import "./IDistributionHook.sol";

/**
 * @title RentalDistributionV2
 * @notice Constant-time dividend claims using a cumulative reward index.
 *
 * Core idea:
 *  - On each rent deposit, update a global accumulator: accRewardPerToken
 *  - Each user stores rewardDebt and pendingRewards
 *  - claimAll() is O(1): no epoch loop
 *
 * Fairness preservation requirement:
 *  - PropertyToken calls this contract before/after every balance update
 *  - This locks in pre-transfer rewards to the seller and prevents
 *    post-deposit buyers from claiming old rewards.
 */
contract RentalDistributionV2 is Ownable, ReentrancyGuard, IDistributionHook {
    using SafeERC20 for IERC20;

    uint256 public constant PRECISION = 1e24;

    PropertyToken public immutable propertyToken;
    IERC20 public immutable usdc;

    struct EpochMeta {
        uint256 totalAmount;
        uint256 timestamp;
    }

    EpochMeta[] public epochs;

    // Global cumulative rewards per token unit (scaled by PRECISION)
    uint256 public accRewardPerToken;

    // Accounting state
    uint256 public totalDeposited;
    uint256 public totalClaimed;
    uint256 public totalDust;

    // User state
    mapping(address => uint256) public rewardDebt;
    mapping(address => uint256) public pendingRewards;
    // Compatibility marker for UI/indexers expecting per-epoch claimed checks.
    // In V2 we aggregate all pending rewards, so this stores a boundary index.
    mapping(address => uint256) public claimedThrough;

    event RentalDeposited(
        uint256 amount,
        uint256 distributed,
        uint256 dust,
        uint256 newAccRewardPerToken
    );
    event DividendsClaimed(address indexed user, uint256 amount);

    modifier onlyPropertyToken() {
        require(msg.sender == address(propertyToken), "Only property token");
        _;
    }

    constructor(address _propertyToken, address _usdc, address initialOwner)
        Ownable(initialOwner)
    {
        require(_propertyToken != address(0), "Property token required");
        require(_usdc != address(0), "USDC required");
        propertyToken = PropertyToken(_propertyToken);
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Deposit rental income and update cumulative reward index.
     * @dev O(1) regardless of number of past deposits.
     */
    function depositRental(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        epochs.push(EpochMeta({
            totalAmount: amount,
            timestamp: block.timestamp
        }));

        uint256 supply = propertyToken.totalSupply();
        if (supply == 0) {
            totalDust += amount;
            emit RentalDeposited(amount, 0, amount, accRewardPerToken);
            return;
        }

        uint256 increment = (amount * PRECISION) / supply;
        if (increment == 0) {
            // Amount too small to distribute at current precision
            totalDust += amount;
            emit RentalDeposited(amount, 0, amount, accRewardPerToken);
            return;
        }

        accRewardPerToken += increment;

        uint256 distributed = (increment * supply) / PRECISION;
        uint256 dust = amount - distributed;
        if (dust > 0) {
            totalDust += dust;
        }

        emit RentalDeposited(amount, distributed, dust, accRewardPerToken);
    }

    /**
     * @notice Claims all currently accrued rewards for msg.sender.
     * @dev O(1): no epoch iteration.
     */
    function claimAll() external nonReentrant {
        _claimFor(msg.sender);
    }

    /**
     * @notice Alias for claimAll for API ergonomics.
     */
    function claim() external nonReentrant {
        _claimFor(msg.sender);
    }

    /**
     * @notice Compatibility alias for UIs that expect epoch-specific claiming.
     * @dev V2 settles all pending rewards in O(1), so this calls the same path as claimAll.
     */
    function claimEpoch(uint256 epochIndex) external nonReentrant {
        require(epochIndex < epochs.length, "Invalid epoch");
        require(epochIndex >= claimedThrough[msg.sender], "Already claimed");
        _claimFor(msg.sender);
    }

    /**
     * @notice Returns total currently claimable dividends for a user.
     * @dev O(1) view computation.
     */
    function pendingDividends(address user) external view returns (uint256) {
        return _pendingView(user);
    }

    function epochCount() external view returns (uint256) {
        return epochs.length;
    }

    function getEpoch(uint256 index)
        external
        view
        returns (uint256 totalAmount, uint256 snapshotTime, uint256 timestamp)
    {
        EpochMeta storage e = epochs[index];
        // snapshotTime is not used by the index model; keep ABI-compatible return shape.
        return (e.totalAmount, 0, e.timestamp);
    }

    function claimed(uint256 epochIndex, address user) external view returns (bool) {
        return epochIndex < claimedThrough[user];
    }

    /**
     * @notice Manual sync helper for diagnostics and external tooling.
     */
    function syncAccount(address user) external {
        _accrue(user);
    }

    /**
     * @notice Token hook: sync users on balances BEFORE transfer/mint/burn update.
     */
    function onBeforeTokenTransfer(address from, address to) external onlyPropertyToken {
        if (from == to) return;

        _accrue(from);
        _accrue(to);
    }

    /**
     * @notice Token hook: reset reward debt to post-transfer balances.
     */
    function onAfterTokenTransfer(address from, address to) external onlyPropertyToken {
        if (from == to) return;

        if (from != address(0)) {
            rewardDebt[from] = _cumulativeFor(from);
        }
        if (to != address(0)) {
            rewardDebt[to] = _cumulativeFor(to);
        }
    }

    /**
     * @notice Returns accounting decomposition for paper assertions.
     * @dev target equation: totalDeposited = totalClaimed + unclaimed + dust
     */
    function accountingState()
        external
        view
        returns (uint256 deposited, uint256 claimedAmount, uint256 unclaimed, uint256 dust)
    {
        deposited = totalDeposited;
        claimedAmount = totalClaimed;
        dust = totalDust;

        uint256 bal = usdc.balanceOf(address(this));
        unclaimed = bal >= dust ? (bal - dust) : 0;
    }

    function _pendingView(address user) internal view returns (uint256) {
        if (user == address(0)) return 0;

        uint256 cumulative = _cumulativeFor(user);
        uint256 debt = rewardDebt[user];
        uint256 pending = pendingRewards[user];

        if (cumulative > debt) {
            pending += (cumulative - debt);
        }

        return pending;
    }

    function _accrue(address user) internal {
        if (user == address(0)) return;

        uint256 cumulative = _cumulativeFor(user);
        uint256 debt = rewardDebt[user];

        if (cumulative > debt) {
            pendingRewards[user] += (cumulative - debt);
        }

        rewardDebt[user] = cumulative;
    }

    function _claimFor(address user) internal {
        _accrue(user);

        uint256 payout = pendingRewards[user];
        require(payout > 0, "Nothing to claim");

        pendingRewards[user] = 0;
        claimedThrough[user] = epochs.length;
        totalClaimed += payout;

        usdc.safeTransfer(user, payout);
        emit DividendsClaimed(user, payout);
    }

    function _cumulativeFor(address user) internal view returns (uint256) {
        uint256 bal = propertyToken.balanceOf(user);
        return (bal * accRewardPerToken) / PRECISION;
    }
}
