/* eslint-disable no-console */
/**
 * scripts/seedDemo.js — deterministic Base Sepolia demo state seeder.
 *
 * Goal: leave the demo investor wallet with PROP tokens, pending USDC rent,
 * and ETH = 0 so the 60-second hackathon pitch is reproducible.
 *
 * Run via:
 *   npm run seed:base
 *   # or
 *   npx hardhat run scripts/seedDemo.js --network baseSepolia
 *
 * Idempotent: a second run on the same chain detects the seeded state
 * (demo investor already holds >= 30 PROP and has pending dividends) and
 * skips the seed actions, only printing the wallet summary.
 *
 * Design ref: .kiro/specs/hackathon-zero-eth-claim/design.md (Tier 1 / Phase 1E)
 * Validates : requirements.md Requirement 2
 */

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
require("dotenv").config();

const { ethers } = hre;

// ─── Minimal ABIs (only the functions this script calls) ────────────────────
const MOCK_USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256) external",
  "function decimals() view returns (uint8)",
];

const FACTORY_ABI = [
  "function getPropertiesCount() view returns (uint256)",
  "function properties(uint256) view returns (string name,string location,uint256 valueInr,address propertyToken,address rentalDistribution,address marketplace,address owner)",
];

const PROPERTY_TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

const MARKETPLACE_ABI = [
  "function pricePerToken() view returns (uint256)",
  "function buyFromOwner(uint256) external",
];

const RENTAL_ABI = [
  "function depositRental(uint256) external",
  "function pendingDividends(address) view returns (uint256)",
];

// ─── Constants ───────────────────────────────────────────────────────────────
const TARGET_PROP_AMOUNT = 30n;                    // whole tokens demo investor will hold
const SEED_USDC_TO_INVESTOR = 1_000n * 1_000_000n; // 1,000 USDC (6 decimals)
const RENT_DEPOSIT_USDC     = 1_000n * 1_000_000n; // 1,000 USDC of rent
const ETH_PREFUND_INVESTOR  = ethers.parseEther("0.0008"); // ~enough for approve + buy on Base Sepolia

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtUsdc(raw) {
  return (Number(raw) / 1e6).toFixed(2);
}
function fmtProp(raw) {
  return Number(ethers.formatEther(raw)).toFixed(2);
}
function fmtEth(raw) {
  return Number(ethers.formatEther(raw)).toFixed(4);
}
function failFast(msg) {
  console.error(`\n❌ seedDemo failed: ${msg}\n`);
  process.exit(1);
}

async function main() {
  // ── 0. Sanity: read .env + deployed-addresses.json ────────────────────────
  const investorPk   = process.env.DEMO_INVESTOR_PRIVATE_KEY;
  const investorAddr = process.env.DEMO_INVESTOR_WALLET_ADDRESS;
  const dustAddr     = process.env.BASE_SEPOLIA_GAS_DUST_ADDRESS || "";

  if (!investorPk)   failFast("DEMO_INVESTOR_PRIVATE_KEY missing in .env");
  if (!investorAddr) failFast("DEMO_INVESTOR_WALLET_ADDRESS missing in .env");

  const addrFile = path.join(__dirname, "..", "deployed-addresses.json");
  if (!fs.existsSync(addrFile)) {
    failFast("deployed-addresses.json missing — run `npm run deploy:base` first");
  }
  const deployed = JSON.parse(fs.readFileSync(addrFile, "utf8"));
  if (!deployed.mockUsdc || !deployed.factory) {
    failFast("deployed-addresses.json missing mockUsdc or factory");
  }

  // ── 1. Build runners ──────────────────────────────────────────────────────
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  const investor = new ethers.Wallet(
    investorPk.startsWith("0x") ? investorPk : `0x${investorPk}`,
    deployer.provider
  );
  const investorWallet = await investor.getAddress();

  if (investorWallet.toLowerCase() !== investorAddr.toLowerCase()) {
    failFast(`DEMO_INVESTOR_WALLET_ADDRESS (${investorAddr}) does not match the address derived from DEMO_INVESTOR_PRIVATE_KEY (${investorWallet})`);
  }

  console.log(`\nNetwork:  ${hre.network.name} (chainId ${(await deployer.provider.getNetwork()).chainId})`);
  console.log(`Deployer: ${deployerAddr}`);
  console.log(`Investor: ${investorWallet}`);
  console.log(`USDC:     ${deployed.mockUsdc}`);
  console.log(`Factory:  ${deployed.factory}\n`);

  // ── 2. Resolve property #0 ────────────────────────────────────────────────
  const factory = new ethers.Contract(deployed.factory, FACTORY_ABI, deployer);
  const count = await factory.getPropertiesCount();
  if (count === 0n) {
    failFast("factory.getPropertiesCount() === 0 — no properties deployed");
  }
  const p0 = await factory.properties(0);
  const tokenAddr  = p0[3];
  const rentalAddr = p0[4];
  const marketAddr = p0[5];
  const ownerAddr  = p0[6];
  console.log(`Property #0:`);
  console.log(`  name:           ${p0[0]}`);
  console.log(`  propertyToken:  ${tokenAddr}`);
  console.log(`  rental:         ${rentalAddr}`);
  console.log(`  marketplace:    ${marketAddr}`);
  console.log(`  owner:          ${ownerAddr}\n`);

  if (ownerAddr.toLowerCase() !== deployerAddr.toLowerCase()) {
    console.warn(`⚠  Property #0 owner (${ownerAddr}) is not the deployer (${deployerAddr}).`);
    console.warn(`   Subsequent steps assume the deployer can approve PROP tokens for sale and deposit rent.`);
    console.warn(`   If this script fails, you need to run it from the property owner's key.`);
  }

  // ── 3. Bind contract handles for both signers ─────────────────────────────
  const usdcDeployer  = new ethers.Contract(deployed.mockUsdc, MOCK_USDC_ABI, deployer);
  const usdcInvestor  = new ethers.Contract(deployed.mockUsdc, MOCK_USDC_ABI, investor);
  const tokenDeployer = new ethers.Contract(tokenAddr,         PROPERTY_TOKEN_ABI, deployer);
  const tokenInvestor = new ethers.Contract(tokenAddr,         PROPERTY_TOKEN_ABI, investor); // read-only fine
  const market        = new ethers.Contract(marketAddr,        MARKETPLACE_ABI, deployer);
  const marketInvestor = new ethers.Contract(marketAddr,       MARKETPLACE_ABI, investor);
  const rental        = new ethers.Contract(rentalAddr,        RENTAL_ABI,      deployer);

  // ── 4. Idempotency check ──────────────────────────────────────────────────
  const propBalance = await tokenInvestor.balanceOf(investorWallet);
  const pending     = await rental.pendingDividends(investorWallet);
  const targetUnits = TARGET_PROP_AMOUNT * (10n ** 18n);

  if (propBalance >= targetUnits && pending > 0n) {
    console.log(`✓ Already seeded. Skipping seed steps (idempotency).\n`);
    await printSummary({
      investor, investorWallet, usdcInvestor, tokenInvestor, rental,
    });
    await maybeSweep({ investor, investorWallet, dustAddr });
    await mergeAddressesFile(addrFile, deployed, investorWallet, deployerAddr);
    return;
  }

  // ── 5. Read price up-front ────────────────────────────────────────────────
  const pricePerToken = await market.pricePerToken();
  const usdcCost = TARGET_PROP_AMOUNT * pricePerToken;
  console.log(`Price per PROP: ${fmtUsdc(pricePerToken)} USDC`);
  console.log(`Investor will buy ${TARGET_PROP_AMOUNT} PROP for ${fmtUsdc(usdcCost)} USDC\n`);

  // ── 6. Mint USDC to demo investor ─────────────────────────────────────────
  const investorUsdcBalance = await usdcDeployer.balanceOf(investorWallet);
  if (investorUsdcBalance < SEED_USDC_TO_INVESTOR) {
    console.log(`Step (a): minting ${fmtUsdc(SEED_USDC_TO_INVESTOR)} USDC to demo investor…`);
    const tx = await usdcDeployer.mint(investorWallet, SEED_USDC_TO_INVESTOR);
    await tx.wait();
    console.log(`         ✓ tx ${tx.hash}\n`);
  } else {
    console.log(`Step (a): demo investor already has ${fmtUsdc(investorUsdcBalance)} USDC, skipping mint\n`);
  }

  // ── 7. Pre-fund demo investor with a tiny amount of ETH for two txs ──────
  // The investor needs to sign approve() + buyFromOwner(). We sweep at the end.
  const investorEth = await deployer.provider.getBalance(investorWallet);
  if (investorEth < ETH_PREFUND_INVESTOR) {
    console.log(`Step (a'): pre-funding demo investor with ${fmtEth(ETH_PREFUND_INVESTOR)} ETH for gas…`);
    const tx = await deployer.sendTransaction({
      to: investorWallet,
      value: ETH_PREFUND_INVESTOR,
    });
    await tx.wait();
    console.log(`         ✓ tx ${tx.hash}\n`);
  } else {
    console.log(`Step (a'): demo investor already has ${fmtEth(investorEth)} ETH, skipping pre-fund\n`);
  }

  // ── 8. Owner (deployer) approves marketplace to spend PROP tokens ────────
  if (propBalance < targetUnits) {
    const ownerAllowance = await tokenDeployer.allowance(deployerAddr, marketAddr);
    if (ownerAllowance < targetUnits) {
      console.log(`Step (c): deployer approving marketplace for ${TARGET_PROP_AMOUNT} PROP…`);
      const tx = await tokenDeployer.approve(marketAddr, ethers.MaxUint256);
      await tx.wait();
      console.log(`         ✓ tx ${tx.hash}\n`);
    } else {
      console.log(`Step (c): deployer already approved marketplace for ${fmtProp(ownerAllowance)} PROP\n`);
    }

    // ── 9. Investor approves marketplace to spend USDC ─────────────────────
    const investorAllowance = await usdcInvestor.allowance(investorWallet, marketAddr);
    if (investorAllowance < usdcCost) {
      console.log(`Step (d): demo investor approving marketplace for ${fmtUsdc(usdcCost)} USDC…`);
      const tx = await usdcInvestor.approve(marketAddr, usdcCost);
      await tx.wait();
      console.log(`         ✓ tx ${tx.hash}\n`);
    } else {
      console.log(`Step (d): demo investor already approved marketplace for ${fmtUsdc(investorAllowance)} USDC\n`);
    }

    // ── 10. Investor buys from owner ───────────────────────────────────────
    console.log(`Step (e): demo investor buying ${TARGET_PROP_AMOUNT} PROP from owner…`);
    const tx = await marketInvestor.buyFromOwner(TARGET_PROP_AMOUNT);
    await tx.wait();
    console.log(`         ✓ tx ${tx.hash}\n`);
  } else {
    console.log(`Steps (c)–(e): demo investor already holds ${fmtProp(propBalance)} PROP, skipping buy\n`);
  }

  // ── 11. Deployer approves rental + deposits rent ──────────────────────────
  if (pending === 0n) {
    const rentalAllowance = await usdcDeployer.allowance(deployerAddr, rentalAddr);
    if (rentalAllowance < RENT_DEPOSIT_USDC) {
      console.log(`Step (f): deployer approving rentalDistribution for ${fmtUsdc(RENT_DEPOSIT_USDC)} USDC…`);
      const tx = await usdcDeployer.approve(rentalAddr, ethers.MaxUint256);
      await tx.wait();
      console.log(`         ✓ tx ${tx.hash}\n`);
    } else {
      console.log(`Step (f): deployer already approved rentalDistribution for ${fmtUsdc(rentalAllowance)} USDC\n`);
    }

    console.log(`Step (g): deployer depositing ${fmtUsdc(RENT_DEPOSIT_USDC)} USDC of rent…`);
    const tx = await rental.depositRental(RENT_DEPOSIT_USDC);
    await tx.wait();
    console.log(`         ✓ tx ${tx.hash}\n`);
  } else {
    console.log(`Steps (f)–(g): demo investor already has pending dividends ${fmtUsdc(pending)} USDC, skipping deposit\n`);
  }

  // ── 12. Print demo wallet summary ─────────────────────────────────────────
  await printSummary({
    investor, investorWallet, usdcInvestor, tokenInvestor, rental,
  });

  // ── 13. Optional sweep ────────────────────────────────────────────────────
  await maybeSweep({ investor, investorWallet, dustAddr });

  // ── 14. Append demoInvestor + demoOwner to deployed-addresses.json ───────
  await mergeAddressesFile(addrFile, deployed, investorWallet, deployerAddr);
}

async function printSummary({ investor, investorWallet, usdcInvestor, tokenInvestor, rental }) {
  const provider = investor.provider;
  const ethBal  = await provider.getBalance(investorWallet);
  const usdcBal = await usdcInvestor.balanceOf(investorWallet);
  const propBal = await tokenInvestor.balanceOf(investorWallet);
  const pending = await rental.pendingDividends(investorWallet);

  const lines = [
    `Address:      ${investorWallet}`,
    `ETH balance:  ${fmtEth(ethBal)}`,
    `USDC balance: ${fmtUsdc(usdcBal)}`,
    `PROP balance: ${fmtProp(propBal)}`,
    `Pending:      ${fmtUsdc(pending)} USDC`,
  ];

  console.log(`┌────── Demo investor wallet ─────────────────────────────────────┐`);
  for (const l of lines) {
    console.log(`│ ${l.padEnd(64)}│`);
  }
  console.log(`└─────────────────────────────────────────────────────────────────┘\n`);
}

async function maybeSweep({ investor, investorWallet, dustAddr }) {
  if (!dustAddr) {
    console.log(`ℹ BASE_SEPOLIA_GAS_DUST_ADDRESS not set — manual ETH sweep needed before demo.\n`);
    return;
  }
  if (!ethers.isAddress(dustAddr)) {
    console.log(`⚠ BASE_SEPOLIA_GAS_DUST_ADDRESS (${dustAddr}) is not a valid address — skipping sweep.\n`);
    return;
  }

  const provider = investor.provider;
  const balance  = await provider.getBalance(investorWallet);
  if (balance === 0n) {
    console.log(`✓ Demo investor already has 0 ETH, no sweep needed.\n`);
    return;
  }

  // Estimate gas for a simple transfer
  const fee     = await provider.getFeeData();
  const gasLimit = 21000n;
  const gasPrice = fee.gasPrice ?? fee.maxFeePerGas ?? 1n;
  const gasCost  = gasLimit * gasPrice * 12n / 10n; // 20% buffer

  if (balance <= gasCost) {
    console.log(`ℹ Demo investor has ${fmtEth(balance)} ETH which is ≤ estimated gas cost ${fmtEth(gasCost)} — leaving as is.\n`);
    return;
  }

  const value = balance - gasCost;
  console.log(`Sweeping ${fmtEth(value)} ETH from demo investor → ${dustAddr}…`);
  const tx = await investor.sendTransaction({
    to: dustAddr,
    value,
    gasLimit,
  });
  await tx.wait();
  console.log(`         ✓ tx ${tx.hash}\n`);

  const after = await provider.getBalance(investorWallet);
  console.log(`Demo investor ETH after sweep: ${fmtEth(after)}\n`);
}

async function mergeAddressesFile(addrFile, current, investorWallet, deployerAddr) {
  const merged = {
    ...current,
    demoInvestor: investorWallet,
    demoOwner: deployerAddr,
    seededAt: new Date().toISOString(),
  };
  fs.writeFileSync(addrFile, JSON.stringify(merged, null, 2) + "\n");
  console.log(`✓ deployed-addresses.json updated with demoInvestor + demoOwner.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
