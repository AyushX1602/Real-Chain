// ─────────────────────────────────────────────────────────────────────────────
// contracts.js — Contract addresses and ABIs
//
// After running `npx hardhat run scripts/deploy.js --network <network>`,
// either paste the printed addresses below OR set the matching env vars in
// `.env` and they will override the hardcoded fallbacks.
//
// Vite env vars (must be prefixed VITE_ to reach the browser):
//   VITE_NETWORK_MODE              "local" | "baseSepolia"   default "baseSepolia"
//   VITE_BASE_SEPOLIA_RPC_URL      Base Sepolia RPC URL       default https://sepolia.base.org
//   VITE_BACKEND_URL               Express backend            default http://localhost:5000
//   VITE_ETH_USD_RATE              ETH price (USD) for cost banner   default 2000
//   VITE_MOCK_USDC_ADDRESS         override deployed USDC     default localhost address
//   VITE_PROPERTY_FACTORY_ADDRESS  override deployed factory  default localhost address
// ─────────────────────────────────────────────────────────────────────────────

// ─── RPC URLs (for read-only browsing without MetaMask) ──────────────────────
export const LOCAL_RPC_URL        = "http://127.0.0.1:8545";   // Local Hardhat node
export const SEPOLIA_RPC_URL      = "https://rpc.sepolia.org"; // Public Sepolia RPC
export const BASE_SEPOLIA_RPC_URL = import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

// ─── Network mode toggle (Vite env-driven) ───────────────────────────────────
// Defaults to baseSepolia for the hackathon submission. Set
// VITE_NETWORK_MODE=local for offline Hardhat development.
const _MODE = (import.meta.env.VITE_NETWORK_MODE || "baseSepolia").toLowerCase();
export const NETWORK_MODE     = _MODE === "local" ? "local" : "baseSepolia";
export const NETWORK_CHAIN_ID = NETWORK_MODE === "local" ? 31337 : 84532;

// ─── Backend (Express + MongoDB) ─────────────────────────────────────────────
export const BACKEND_URL   = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// ─── Cost-banner constants (used by Tier 2 / 5D) ─────────────────────────────
// Static ETH/USD rate is fine for testnet demos. Override via env if needed.
export const ETH_USD_RATE = Number(import.meta.env.VITE_ETH_USD_RATE) || 2000;

// ─── Deployed contract addresses ─────────────────────────────────────────────
// Localhost defaults preserved so `VITE_NETWORK_MODE=local` still works without
// any env config. After running `npm run deploy:base`, either paste the new
// addresses here OR set the env vars in `.env`.
export const CONTRACT_ADDRESSES = {
  mockUsdc:        import.meta.env.VITE_MOCK_USDC_ADDRESS        || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  propertyFactory: import.meta.env.VITE_PROPERTY_FACTORY_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
};

// ─── MockUSDC ABI ────────────────────────────────────────────────────────────
export const MOCK_USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// ─── PropertyFactory ABI ─────────────────────────────────────────────────────
export const PROPERTY_FACTORY_ABI = [
  "function createProperty(string,string,uint256,uint256) external",
  "function createPropertyWithMode(string,string,uint256,uint256,bool) external",
  "function getPropertiesCount() view returns (uint256)",
  "function properties(uint256) view returns (string name,string location,uint256 valueInr,address propertyToken,address rentalDistribution,address marketplace,address owner)",
  "event PropertyCreated(uint256 indexed propertyId,string name,address propertyToken,address rentalDistribution,address marketplace,address owner)",
];

// ─── PropertyToken ABI ───────────────────────────────────────────────────────
export const PROPERTY_TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function ownershipPercent(address) view returns (uint256)",
  "function propertyName() view returns (string)",
  "function propertyLocation() view returns (string)",
  "function propertyValueInr() view returns (uint256)",
  "function delegates(address) view returns (address)",
  "function getPastVotes(address,uint256) view returns (uint256)",
];

// ─── RentalDistribution ABI ──────────────────────────────────────────────────
export const RENTAL_DISTRIBUTION_ABI = [
  "function depositRental(uint256) external",
  "function claimAll() external",
  "function claimEpoch(uint256) external",
  "function pendingDividends(address) view returns (uint256)",
  "function epochCount() view returns (uint256)",
  "function getEpoch(uint256) view returns (uint256 totalAmount,uint256 snapshotTime,uint256 timestamp)",
  "function claimed(uint256,address) view returns (bool)",
  "event RentalDeposited(uint256 indexed epochIndex,uint256 amount,uint256 timestamp)",
  "event AllDividendsClaimed(address indexed user,uint256 totalAmount,uint256 epochCount)",
];

// ─── Marketplace ABI ─────────────────────────────────────────────────────────
export const MARKETPLACE_ABI = [
  "function buyFromOwner(uint256) external",
  "function createListing(uint256,uint256) external returns (uint256)",
  "function buyFromListing(uint256) external",
  "function cancelListing(uint256) external",
  "function getListingCount() view returns (uint256)",
  "function getListing(uint256) view returns (address seller,uint256 amount,uint256 price,bool active)",
  "function pricePerToken() view returns (uint256)",
  "function setPricePerToken(uint256) external",
  "event ListingCreated(uint256 indexed listingId,address indexed seller,uint256 amount,uint256 pricePerToken)",
  "event ListingCancelled(uint256 indexed listingId,address indexed seller)",
  "event TokensBought(address indexed buyer,address indexed seller,uint256 tokenAmount,uint256 usdcCost)",
];
