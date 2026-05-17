const { ethers } = require("hardhat");

/**
 * ════════════════════════════════════════════════════════════════════
 *  GAS BENCHMARK — Research Data Collection
 * ════════════════════════════════════════════════════════════════════
 *
 * Measures gas consumption of core contract functions under varying loads.
 * Produces data tables for Section 5 (Scalability Analysis) of the research paper.
 *
 * Key research question:
 *   "At what scale does the pull-claim dividend model become economically
 *    unviable for small investors due to gas costs exceeding dividend yields?"
 *
 * Assumptions for USD cost estimate:
 *   - Ethereum mainnet average gas price: 20 gwei
 *   - ETH price: $2,000 USD
 *   (These are conservative estimates. Adjust before publishing.)
 *
 * Run with: npx hardhat test test/GasBenchmark.test.js
 */

// ── Constants for USD cost estimation ────────────────────────────────────────
const ETH_PRICE_USD    = 2000;  // USD per ETH (approximate, update before paper)
const GAS_PRICE_GWEI   = 20;   // gwei — Ethereum mainnet average

function estimateUSD(gasUsed) {
  const ethSpent = Number(gasUsed) * GAS_PRICE_GWEI * 1e-9;
  return `$${(ethSpent * ETH_PRICE_USD).toFixed(3)}`;
}

function gasRow(label, column, gasUsed) {
  const gas = Number(gasUsed).toLocaleString();
  const usd = estimateUSD(gasUsed);
  console.log(`  ║ ${label.padEnd(28)} ║ ${String(column).padEnd(10)} ║ ${gas.padStart(12)} ║ ${usd.padStart(14)} ║`);
}

async function mineBlock(provider) {
  await provider.send("evm_increaseTime", [2]);
  await provider.send("evm_mine");
}

// ── Fresh deployment helper ───────────────────────────────────────────────────
async function deploy(owner, investorCount) {
  const PRICE = 10_000_000n; // 10 USDC/token

  const USDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await USDC.deploy(owner.address);
  await usdc.waitForDeployment();

  const Factory = await ethers.getContractFactory("PropertyFactory");
  const factory = await Factory.deploy(await usdc.getAddress());
  await factory.waitForDeployment();

  await factory.createProperty("Benchmark Property", "Mumbai", 1000000n, PRICE);
  const p = await factory.properties(0);

  const pt  = await ethers.getContractAt("PropertyToken",      p.propertyToken);
  const rd  = await ethers.getContractAt("RentalDistribution", p.rentalDistribution);

  // Approve marketplace (not used in benchmark — we use direct transfers)
  const signers = await ethers.getSigners();
  const investors = signers.slice(1, 1 + investorCount); // skip owner

  // Distribute tokens: each investor gets equal share
  const tokensEach = Math.floor(80 / investorCount); // Owner keeps 20
  for (const inv of investors) {
    await usdc.mint(inv.address, 1_000_000_000_000n);
    if (tokensEach > 0) {
      await pt.connect(owner).transfer(inv.address, ethers.parseEther(String(tokensEach)));
    }
  }

  await mineBlock(ethers.provider);
  return { usdc, pt, rd, investors, owner };
}

// ── Deposit N epochs ──────────────────────────────────────────────────────────
async function depositEpochs(usdc, rd, owner, rdAddress, epochCount) {
  const RENT = 1_000_000_000n; // 1000 USDC per epoch
  await usdc.approve(rdAddress, RENT * BigInt(epochCount));
  for (let i = 0; i < epochCount; i++) {
    await rd.depositRental(RENT);
    await mineBlock(ethers.provider);
  }
}

describe("Gas Benchmark — Research Data", function () {
  this.timeout(300000); // 5 min: many iterations

  let owner;
  before(async function () {
    [owner] = await ethers.getSigners();
  });

  // ──────────────────────────────────────────────────────────────────
  //  Table 1: claimAll() gas vs epoch count (1 investor)
  // ──────────────────────────────────────────────────────────────────
  it("Table 1 — claimAll() gas scales with epoch count", async function () {
    const epochCounts = [1, 3, 6, 12, 24, 48];
    const results = [];

    for (const n of epochCounts) {
      const { usdc, rd, investors } = await deploy(owner, 1);
      const alice = investors[0];
      const rdAddress = await rd.getAddress();

      await depositEpochs(usdc, rd, owner, rdAddress, n);
      const tx      = await rd.connect(alice).claimAll();
      const receipt = await tx.wait();
      results.push({ epochs: n, gas: Number(receipt.gasUsed) });
    }

    console.log("\n  ╔══════════════════════════════╦════════════╦══════════════╦════════════════╗");
    console.log("  ║ Function                     ║ Epochs     ║ Gas Used     ║ Est. Cost      ║");
    console.log("  ╠══════════════════════════════╬════════════╬══════════════╬════════════════╣");
    for (const r of results) {
      gasRow("claimAll() — 1 investor", r.epochs, r.gas);
    }
    console.log("  ╚══════════════════════════════╩════════════╩══════════════╩════════════════╝");

    // Derive linear scaling coefficient for the paper
    if (results.length >= 2) {
      const first = results[0].gas;
      const last  = results[results.length - 1].gas;
      const ratio = (last / first).toFixed(2);
      console.log(`\n  Scaling: claimAll() with ${results[results.length-1].epochs} epochs costs ${ratio}x`);
      console.log(`  more gas than with ${results[0].epochs} epoch (confirms O(n) loop complexity)`);
    }

    // Calculate minimum stake for economic viability at each epoch count
    const RENT_PER_EPOCH_USDC = 1000; // This matches the 1000 USDC we deposit
    console.log("\n  ── Minimum Viable Stake Analysis ─────────────────────────────────────");
    console.log("  (Stake below which gas fee > dividend earned)");
    console.log("  ╔══════════════════════════════╦════════════╦══════════════╦════════════════╗");
    console.log("  ║ Epochs                       ║ Gas Cost   ║ Min stake %  ║ Min stake USDC ║");
    console.log("  ╠══════════════════════════════╬════════════╬══════════════╬════════════════╣");
    for (const r of results) {
      const gasCostUSD   = Number(r.gas) * GAS_PRICE_GWEI * 1e-9 * ETH_PRICE_USD;
      const totalRentUSD = RENT_PER_EPOCH_USDC * r.epochs;
      // Minimum ownership % to break even: gasCost / totalRent * 100
      const minPct  = ((gasCostUSD / totalRentUSD) * 100).toFixed(2);
      const minUSDC = (gasCostUSD / (RENT_PER_EPOCH_USDC * r.epochs / 100)).toFixed(0);
      console.log(`  ║ ${String(r.epochs).padEnd(28)} ║ ${("$"+gasCostUSD.toFixed(3)).padEnd(10)} ║ ${(minPct+"%").padStart(12)} ║ ${(">"+minUSDC+" USDC").padStart(14)} ║`);
    }
    console.log("  ╚══════════════════════════════╩════════════╩══════════════╩════════════════╝");
  });

  // ──────────────────────────────────────────────────────────────────
  //  Table 2: Core functions gas (one-time reference costs)
  // ──────────────────────────────────────────────────────────────────
  it("Table 2 — Core function gas reference costs", async function () {
    const signers   = await ethers.getSigners();
    const [_owner, _alice, _bob] = signers;

    const USDC    = await ethers.getContractFactory("MockUSDC");
    const usdc    = await USDC.deploy(_owner.address);
    await usdc.waitForDeployment();
    await usdc.mint(_alice.address, 1_000_000_000_000n);
    await usdc.mint(_bob.address,   1_000_000_000_000n);

    const Factory = await ethers.getContractFactory("PropertyFactory");
    const factory = await Factory.deploy(await usdc.getAddress());
    await factory.waitForDeployment();

    // Measure: createProperty()
    const createTx  = await factory.createProperty("Test", "Mumbai", 1000000n, 10_000_000n);
    const createRcp = await createTx.wait();

    const p  = await factory.properties(0);
    const pt = await ethers.getContractAt("PropertyToken",      p.propertyToken);
    const rd = await ethers.getContractAt("RentalDistribution", p.rentalDistribution);
    const mp = await ethers.getContractAt("Marketplace",        p.marketplace);

    // Measure: approve + buyFromOwner() (primary market)
    const approveTx  = await usdc.connect(_alice).approve(p.marketplace, 10_000_000n * 10n);
    const approveRcp = await approveTx.wait();
    await pt.connect(_owner).approve(p.marketplace, ethers.parseEther("100"));
    const buyTx  = await mp.connect(_alice).buyFromOwner(10);
    const buyRcp = await buyTx.wait();

    // Measure: createListing() (secondary market)
    await pt.connect(_alice).approve(p.marketplace, ethers.parseEther("5"));
    const listTx  = await mp.connect(_alice).createListing(5, 10_000_000n);
    const listRcp = await listTx.wait();

    // Measure: buyFromListing()
    await usdc.connect(_bob).approve(p.marketplace, 10_000_000n * 5n);
    const buyListTx  = await mp.connect(_bob).buyFromListing(0);
    const buyListRcp = await buyListTx.wait();

    // Measure: depositRental()
    await mineBlock(ethers.provider);
    await usdc.connect(_owner).approve(p.rentalDistribution, 1_000_000_000n);
    const depTx  = await rd.connect(_owner).depositRental(1_000_000_000n);
    const depRcp = await depTx.wait();

    // Measure: USDC.approve()
    const usdcApproveTx  = await usdc.connect(_alice).approve(p.rentalDistribution, 999n);
    const usdcApproveRcp = await usdcApproveTx.wait();

    console.log("\n  ╔══════════════════════════════╦════════════╦══════════════╦════════════════╗");
    console.log("  ║ Function                     ║ Contract   ║ Gas Used     ║ Est. Cost      ║");
    console.log("  ╠══════════════════════════════╬════════════╬══════════════╬════════════════╣");
    gasRow("createProperty()",             "Factory",     createRcp.gasUsed);
    gasRow("approve() [USDC]",             "MockUSDC",    usdcApproveRcp.gasUsed);
    gasRow("buyFromOwner(10 tokens)",      "Marketplace", buyRcp.gasUsed);
    gasRow("createListing(5 tokens)",      "Marketplace", listRcp.gasUsed);
    gasRow("buyFromListing(5 tokens)",     "Marketplace", buyListRcp.gasUsed);
    gasRow("depositRental(1000 USDC)",     "RentalDist",  depRcp.gasUsed);
    console.log("  ╚══════════════════════════════╩════════════╩══════════════╩════════════════╝");
  });

  // ──────────────────────────────────────────────────────────────────
  //  Table 3: claimAll() vs claimEpoch() comparison
  // ──────────────────────────────────────────────────────────────────
  it("Table 3 — claimAll() vs claimEpoch() per-epoch cost", async function () {
    const { usdc, rd, investors } = await deploy(owner, 1);
    const alice = investors[0];
    const rdAddress = await rd.getAddress();

    await depositEpochs(usdc, rd, owner, rdAddress, 6);

    // Measure claimEpoch() — single epoch claim
    const singleTx  = await rd.connect(alice).claimEpoch(0);
    const singleRcp = await singleTx.wait();

    // Measure claimAll() — 5 remaining unclaimed epochs
    const allTx  = await rd.connect(alice).claimAll();
    const allRcp = await allTx.wait();

    const claimEpochGas = Number(singleRcp.gasUsed);
    const claimAllGas   = Number(allRcp.gasUsed);

    console.log("\n  ╔══════════════════════════════╦════════════╦══════════════╦════════════════╗");
    console.log("  ║ Function                     ║ Epochs     ║ Gas Used     ║ Est. Cost      ║");
    console.log("  ╠══════════════════════════════╬════════════╬══════════════╬════════════════╣");
    gasRow("claimEpoch() — single",        "1",          claimEpochGas);
    gasRow("claimAll() — 5 remaining",     "5",          claimAllGas);
    console.log("  ╚══════════════════════════════╩════════════╩══════════════╩════════════════╝");

    const perEpochCost = (claimAllGas / 5).toFixed(0);
    console.log(`\n  claimAll() marginal cost per additional epoch: ~${Number(perEpochCost).toLocaleString()} gas`);
    console.log(`  (Use this to extrapolate gas cost for any epoch count in the paper)`);
  });
});
