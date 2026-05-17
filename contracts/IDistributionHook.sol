// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDistributionHook
 * @notice Optional hook interface used by PropertyToken to synchronize
 *         reward-accounting contracts before/after token balance changes.
 */
interface IDistributionHook {
    function onBeforeTokenTransfer(address from, address to) external;
    function onAfterTokenTransfer(address from, address to) external;
}
