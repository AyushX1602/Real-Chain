// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IDistributionHook.sol";

/**
 * @title PropertyToken
 * @notice ERC-20 token representing fractional ownership of a real estate property.
 *         Total supply is 100 tokens. Each token = 1% ownership.
 *
 * @dev Extends ERC20Votes (OpenZeppelin v5) to enable historical balance checkpointing.
 *      This fixes the dividend calculation vulnerability: instead of reading the live
 *      balance at claim time, RentalDistribution can call getPastVotes(user, epochTime)
 *      to get the user's EXACT balance at the moment rent was deposited.
 *
 *      Auto-delegation: When tokens are transferred to an address that has never
 *      delegated, the contract auto-delegates that address to itself. This ensures
 *      voting power (= balance) is always tracked without requiring users to
 *      manually call delegate().
 */
contract PropertyToken is ERC20Votes, Ownable {
    // Property metadata
    string public propertyName;
    string public propertyLocation;
    uint256 public propertyValueInr;
    address public distributionHook;
    address public immutable deployerAdmin;

    uint256 public constant TOTAL_TOKENS = 100 * 1e18; // 100 PROP tokens, 18 decimals

    event PropertyTokenized(
        string name,
        string location,
        uint256 valueInr,
        uint256 totalTokens
    );
    event DistributionHookUpdated(address indexed oldHook, address indexed newHook);

    constructor(
        string memory _propertyName,
        string memory _location,
        uint256 _propertyValueInr,
        address initialOwner
    )
        ERC20("PropertyToken", "PROP")
        EIP712("PropertyToken", "1")
        Ownable(initialOwner)
    {
        deployerAdmin = msg.sender;
        propertyName = _propertyName;
        propertyLocation = _location;
        propertyValueInr = _propertyValueInr;

        _mint(initialOwner, TOTAL_TOKENS);
        // Auto-delegate owner to themselves so their voting power is tracked from genesis
        _delegate(initialOwner, initialOwner);

        emit PropertyTokenized(_propertyName, _location, _propertyValueInr, TOTAL_TOKENS);
    }

    /**
     * @notice Sets an optional distribution hook contract for transfer-time accounting.
     * @dev Keeping this unset preserves legacy behavior used by RentalDistribution v1.
     */
    function setDistributionHook(address hook) external {
        bool isOwnerCall = (msg.sender == owner());
        bool isOneTimeDeployerSetup = (
            msg.sender == deployerAdmin &&
            deployerAdmin != owner() &&
            distributionHook == address(0)
        );
        require(isOwnerCall || isOneTimeDeployerSetup, "Not authorized");

        emit DistributionHookUpdated(distributionHook, hook);
        distributionHook = hook;
    }

    /**
     * @dev Override _update to auto-delegate any token recipient to themselves
     *      the first time they receive tokens. This ensures getPastVotes() always
     *      returns correct historical balances without requiring manual delegation.
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20Votes)
    {
        address hook = distributionHook;
        if (hook != address(0) && from != to) {
            IDistributionHook(hook).onBeforeTokenTransfer(from, to);
        }

        super._update(from, to, value);

        if (hook != address(0) && from != to) {
            IDistributionHook(hook).onAfterTokenTransfer(from, to);
        }

        // After the transfer, if recipient has never set a delegate, self-delegate
        if (to != address(0) && delegates(to) == address(0)) {
            _delegate(to, to);
        }
    }

    /**
     * @notice Use timestamp-based clock so epoch timestamps in RentalDistribution
     *         can be used directly with getPastVotes().
     */
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    /// @notice ERC-6372 clock mode declaration
    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    /**
     * @notice Returns the token balance as a percentage of total supply (0–100)
     */
    function ownershipPercent(address account) external view returns (uint256) {
        return (balanceOf(account) * 100) / totalSupply();
    }
}
