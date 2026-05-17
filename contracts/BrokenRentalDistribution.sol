// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PropertyToken.sol";

/**
 * @title BrokenRentalDistribution
 * @notice INTENTIONALLY VULNERABLE dividend contract.
 *         Used ONLY for research — to demonstrate the snapshot timing attack.
 *
 * THE BUG: dividend share is calculated using the user's LIVE balance at
 * claim time, not their historical balance at the time rent was deposited.
 *
 * This allows two attacks:
 *  1. Buy tokens AFTER deposit → claim unearned dividends (theft)
 *  2. Sell tokens BEFORE claiming → lose earned dividends (victim gets nothing)
 *
 * Compare this with RentalDistribution.sol which uses getPastVotes() to fix both.
 */
contract BrokenRentalDistribution is Ownable {
    PropertyToken public immutable propertyToken;
    IERC20 public immutable usdc;

    struct Epoch {
        uint256 totalAmount;           // USDC deposited
        uint256 totalSupplyAtDeposit;  // total token supply snapshot (but NOT per-user)
        uint256 timestamp;
    }

    Epoch[] public epochs;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event RentalDeposited(uint256 indexed epochIndex, uint256 amount);
    event DividendClaimed(address indexed user, uint256 amount);

    constructor(address _propertyToken, address _usdc, address initialOwner)
        Ownable(initialOwner)
    {
        propertyToken = PropertyToken(_propertyToken);
        usdc = IERC20(_usdc);
    }

    function depositRental(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        usdc.transferFrom(msg.sender, address(this), amount);
        epochs.push(Epoch({
            totalAmount: amount,
            totalSupplyAtDeposit: propertyToken.totalSupply(), // only total supply — NOT user balances
            timestamp: block.timestamp
        }));
        emit RentalDeposited(epochs.length - 1, amount);
    }

    /**
     * @notice VULNERABLE: reads LIVE balance, not historical.
     *         Attacker who buys tokens after deposit appears as a legitimate holder.
     */
    function pendingDividends(address user) external view returns (uint256 total) {
        uint256 userBalance = propertyToken.balanceOf(user); // ← BUG: live balance
        for (uint256 i = 0; i < epochs.length; i++) {
            if (!claimed[i][user] && epochs[i].totalSupplyAtDeposit > 0) {
                total += (userBalance * epochs[i].totalAmount) / epochs[i].totalSupplyAtDeposit;
            }
        }
    }

    function claimAll() external {
        uint256 userBalance = propertyToken.balanceOf(msg.sender); // ← BUG: live balance
        require(userBalance > 0, "No tokens held");

        uint256 totalPayout = 0;
        for (uint256 i = 0; i < epochs.length; i++) {
            if (!claimed[i][msg.sender] && epochs[i].totalSupplyAtDeposit > 0) {
                claimed[i][msg.sender] = true;
                totalPayout += (userBalance * epochs[i].totalAmount) / epochs[i].totalSupplyAtDeposit;
            }
        }
        require(totalPayout > 0, "Nothing to claim");
        usdc.transfer(msg.sender, totalPayout);
        emit DividendClaimed(msg.sender, totalPayout);
    }

    function epochCount() external view returns (uint256) {
        return epochs.length;
    }
}
