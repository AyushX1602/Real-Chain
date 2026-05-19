// scripts/mintUsdc.js
// Usage: npx hardhat run scripts/mintUsdc.js --network localhost
//
// Mints 10,000 MockUSDC to every Hardhat test account (and your MetaMask wallet
// if you set TARGET_WALLET in the environment or pass it below).
//
// Override the target wallet:
//   TARGET_WALLET=0xYourAddress npx hardhat run scripts/mintUsdc.js --network localhost

const { ethers } = require("hardhat");
const addresses = require("../deployed-addresses.json");

const MOCK_USDC_ABI = [
  "function mint(address,uint256) external",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
];

const MINT_AMOUNT = 10_000n * 10n ** 6n; // 10,000 USDC (6 decimals)

async function main() {
  const [deployer] = await ethers.getSigners();
  const usdc = new ethers.Contract(addresses.mockUsdc, MOCK_USDC_ABI, deployer);
  const symbol = await usdc.symbol();

  console.log(`\nMocking ${symbol} at ${addresses.mockUsdc}`);
  console.log(`Minting ${Number(MINT_AMOUNT) / 1e6} ${symbol} per wallet\n`);

  // All 20 Hardhat test accounts
  const signers = await ethers.getSigners();
  const targets = signers.map((s) => s.address);

  // Also mint to TARGET_WALLET if set (your MetaMask address)
  const extra = process.env.TARGET_WALLET;
  if (extra && ethers.isAddress(extra) && !targets.includes(extra)) {
    targets.push(extra);
    console.log(`  + Extra target: ${extra}`);
  }

  for (const addr of targets) {
    const before = await usdc.balanceOf(addr);
    const tx = await usdc.mint(addr, MINT_AMOUNT);
    await tx.wait();
    const after = await usdc.balanceOf(addr);
    console.log(
      `  ✓ ${addr}  ${Number(before) / 1e6} → ${Number(after) / 1e6} ${symbol}`
    );
  }

  console.log("\nDone! Refresh the app to see updated balances.");
}

main().catch((e) => { console.error(e); process.exit(1); });
