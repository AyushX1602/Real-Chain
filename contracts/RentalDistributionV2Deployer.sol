// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RentalDistributionV2.sol";

/**
 * @title RentalDistributionV2Deployer
 * @notice Lightweight helper so PropertyFactory can support V2 without
 *         embedding V2 creation bytecode in its runtime (avoids code-size limit).
 */
contract RentalDistributionV2Deployer {
    address public immutable factory;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor() {
        factory = msg.sender;
    }

    function deploy(
        address propertyToken,
        address usdc,
        address propertyOwner
    ) external onlyFactory returns (address) {
        RentalDistributionV2 rd2 = new RentalDistributionV2(propertyToken, usdc, propertyOwner);
        return address(rd2);
    }
}
