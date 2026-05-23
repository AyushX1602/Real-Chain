// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PropertyToken.sol";

/**
 * @title RentalDistribution
 * @notice Accepts USDC as rental income and distributes it proportionally
 *         to PROP token holders based on their HISTORICAL balance at deposit time.
 *
 * @dev Fix for dividend calculation bug:
 *      The previous implementation read the LIVE balance of users at claim time,
 *      meaning someone could buy tokens AFTER a deposit and unfairly claim dividends,
 *      or someone could sell tokens and claim less than their fair share.
 *
 *      This version stores `block.timestamp - 1` as the snapshot query point for each
 *      epoch. When a user claims, we call propertyToken.getPastVotes(user, snapshotTime)
 *      which returns their EXACT balance at that historical moment.
 *
 * Distribution model (pull-based, epoch-based):
 *  - Owner deposits USDC → creates a new epoch with a historical snapshot reference
 *  - Each user can claim their share of each epoch exactly once
 *  - Share = (balanceAt(user, snapshotTime) / totalSupplyAt(snapshotTime)) * epochAmount
 */
contract RentalDistribution is Ownable, ReentrancyGuard {
    PropertyToken public immutable propertyToken;
    IERC20 public immutable usdc;

    struct Epoch {
        uint256 totalAmount;    // USDC deposited (6 decimals)
        uint48  snapshotTime;   // block.timestamp - 1 at deposit; used for getPastVotes
        uint256 timestamp;      // block.timestamp at deposit (human-readable)
    }

    Epoch[] public epochs;

    // epochIndex => user => claimed
    mapping(uint256 => mapping(address => bool)) public claimed;

    event RentalDeposited(uint256 indexed epochIndex, uint256 amount, uint256 timestamp);
    event DividendClaimed(address indexed user, uint256 indexed epochIndex, uint256 amount);
    event AllDividendsClaimed(address indexed user, uint256 totalAmount, uint256 epochCount);

    constructor(address _propertyToken, address _usdc, address initialOwner)
        Ownable(initialOwner)
    {
        propertyToken = PropertyToken(_propertyToken);
        usdc = IERC20(_usdc);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DEPOSIT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Deposit USDC as rental income. Creates a new distribution epoch.
     * @param amount USDC amount (6 decimals). Caller must approve this contract first.
     * @dev snapshotTime = block.timestamp - 1 so all users have their balances
     *      captured BEFORE this deposit transaction (preventing same-block manipulation).
     */
    function depositRental(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");

        usdc.transferFrom(msg.sender, address(this), amount);

        // Snapshot the second BEFORE this deposit so no same-block buy can claim
        uint48 snapshotTime = block.timestamp > 0
            ? uint48(block.timestamp - 1)
            : 0;

        uint256 epochIndex = epochs.length;
        epochs.push(Epoch({
            totalAmount: amount,
            snapshotTime: snapshotTime,
            timestamp: block.timestamp
        }));

        emit RentalDeposited(epochIndex, amount, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  VIEW
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Calculate pending USDC dividends across all unclaimed epochs.
     * @dev Uses historical balances via getPastVotes — immune to sell-after-claim.
     */
    function pendingDividends(address user) external view returns (uint256 total) {
        for (uint256 i = 0; i < epochs.length; i++) {
            if (!claimed[i][user]) {
                (uint256 userBalance, uint256 supply) = _historicalBalances(user, epochs[i].snapshotTime);
                if (supply > 0 && userBalance > 0) {
                    total += (userBalance * epochs[i].totalAmount) / supply;
                }
            }
        }
    }

    function epochCount() external view returns (uint256) {
        return epochs.length;
    }

    function getEpoch(uint256 index)
        external view
        returns (uint256 totalAmount, uint256 snapshotTime, uint256 timestamp)
    {
        Epoch storage e = epochs[index];
        return (e.totalAmount, e.snapshotTime, e.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CLAIM
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Claim USDC dividends for a single epoch.
     */
    function claimEpoch(uint256 epochIndex) external nonReentrant {
        require(epochIndex < epochs.length, "Invalid epoch");
        require(!claimed[epochIndex][msg.sender], "Already claimed");

        Epoch storage epoch = epochs[epochIndex];
        (uint256 userBalance, uint256 supply) = _historicalBalances(msg.sender, epoch.snapshotTime);
        require(userBalance > 0, "No historical balance for this epoch");
        require(supply > 0, "Zero supply snapshot");

        claimed[epochIndex][msg.sender] = true;

        uint256 share = (userBalance * epoch.totalAmount) / supply;
        require(share > 0, "Nothing to claim");

        usdc.transfer(msg.sender, share);
        emit DividendClaimed(msg.sender, epochIndex, share);
    }

    /**
     * @notice Claim USDC dividends for ALL unclaimed epochs in one transaction.
     */
    function claimAll() external nonReentrant {
        uint256 totalPayout = 0;
        uint256 epochsClaimed = 0;

        for (uint256 i = 0; i < epochs.length; i++) {
            if (!claimed[i][msg.sender]) {
                (uint256 userBalance, uint256 supply) = _historicalBalances(msg.sender, epochs[i].snapshotTime);
                if (supply > 0 && userBalance > 0) {
                    claimed[i][msg.sender] = true;
                    totalPayout += (userBalance * epochs[i].totalAmount) / supply;
                    epochsClaimed++;
                }
            }
        }

        require(totalPayout > 0, "Nothing to claim");
        usdc.transfer(msg.sender, totalPayout);

        emit AllDividendsClaimed(msg.sender, totalPayout, epochsClaimed);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  INTERNAL
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Fetch historical user balance and total supply at snapshotTime.
     *      Uses ERC20Votes.getPastVotes() which reflects the auto-delegated
     *      checkpoint balance recorded at that timestamp.
     */
    function _historicalBalances(address user, uint48 snapshotTime)
        internal view
        returns (uint256 userBalance, uint256 supply)
    {
        // snapshotTime = 0 means epoch was recorded at genesis (edge case)
        if (snapshotTime == 0) {
            return (propertyToken.balanceOf(user), propertyToken.totalSupply());
        }
        userBalance = propertyToken.getPastVotes(user, snapshotTime);
        supply = propertyToken.getPastTotalSupply(snapshotTime);
    }
}
