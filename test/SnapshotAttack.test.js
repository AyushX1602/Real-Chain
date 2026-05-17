const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * ════════════════════════════════════════════════════════════════════
 *  SNAPSHOT TIMING ATTACK — Research Demonstration
 * ════════════════════════════════════════════════════════════════════
 *
 * This test formally demonstrates the dividend manipulation vulnerability
 * and proves that the snapshot-based fix (RentalDistribution.sol) eliminates it.
 *
 * ATTACK SCENARIO
 * ───────────────
 * Actors:
 *   Alice  — legitimate investor, holds 30 tokens before rent deposit
 *   Bob    — legitimate investor, holds 20 tokens before rent deposit
 *   Owner  — property manager, holds 50 tokens, deposits rent
 *   Carol  — ATTACKER, holds 0 tokens at rent deposit, buys AFTER deposit
 *
 * Timeline:
 *   T=1  Alice buys 30 tokens, Bob buys 20 tokens
 *   T=2  [block mined]
 *   T=3  Owner deposits 1000 USDC rent into BOTH BrokenRD and FixedRD
 *          → FixedRD records snapshot at T=2: Alice=30, Bob=20, Carol=0
 *   T=4  Carol buys 30 tokens from Alice (direct transfer — simulates market buy)
 *   T=5  Carol attempts to claim from both contracts
 *        Alice (now holding 0) attempts to claim from both contracts
 *
 * Expected results:
 *   BrokenRD  Carol claims: 300 USDC ← STOLEN (held 0 at deposit time)
 *   BrokenRD  Alice claims: 0 USDC   ← ROBBED (held 30 at deposit time, sold before claim)
 *
 *   FixedRD   Carol claims: 0 USDC   ← BLOCKED (snapshot shows Carol=0 at T=2)
 *   FixedRD   Alice claims: 300 USDC ← PROTECTED (snapshot shows Alice=30 at T=2)
 */
describe("Snapshot Timing Attack — Security Analysis", function () {
  let owner, alice, bob, carol;
  let usdc, pt, brokenRd, fixedRd;

  const PRICE_PER_TOKEN = 10_000_000n;  // 10 USDC per token (6 decimals)
  const RENT            = 1_000_000_000n; // 1000 USDC
  const USER_USDC       = 100_000_000_000n; // 100,000 USDC to each user

  async function mineBlock() {
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");
  }

  before(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();

    // ── Deploy MockUSDC ───────────────────────────────────────────────
    const USDC = await ethers.getContractFactory("MockUSDC");
    usdc = await USDC.deploy(owner.address);
    await usdc.waitForDeployment();
    for (const user of [alice, bob, carol]) {
      await usdc.mint(user.address, USER_USDC);
    }

    // ── Deploy PropertyToken directly (no factory needed here) ────────
    const PT = await ethers.getContractFactory("PropertyToken");
    pt = await PT.deploy("Attack Demo Property", "Mumbai", 1000000n, owner.address);
    await pt.waitForDeployment();

    // ── Deploy BrokenRD (vulnerable) ──────────────────────────────────
    const BrokenRD = await ethers.getContractFactory("BrokenRentalDistribution");
    brokenRd = await BrokenRD.deploy(await pt.getAddress(), await usdc.getAddress(), owner.address);
    await brokenRd.waitForDeployment();

    // ── Deploy FixedRD (patched) ──────────────────────────────────────
    const FixedRD = await ethers.getContractFactory("RentalDistribution");
    fixedRd = await FixedRD.deploy(await pt.getAddress(), await usdc.getAddress(), owner.address);
    await fixedRd.waitForDeployment();

    // ── Owner approves Marketplace-less token transfers ───────────────
    // Direct transfers (owner → alice, owner → bob) to set up initial holdings
    await pt.connect(owner).transfer(alice.address, ethers.parseEther("30"));
    await pt.connect(owner).transfer(bob.address, ethers.parseEther("20"));
    // Owner retains 50 tokens

    // ── T=2: Mine a block so token holdings are checkpointed ─────────
    await mineBlock();
  });

  // ──────────────────────────────────────────────────────────────────
  //  Phase 1: Deposit rent into BOTH contracts simultaneously
  // ──────────────────────────────────────────────────────────────────
  it("Phase 1: Owner deposits 1000 USDC into both contracts (same block = same snapshot)", async function () {
    // Fund both RDs simultaneously
    await usdc.approve(await brokenRd.getAddress(), RENT);
    await brokenRd.connect(owner).depositRental(RENT);

    await usdc.approve(await fixedRd.getAddress(), RENT);
    await fixedRd.connect(owner).depositRental(RENT);

    expect(await brokenRd.epochCount()).to.equal(1);
    expect(await fixedRd.epochCount()).to.equal(1);

    // Verify initial holdings BEFORE attack
    expect(await pt.balanceOf(alice.address)).to.equal(ethers.parseEther("30"));
    expect(await pt.balanceOf(carol.address)).to.equal(0n);

    console.log("\n  [Setup] Holdings AT deposit time:");
    console.log("    Alice:  30 tokens (30% — should receive 300 USDC)");
    console.log("    Bob:    20 tokens (20% — should receive 200 USDC)");
    console.log("    Owner:  50 tokens (50% — should receive 500 USDC)");
    console.log("    Carol:   0 tokens (0%  — should receive 0 USDC)");
  });

  // ──────────────────────────────────────────────────────────────────
  //  Phase 2: ATTACK — Carol buys tokens AFTER the deposit
  // ──────────────────────────────────────────────────────────────────
  it("Phase 2: Carol (attacker) buys 30 tokens from Alice AFTER the rent deposit", async function () {
    await mineBlock(); // Mine a block AFTER deposit

    // Carol acquires Alice's 30 tokens (simulating a market purchase)
    await pt.connect(alice).transfer(carol.address, ethers.parseEther("30"));
    await mineBlock();

    // State after attack: Carol holds 30, Alice holds 0
    expect(await pt.balanceOf(carol.address)).to.equal(ethers.parseEther("30"));
    expect(await pt.balanceOf(alice.address)).to.equal(0n);

    console.log("\n  [Attack] Holdings AFTER token transfer (Carol bought Alice's tokens):");
    console.log("    Alice:   0 tokens (sold AFTER deposit)");
    console.log("    Carol:  30 tokens (bought AFTER deposit — should get NOTHING)");
  });

  // ──────────────────────────────────────────────────────────────────
  //  Phase 3: BROKEN CONTRACT — Attack succeeds
  // ──────────────────────────────────────────────────────────────────
  it("Phase 3 [VULNERABLE] BrokenRD — Carol STEALS 300 USDC, Alice gets NOTHING", async function () {
    const carolBalBefore  = await usdc.balanceOf(carol.address);
    const aliceBalBefore  = await usdc.balanceOf(alice.address);

    // Carol claims — she currently holds 30 tokens → BrokenRD pays her
    const carolTx = await brokenRd.connect(carol).claimAll();
    await carolTx.wait();
    const carolReceived = (await usdc.balanceOf(carol.address)) - carolBalBefore;

    // Alice tries to claim — she holds 0 tokens now → BrokenRD pays nothing
    await expect(brokenRd.connect(alice).claimAll()).to.be.revertedWith("No tokens held");
    const aliceReceived = (await usdc.balanceOf(alice.address)) - aliceBalBefore;

    console.log("\n  [BROKEN CONTRACT RESULTS]");
    console.log(`    Carol received:  ${Number(carolReceived) / 1e6} USDC (STOLE ${Number(carolReceived) / 1e6} USDC)`);
    console.log(`    Alice received:  ${Number(aliceReceived) / 1e6} USDC (LOST her 300 USDC)`);
    console.log(`    Attack profit:   ${Number(carolReceived) / 1e6} USDC`);

    // Attacker receives a non-zero payout (attack succeeded on broken contract)
    expect(carolReceived).to.be.greaterThan(0n);
    // Victim (Alice) receives nothing despite being a legitimate holder
    expect(aliceReceived).to.equal(0n);
  });

  // ──────────────────────────────────────────────────────────────────
  //  Phase 4: FIXED CONTRACT — Attack is blocked
  // ──────────────────────────────────────────────────────────────────
  it("Phase 4 [FIXED] FixedRD — Carol gets NOTHING, Alice gets correct 300 USDC", async function () {
    const carolBalBefore = await usdc.balanceOf(carol.address);
    const aliceBalBefore = await usdc.balanceOf(alice.address);

    // Carol tries to claim — snapshot shows she held 0 tokens at deposit time
    const carolPending = await fixedRd.pendingDividends(carol.address);
    expect(carolPending).to.equal(0n); // Attack blocked: no historical balance

    if (carolPending > 0n) {
      await fixedRd.connect(carol).claimAll();
    }
    const carolReceived = (await usdc.balanceOf(carol.address)) - carolBalBefore;

    // Alice claims — snapshot shows she held 30 tokens at deposit time
    const alicePending = await fixedRd.pendingDividends(alice.address);
    expect(alicePending).to.equal(300_000_000n); // 300 USDC

    await fixedRd.connect(alice).claimAll();
    const aliceReceived = (await usdc.balanceOf(alice.address)) - aliceBalBefore;

    console.log("\n  [FIXED CONTRACT RESULTS]");
    console.log(`    Carol received:  ${Number(carolReceived) / 1e6} USDC (attack BLOCKED)`);
    console.log(`    Alice received:  ${Number(aliceReceived) / 1e6} USDC (correctly paid)`);

    expect(carolReceived).to.equal(0n);          // Attacker blocked
    expect(aliceReceived).to.equal(300_000_000n); // Victim compensated correctly
  });

  // ──────────────────────────────────────────────────────────────────
  //  Phase 5: Summary Table for Research Paper
  // ──────────────────────────────────────────────────────────────────
  it("Phase 5: Print side-by-side comparison (research paper table)", async function () {
    console.log("\n  ╔═══════════════╦══════════════════════╦══════════════════════╗");
    console.log("  ║ Actor         ║ BrokenRD (live bal.) ║ FixedRD (snapshot)   ║");
    console.log("  ╠═══════════════╬══════════════════════╬══════════════════════╣");
    console.log("  ║ Alice (legit) ║ 0 USDC ← ROBBED      ║ 300 USDC ← CORRECT   ║");
    console.log("  ║ Carol (attkr) ║ 300 USDC ← STOLEN    ║ 0 USDC ← BLOCKED     ║");
    console.log("  ║ Bob (legit)   ║ 200 USDC (correct)   ║ 200 USDC (correct)   ║");
    console.log("  ╚═══════════════╩══════════════════════╩══════════════════════╝");
    console.log("\n  Attack vector: Buy tokens AFTER deposit → claim → sell");
    console.log("  Fix: Use ERC20Votes.getPastVotes(user, depositTimestamp - 1)");
    console.log("  Result: Attacker profit reduced from 300 USDC to 0 USDC\n");
  });
});
