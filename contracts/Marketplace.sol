// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PropertyToken.sol";

/**
 * @title Marketplace
 * @notice Fixed-price marketplace for PROP tokens. Payments are made in USDC.
 *
 * Two trading modes:
 *  1. Primary sale: Owner sells tokens from their wallet at a set USDC price.
 *  2. Secondary listings: Any holder creates a sell listing; buyers fill it.
 *
 * Security improvements over v1:
 *  - ReentrancyGuard on all state-changing functions
 *  - USDC-based payments (no raw ETH sends, eliminating call-based reentrancy)
 *  - Checks-Effects-Interactions pattern enforced throughout
 */
contract Marketplace is Ownable, ReentrancyGuard {
    PropertyToken public immutable propertyToken;
    IERC20 public immutable usdc;

    /// @notice Price per 1 full PROP token in USDC (6 decimals). Set by owner.
    uint256 public pricePerToken;

    struct Listing {
        address seller;
        uint256 amount;  // in token units (1e18 = 1 full PROP token)
        uint256 price;   // USDC per full token (6 decimals) at listing time
        bool active;
    }

    Listing[] public listings;

    event TokensBought(
        address indexed buyer,
        address indexed seller,
        uint256 tokenAmount,
        uint256 usdcCost
    );
    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        uint256 amount,
        uint256 pricePerToken
    );
    event ListingCancelled(uint256 indexed listingId, address indexed seller);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);

    constructor(address _propertyToken, address _usdc, uint256 _pricePerToken, address initialOwner)
        Ownable(initialOwner)
    {
        propertyToken = PropertyToken(_propertyToken);
        usdc = IERC20(_usdc);
        pricePerToken = _pricePerToken;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  OWNER FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Update the primary sale price (USDC, 6 decimals)
    function setPricePerToken(uint256 _price) external onlyOwner {
        emit PriceUpdated(pricePerToken, _price);
        pricePerToken = _price;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PRIMARY MARKET
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Buy PROP tokens directly from the property owner (primary sale).
     * @param amount Number of full tokens (e.g. 5 = 5 PROP = 5e18 units)
     * @dev Buyer must first approve this contract to spend `amount * pricePerToken` USDC.
     *      Owner must have approved this contract to transfer their PROP tokens.
     */
    function buyFromOwner(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        uint256 tokenUnits = amount * 1e18;
        uint256 cost = amount * pricePerToken;

        address ownerAddr = owner();
        require(
            propertyToken.allowance(ownerAddr, address(this)) >= tokenUnits,
            "Owner must approve marketplace for tokens"
        );
        require(propertyToken.balanceOf(ownerAddr) >= tokenUnits, "Owner lacks tokens");

        // CEI: state check done; execute transfers
        // 1. Pull USDC from buyer
        usdc.transferFrom(msg.sender, ownerAddr, cost);
        // 2. Push tokens to buyer
        propertyToken.transferFrom(ownerAddr, msg.sender, tokenUnits);

        emit TokensBought(msg.sender, ownerAddr, amount, cost);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  SECONDARY MARKET
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a secondary market sell listing.
     * @param amount Number of full tokens to list
     * @param price USDC per full token (6 decimals)
     * @dev Seller must approve this contract for at least `amount * 1e18` PROP tokens.
     */
    function createListing(uint256 amount, uint256 price)
        external
        nonReentrant
        returns (uint256 listingId)
    {
        require(amount > 0, "Amount must be > 0");
        require(price > 0, "Price must be > 0");

        uint256 tokenUnits = amount * 1e18;
        require(propertyToken.balanceOf(msg.sender) >= tokenUnits, "Insufficient token balance");
        require(
            propertyToken.allowance(msg.sender, address(this)) >= tokenUnits,
            "Must approve marketplace before listing"
        );

        listingId = listings.length;
        listings.push(Listing({
            seller: msg.sender,
            amount: tokenUnits,
            price: price,
            active: true
        }));

        emit ListingCreated(listingId, msg.sender, amount, price);
    }

    /**
     * @notice Buy tokens from a secondary market listing.
     * @param listingId The ID of the listing to fill.
     * @dev Buyer must first approve USDC: `(listing.amount / 1e18) * listing.price`.
     */
    function buyFromListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller != msg.sender, "Cannot buy your own listing");

        uint256 cost = (listing.amount * listing.price) / 1e18;

        // CEI: mark inactive BEFORE external calls
        listing.active = false;

        // Transfer USDC from buyer to seller
        usdc.transferFrom(msg.sender, listing.seller, cost);
        // Transfer PROP tokens from seller to buyer
        propertyToken.transferFrom(listing.seller, msg.sender, listing.amount);

        emit TokensBought(msg.sender, listing.seller, listing.amount / 1e18, cost);
    }

    /**
     * @notice Cancel your own active listing.
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not your listing");
        require(listing.active, "Already inactive");

        listing.active = false;
        emit ListingCancelled(listingId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  VIEW
    // ─────────────────────────────────────────────────────────────────────────

    function getListingCount() external view returns (uint256) {
        return listings.length;
    }

    function getListing(uint256 id)
        external view
        returns (address seller, uint256 amount, uint256 price, bool active)
    {
        Listing storage l = listings[id];
        return (l.seller, l.amount, l.price, l.active);
    }
}
