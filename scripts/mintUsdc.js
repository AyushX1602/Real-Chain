// scripts/mintUsdc.js
// ─────────────────────────────────────────────────────────────────────────────
// Mints MockUSDC to the deployer wallet (and optionally to a TARGET_WALLET).
//
// Works on BOTH localhost AND Base Sepolia because the deployer private key
// in .env is the MockUSDC contract owner.
//
// Usage:
//   npx hardhat run scripts/mintUsdc.js --network baseSepolia
//   npx hardhat run scripts/mintUsdc.js --network localhost
//
// Mint to a specific wallet:
//   TARGET_WALLET=0xAddress npx hardhat run scripts/mintUsdc.js --network baseSepolia
//
// Mint a custom amount (default 50,000 USDC):
//   MINT_AMOUNT=100000 npx hardhat run scripts/mintUsdc.js --network baseSepolia
// ─────────────────────────────────────────────────────────────────────────────

const { ethers, network } = require("hardhat");

// Deployed MockUSDC address on Base Sepolia (from .env)
const BASE_SEPOLIA_USDC = process.env.VITE_MOCK_USDC_ADDRESS || "0xc90610277191F7Dbe7Ddf18319Bd28D3aAAe9a38";

// Fallback to deployed-addresses.json for localhost
let USDC_ADDRESS;
try {
  const deployed = require("../deployed-addresses.json");
  USDC_ADDRESS = deployed.mockUsdc;
} catch { USDC_ADDRESS = null; }

const MOCK_USDC_ABI = [
  "function mint(address,uint256) external",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function owner() view returns (address)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const isBaseSepolia = network.name === "baseSepolia" || network.config.chainId === 84532;

  // Pick the right USDC address
  const usdcAddr = isBaseSepolia ? BASE_SEPOLIA_USDC : USDC_ADDRESS;
  if (!usdcAddr) {
    console.error("❌ No MockUSDC address found. Set VITE_MOCK_USDC_ADDRESS in .env or deploy first.");
    process.exit(1);
  }

  const usdc = new ethers.Contract(usdcAddr, MOCK_USDC_ABI, deployer);
  const symbol = await usdc.symbol();
  const contractOwner = await usdc.owner();

  console.log(`\n🏦 MockUSDC (${symbol}) at ${usdcAddr}`);
  console.log(`   Network: ${network.name} (chain ${network.config.chainId})`);
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Contract owner: ${contractOwner}`);

  if (deployer.address.toLowerCase() !== contractOwner.toLowerCase()) {
    console.error(`\n❌ Your PRIVATE_KEY wallet (${deployer.address}) is NOT the MockUSDC owner (${contractOwner}).`);
    console.error("   Only the contract owner can mint. Use the deployer private key.\n");
    process.exit(1);
  }

  const mintAmount = BigInt(Math.floor(Number(process.env.MINT_AMOUNT || 50000))) * 10n ** 6n;
  const targets = [deployer.address];

  // Also mint to TARGET_WALLET if set
  const extra = process.env.TARGET_WALLET;
  if (extra && ethers.isAddress(extra) && extra.toLowerCase() !== deployer.address.toLowerCase()) {
    targets.push(extra);
  }

  // On localhost, also mint to all Hardhat accounts
  if (!isBaseSepolia) {
    const signers = await ethers.getSigners();
    for (const s of signers) {
      if (!targets.includes(s.address)) targets.push(s.address);
    }
  }

  console.log(`\n💰 Minting ${Number(mintAmount) / 1e6} ${symbol} to ${targets.length} wallet(s)...\n`);

  for (const addr of targets) {
    try {
      const before = await usdc.balanceOf(addr);
      const tx = await usdc.mint(addr, mintAmount);
      await tx.wait();
      const after = await usdc.balanceOf(addr);
      console.log(`  ✓ ${addr}  ${Number(before) / 1e6} → ${Number(after) / 1e6} ${symbol}`);
    } catch (e) {
      console.log(`  ✗ ${addr}  FAILED: ${e.reason || e.message}`);
    }
  }

  console.log("\n✅ Done! Refresh the app to see updated balances.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
