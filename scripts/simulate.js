const hre = require("hardhat");
const { ethers } = hre;

// Helper: format USDC (6 decimals) to readable string
function usdcFmt(raw) {
  return `${(Number(raw) / 1e6).toFixed(2)} USDC`;
}

async function main() {
  const signers = await ethers.getSigners();
  const [owner, alice, bob, carol, dave, eve] = signers;

  // Optional mode switch: DISTRIBUTION_MODE=v1|v2 (default: v1)
  const mode = (process.env.DISTRIBUTION_MODE || "v1").toLowerCase();
  const useV2 = mode === "v2";

  const PRICE_PER_TOKEN = 10_000_000n; // 10 USDC per token

  console.log("═".repeat(60));
  console.log("  REALCHAIN — MULTI-PROPERTY DEMO SIMULATION (USDC)");
  console.log("═".repeat(60));

  // ── Step 1: Deploy MockUSDC ───────────────────────────────────────────────
  console.log("\n▶ [1] Deploying MockUSDC...");
  const USDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await USDC.deploy(owner.address);
  await usdc.waitForDeployment();
  console.log("  MockUSDC:", await usdc.getAddress());

  // Distribute USDC to test participants (each gets 5,000 USDC)
  const PARTICIPANT_USDC = 5_000_000_000n; // 5000 USDC (6 decimals)
  for (const user of [alice, bob, carol, dave, eve]) {
    await usdc.mint(user.address, PARTICIPANT_USDC);
  }
  console.log("  Minted 5,000 USDC each to Alice, Bob, Carol, Dave, Eve ✓");

  // ── Step 2: Deploy Factory ────────────────────────────────────────────────
  console.log("\n▶ [2] Deploying PropertyFactory...");
  const Factory = await ethers.getContractFactory("PropertyFactory");
  const factory = await Factory.deploy(await usdc.getAddress());
  await factory.waitForDeployment();
  console.log(`  Distribution mode: ${useV2 ? "V2" : "V1"} ✓`);

  // ── Step 3: Create Property ───────────────────────────────────────────────
  console.log("\n▶ [3] Creating Property: Palm Heights (Mumbai)...");
  if (useV2) {
    await (await factory.createPropertyWithMode("Palm Heights", "Mumbai", 1_00_00_00_000n, PRICE_PER_TOKEN, true)).wait();
  } else {
    await (await factory.createProperty("Palm Heights", "Mumbai", 1_00_00_00_000n, PRICE_PER_TOKEN)).wait();
  }
  const p1 = await factory.properties(0);

  const pt = await ethers.getContractAt("PropertyToken", p1.propertyToken);
  const rd = await ethers.getContractAt("RentalDistribution", p1.rentalDistribution);
  const mp = await ethers.getContractAt("Marketplace", p1.marketplace);

  // Owner approves marketplace to sell tokens on their behalf
  await pt.approve(p1.marketplace, await pt.totalSupply());
  console.log("  Owner approved marketplace for all 100 PROP tokens ✓");

  // ── Step 4: Users buy tokens ──────────────────────────────────────────────
  console.log("\n▶ [4] Users buying tokens from primary market...");
  const buyers = [
    { user: alice, name: "Alice", amount: 20n },
    { user: bob,   name: "Bob",   amount: 15n },
    { user: carol, name: "Carol", amount: 25n },
    { user: dave,  name: "Dave",  amount: 10n },
    { user: eve,   name: "Eve",   amount: 10n },
  ];
  for (const { user, name, amount } of buyers) {
    const cost = amount * PRICE_PER_TOKEN;
    await usdc.connect(user).approve(p1.marketplace, cost);
    await mp.connect(user).buyFromOwner(amount);
    console.log(`  ${name} bought ${amount} PROP tokens (cost: ${usdcFmt(cost)}) ✓`);
  }

  // ── Step 5: Deposit rental income ─────────────────────────────────────────
  console.log("\n▶ [5] Depositing 2 months of rental income (500 USDC each)...");
  // Advance time by 1 second so snapshot timestamp changes
  await hre.network.provider.send("evm_increaseTime", [1]);
  await hre.network.provider.send("evm_mine");

  const RENT = 500_000_000n; // 500 USDC
  await usdc.approve(p1.rentalDistribution, RENT * 2n);
  await rd.depositRental(RENT);
  console.log(`  Month 1: ${usdcFmt(RENT)} deposited ✓`);

  await hre.network.provider.send("evm_increaseTime", [30 * 24 * 3600]); // +30 days
  await hre.network.provider.send("evm_mine");
  await rd.depositRental(RENT);
  console.log(`  Month 2: ${usdcFmt(RENT)} deposited ✓`);

  // ── Step 6: All users claim dividends ─────────────────────────────────────
  console.log("\n▶ [6] Users claiming dividends...");
  for (const { user, name } of buyers) {
    const pending = await rd.pendingDividends(user.address);
    await rd.connect(user).claimAll();
    console.log(`  ${name} claimed ${usdcFmt(pending)} ✓`);
  }

  // ── Step 7: Secondary market trade ────────────────────────────────────────
  console.log("\n▶ [7] Secondary market — Alice sells 5 tokens to Carol...");
  const LIST_PRICE = 12_000_000n; // 12 USDC per token (20% premium)
  await pt.connect(alice).approve(p1.marketplace, ethers.parseEther("5"));
  await mp.connect(alice).createListing(5, LIST_PRICE);

  const tradeCost = (5n * LIST_PRICE * BigInt(1e18)) / BigInt(1e18);
  await usdc.connect(carol).approve(p1.marketplace, tradeCost);
  await mp.connect(carol).buyFromListing(0);
  console.log(`  Trade executed: Carol paid ${usdcFmt(tradeCost)} ✓`);

  console.log("\n✅ Full simulation complete!\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
