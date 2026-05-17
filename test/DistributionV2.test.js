const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RentalDistributionV2 — Constant-Time Claims", function () {
  let owner, alice, bob, carol;
  let usdc, token, rd2;

  const RENT_1000 = 1_000_000_000n; // 1000 USDC (6 decimals)
  const RENT_500  =   500_000_000n; // 500 USDC

  async function deploySuite() {
    [owner, alice, bob, carol] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("MockUSDC");
    usdc = await USDC.deploy(owner.address);
    await usdc.waitForDeployment();

    // Fund participants for test transfers/trades if needed
    await usdc.mint(alice.address, 10_000_000_000n);
    await usdc.mint(bob.address,   10_000_000_000n);
    await usdc.mint(carol.address, 10_000_000_000n);

    const PT = await ethers.getContractFactory("PropertyToken");
    token = await PT.deploy("V2 Property", "Mumbai", 1000000n, owner.address);
    await token.waitForDeployment();

    const RD2 = await ethers.getContractFactory("RentalDistributionV2");
    rd2 = await RD2.deploy(await token.getAddress(), await usdc.getAddress(), owner.address);
    await rd2.waitForDeployment();

    // Enable sync hook (opt-in path; does not affect legacy v1 flows)
    await token.connect(owner).setDistributionHook(await rd2.getAddress());

    // Initial allocation: Alice 30, Bob 20, Owner keeps 50
    await token.connect(owner).transfer(alice.address, ethers.parseEther("30"));
    await token.connect(owner).transfer(bob.address, ethers.parseEther("20"));
  }

  async function deposit(amount) {
    await usdc.connect(owner).approve(await rd2.getAddress(), amount);
    await rd2.connect(owner).depositRental(amount);
  }

  beforeEach(async function () {
    await deploySuite();
  });

  it("Security: buyer-after-deposit cannot claim retroactive rewards", async function () {
    // Epoch-equivalent deposit at current ownership snapshot
    await deposit(RENT_1000);

    // Carol buys AFTER deposit: Alice transfers all 30 tokens to Carol
    await token.connect(alice).transfer(carol.address, ethers.parseEther("30"));

    const alicePending = await rd2.pendingDividends(alice.address);
    const carolPending = await rd2.pendingDividends(carol.address);

    // Alice keeps her already-earned rent share (30%)
    expect(alicePending).to.equal(300_000_000n);
    // Carol should not get old rewards for tokens acquired after deposit
    expect(carolPending).to.equal(0n);
  });

  it("Fairness: seller keeps earned rewards after selling tokens", async function () {
    await deposit(RENT_1000);

    // Sell after deposit
    await token.connect(alice).transfer(carol.address, ethers.parseEther("30"));

    // Alice claims rewards that were earned before transfer
    const before = await usdc.balanceOf(alice.address);
    await rd2.connect(alice).claimAll();
    const after = await usdc.balanceOf(alice.address);

    expect(after - before).to.equal(300_000_000n);

    // Buyer still has no retroactive claim for the past deposit
    await expect(rd2.connect(carol).claimAll()).to.be.revertedWith("Nothing to claim");
  });

  it("Accounting: deposited = claimed + unclaimed + dust", async function () {
    // Deposit #1: ownership Alice30 Bob20 Owner50
    await deposit(RENT_1000);

    // Transfer 10 tokens from Alice to Carol after first deposit
    await token.connect(alice).transfer(carol.address, ethers.parseEther("10"));

    // Deposit #2: ownership Alice20 Bob20 Carol10 Owner50
    await deposit(RENT_500);

    // Expected pending:
    // Alice: 300 + 100 = 400
    // Carol: 0   + 50  = 50
    // Bob:   200 + 100 = 300
    // Owner: 500 + 250 = 750
    expect(await rd2.pendingDividends(alice.address)).to.equal(400_000_000n);
    expect(await rd2.pendingDividends(carol.address)).to.equal( 50_000_000n);

    // Partial claims
    await rd2.connect(alice).claimAll();
    await rd2.connect(carol).claimAll();

    const [deposited, claimed, unclaimed, dust] = await rd2.accountingState();
    const contractBal = await usdc.balanceOf(await rd2.getAddress());

    // Main accounting identity requested for paper proof
    expect(deposited).to.equal(claimed + unclaimed + dust);

    // Contract balance decomposition consistency
    expect(contractBal).to.equal(unclaimed + dust);

    // Optional stronger check in this scenario (dust is 0 for chosen values)
    const bobPending = await rd2.pendingDividends(bob.address);
    const ownerPending = await rd2.pendingDividends(owner.address);
    expect(unclaimed).to.equal(bobPending + ownerPending);
  });
});
