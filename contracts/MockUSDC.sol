// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice Simulated USDC stablecoin for local and testnet use.
 *         Uses 6 decimals to match production USDC.
 *         The owner can mint tokens freely to fund test participants.
 */
contract MockUSDC is ERC20, Ownable {
    constructor(address initialOwner)
        ERC20("USD Coin", "USDC")
        Ownable(initialOwner)
    {
        // Pre-mint 10 million USDC to the deployer for distribution
        _mint(initialOwner, 10_000_000 * 1e6);
    }

    /// @notice USDC uses 6 decimal places, not 18
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint USDC to any address (owner only — for test setup)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
