// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PropertyToken.sol";
import "./RentalDistribution.sol";
import "./RentalDistributionV2Deployer.sol";
import "./Marketplace.sol";

/**
 * @title PropertyFactory
 * @notice On-chain registry that deploys a full property suite
 *         (PropertyToken + RentalDistribution + Marketplace) in a single transaction.
 *
 * @dev The USDC token address is set once at factory deployment and shared across
 *      all properties. This ensures all economic flows (rent, trades) use the same
 *      stablecoin, making yields comparable across epochs and properties.
 */
contract PropertyFactory {
    error InvalidUsdcAddress();

    address public immutable usdcToken;
    address private immutable v2Deployer;

    struct Property {
        string name;
        string location;
        uint256 valueInr;
        address propertyToken;
        address rentalDistribution;
        address marketplace;
        address owner;
    }

    Property[] public properties;

    event PropertyCreated(
        uint256 indexed propertyId,
        string name,
        address propertyToken,
        address rentalDistribution,
        address marketplace,
        address owner
    );

    constructor(address _usdcToken) {
        if (_usdcToken == address(0)) revert InvalidUsdcAddress();
        usdcToken = _usdcToken;
        v2Deployer = address(new RentalDistributionV2Deployer());
    }

    /**
     * @notice Deploy a new tokenized property.
     * @param _name          Human-readable property name
     * @param _location      Physical location string
     * @param _valueInr      Property valuation in INR paise (for metadata)
     * @param _pricePerToken Initial primary-sale price (USDC, 6 decimals, per full token)
     */
    function createProperty(
        string memory _name,
        string memory _location,
        uint256 _valueInr,
        uint256 _pricePerToken
    ) external {
        createPropertyWithMode(_name, _location, _valueInr, _pricePerToken, false);
    }

    /**
     * @notice Deploy a new tokenized property with selectable distribution mode.
     * @param useV2 If true, deploys RentalDistributionV2 (constant-time claim path).
     *              If false, deploys RentalDistribution (epoch loop path).
     */
    function createPropertyWithMode(
        string memory _name,
        string memory _location,
        uint256 _valueInr,
        uint256 _pricePerToken,
        bool useV2
    ) public {
        // 1. Deploy PropertyToken (ERC20Votes) — all 100 tokens go to caller
        PropertyToken pt = new PropertyToken(_name, _location, _valueInr, msg.sender);

        address rdAddr;

        if (useV2) {
            // 2a. Deploy RentalDistributionV2 through helper and enable token hook
            address rd2Addr = RentalDistributionV2Deployer(v2Deployer).deploy(
                address(pt),
                usdcToken,
                msg.sender
            );
            pt.setDistributionHook(rd2Addr);
            rdAddr = rd2Addr;
        } else {
            // 2b. Deploy legacy RentalDistribution (V1)
            RentalDistribution rd1 = new RentalDistribution(
                address(pt),
                usdcToken,
                msg.sender
            );
            rdAddr = address(rd1);
        }

        // 3. Deploy Marketplace — USDC-based, owned by caller
        Marketplace mp = new Marketplace(
            address(pt),
            usdcToken,
            _pricePerToken,
            msg.sender
        );

        uint256 id = properties.length;
        properties.push(Property({
            name: _name,
            location: _location,
            valueInr: _valueInr,
            propertyToken: address(pt),
            rentalDistribution: rdAddr,
            marketplace: address(mp),
            owner: msg.sender
        }));

        emit PropertyCreated(id, _name, address(pt), rdAddr, address(mp), msg.sender);
    }

    function getPropertiesCount() external view returns (uint256) {
        return properties.length;
    }
}
