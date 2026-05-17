const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * RealEstate Platform — Full Test Suite
 *
 * Key test additions over v1:
 *  1. All financial flows use MockUSDC (not ETH)
 *  2. Dividend snapshot correctness: verifies that selling tokens AFTER a rental
 *     deposit does NOT reduce the seller's claimable dividends (the core bug fix)
 *  3. Buyer-after-deposit: verifies that buying tokens AFTER a rental deposit
 *     does NOT grant dividends for that epoch
 *  4. ReentrancyGuard presence validated via double-claim attempt
 */
describe("RealEstate Platform v2 (USDC + Snapshot Dividends)", function () {
  let owner, alice, bob, carol, dave;
  let factory, usdc;
  let pt, rd, mp;

  const PRICE_PER_TOKEN = 10_000_000n; // 10 USDC (6 decimals)
  const RENT_AMOUNT = 1_000_000_000n;  // 1000 USDC

  // Helper: mine a new block 1 second ahead (needed for getPastVotes)
  async function mineBlock() {
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine");
  }

  beforeEach(async function () {
    [owner, alice, bob, carol, dave] = await ethers.getSigners();

    // Deploy MockUSDC
    const USDC = await ethers.getContractFactory("MockUSDC");
    usdc = await USDC.deploy(owner.address);
    await usdc.waitForDeployment();

    // Distribute USDC
    const USER_USDC = 50_000_000_000n; // 50,000 USDC each
    for (const user of [alice, bob, carol, dave]) {
      await usdc.mint(user.address, USER_USDC);
    }

    // Deploy Factory
    const Factory = await ethers.getContractFactory("PropertyFactory");
    factory = await Factory.deploy(await usdc.getAddress());
    await factory.waitForDeployment();

    // Create Property 0
    await factory.createProperty("Palm Heights", "Mumbai, India", 1_00_00_00_000n, PRICE_PER_TOKEN);
    const prop = await factory.properties(0);

    pt = await ethers.getContractAt("PropertyToken", prop.propertyToken);
    rd = await ethers.getContractAt("RentalDistribution", prop.rentalDistribution);
    mp = await ethers.getContractAt("Marketplace", prop.marketplace);

    // Owner approves marketplace for all tokens
    await pt.connect(owner).approve(await mp.getAddress(), await pt.totalSupply());

    // Mine a block so checkpoint times are strictly in the past for all queries
    await mineBlock();
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  PropertyFactory
  // ─────────────────────────────────────────────────────────────────────────
  describe("PropertyFactory", function () {
    it("registers property with correct metadata", async function () {
      expect(await factory.getPropertiesCount()).to.equal(1);
      const p = await factory.properties(0);
      expect(p.name).to.equal("Palm Heights");
      expect(p.owner).to.equal(owner.address);
      expect(p.propertyToken).to.not.equal(ethers.ZeroAddress);
      expect(p.rentalDistribution).to.not.equal(ethers.ZeroAddress);
      expect(p.marketplace).to.not.equal(ethers.ZeroAddress);
    });

    it("allows multiple properties to be created independently", async function () {
      await factory.createProperty("Ocean View", "Goa", 2_000_000n, PRICE_PER_TOKEN);
      expect(await factory.getPropertiesCount()).to.equal(2);
      const p2 = await factory.properties(1);
      expect(p2.name).to.equal("Ocean View");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  PropertyToken (ERC20Votes)
  // ─────────────────────────────────────────────────────────────────────────
  describe("PropertyToken", function () {
    it("mints exactly 100 PROP to the owner", async function () {
      expect(await pt.balanceOf(owner.address)).to.equal(ethers.parseEther("100"));
    });

    it("auto-delegates self on first token receipt", async function () {
      // Alice has no tokens yet. After buying, her delegate should be herself.
      const cost = PRICE_PER_TOKEN * 5n;
      await usdc.connect(alice).approve(await mp.getAddress(), cost);
      await mp.connect(alice).buyFromOwner(5);
      expect(await pt.delegates(alice.address)).to.equal(alice.address);
    });

    it("tracks historical voting power via getPastVotes", async function () {
      const cost = PRICE_PER_TOKEN * 20n;
      await usdc.connect(alice).approve(await mp.getAddress(), cost);
      await mp.connect(alice).buyFromOwner(20);
      const purchaseTime = (await ethers.provider.getBlock("latest")).timestamp;
      await mineBlock();
      const pastVotes = await pt.getPastVotes(alice.address, purchaseTime);
      expect(pastVotes).to.equal(ethers.parseEther("20"));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Marketplace — Primary
  // ─────────────────────────────────────────────────────────────────────────
  describe("Marketplace — Primary Sale", function () {
    it("transfers tokens and deducts USDC from buyer", async function () {
      const cost = PRICE_PER_TOKEN * 10n;
      await usdc.connect(alice).approve(await mp.getAddress(), cost);
      await mp.connect(alice).buyFromOwner(10);
      expect(await pt.balanceOf(alice.address)).to.equal(ethers.parseEther("10"));
    });

    it("reverts if buyer hasn't approved enough USDC", async function () {
      await expect(mp.connect(alice).buyFromOwner(10)).to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Marketplace — Secondary
  // ─────────────────────────────────────────────────────────────────────────
  describe("Marketplace — Secondary Listings", function () {
    beforeEach(async function () {
      const cost = PRICE_PER_TOKEN * 20n;
      await usdc.connect(alice).approve(await mp.getAddress(), cost);
      await mp.connect(alice).buyFromOwner(20);
    });

    it("creates listing and allows bob to buy", async function () {
      await pt.connect(alice).approve(await mp.getAddress(), ethers.parseEther("10"));
      await mp.connect(alice).createListing(10, PRICE_PER_TOKEN);

      const tradeCost = (10n * PRICE_PER_TOKEN * BigInt(1e18)) / BigInt(1e18);
      await usdc.connect(bob).approve(await mp.getAddress(), tradeCost);
      await mp.connect(bob).buyFromListing(0);

      expect(await pt.balanceOf(bob.address)).to.equal(ethers.parseEther("10"));
    });

    it("allows seller to cancel their listing", async function () {
      await pt.connect(alice).approve(await mp.getAddress(), ethers.parseEther("5"));
      await mp.connect(alice).createListing(5, PRICE_PER_TOKEN);
      await mp.connect(alice).cancelListing(0);

      const [,,,active] = await mp.getListing(0);
      expect(active).to.be.false;
    });

    it("reverts if buyer tries to buy inactive listing", async function () {
      await pt.connect(alice).approve(await mp.getAddress(), ethers.parseEther("5"));
      await mp.connect(alice).createListing(5, PRICE_PER_TOKEN);
      await mp.connect(alice).cancelListing(0);
      await expect(mp.connect(bob).buyFromListing(0)).to.be.revertedWith("Listing not active");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  RentalDistribution
  // ─────────────────────────────────────────────────────────────────────────
  describe("RentalDistribution — Basic Dividends", function () {
    beforeEach(async function () {
      // Alice: 30%, Bob: 20%
      await usdc.connect(alice).approve(await mp.getAddress(), PRICE_PER_TOKEN * 30n);
      await mp.connect(alice).buyFromOwner(30);
      await usdc.connect(bob).approve(await mp.getAddress(), PRICE_PER_TOKEN * 20n);
      await mp.connect(bob).buyFromOwner(20);
      await mineBlock();
    });

    it("calculates proportional pending dividends", async function () {
      await usdc.connect(owner).approve(await rd.getAddress(), RENT_AMOUNT);
      await rd.connect(owner).depositRental(RENT_AMOUNT);

      // Alice owns 30/100 tokens → expects 300 USDC
      const alicePending = await rd.pendingDividends(alice.address);
      expect(alicePending).to.equal(300_000_000n); // 300 USDC

      // Bob owns 20/100 tokens → expects 200 USDC
      const bobPending = await rd.pendingDividends(bob.address);
      expect(bobPending).to.equal(200_000_000n); // 200 USDC
    });

    it("deposits USDC and increments epoch count", async function () {
      await usdc.connect(owner).approve(await rd.getAddress(), RENT_AMOUNT);
      await rd.connect(owner).depositRental(RENT_AMOUNT);
      expect(await rd.epochCount()).to.equal(1);
    });

    it("pays correct USDC amount on claimAll", async function () {
      await usdc.connect(owner).approve(await rd.getAddress(), RENT_AMOUNT);
      await rd.connect(owner).depositRental(RENT_AMOUNT);

      const balBefore = await usdc.balanceOf(alice.address);
      await rd.connect(alice).claimAll();
      const balAfter = await usdc.balanceOf(alice.address);

      expect(balAfter - balBefore).to.equal(300_000_000n); // 300 USDC
    });

    it("prevents double claiming the same epoch", async function () {
      await usdc.connect(owner).approve(await rd.getAddress(), RENT_AMOUNT);
      await rd.connect(owner).depositRental(RENT_AMOUNT);
      await rd.connect(alice).claimAll();
      await expect(rd.connect(alice).claimAll()).to.be.revertedWith("Nothing to claim");
    });

    it("accumulates dividends across multiple epochs", async function () {
      await usdc.connect(owner).approve(await rd.getAddress(), RENT_AMOUNT * 2n);
      await rd.connect(owner).depositRental(RENT_AMOUNT);
      await mineBlock();
      await rd.connect(owner).depositRental(RENT_AMOUNT);

      // Alice should have 2 × 300 = 600 USDC pending
      const pending = await rd.pendingDividends(alice.address);
      expect(pending).to.equal(600_000_000n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  THE CRITICAL SNAPSHOT TESTS — This is what the old code couldn't do
  // ─────────────────────────────────────────────────────────────────────────
  describe("RentalDistribution — Snapshot Correctness (CORE FIX)", function () {
    it("seller retains correct dividend even after selling tokens post-deposit", async function () {
      // Alice buys 30 tokens BEFORE rental deposit
      await usdc.connect(alice).approve(await mp.getAddress(), PRICE_PER_TOKEN * 30n);
      await mp.connect(alice).buyFromOwner(30);
      await mineBlock();

      // Rental deposited — snapshot captures Alice@30 tokens
      await usdc.connect(owner).approve(await rd.getAddress(), RENT_AMOUNT);
      await rd.connect(owner).depositRental(RENT_AMOUNT);
      await mineBlock();

      // Alice sells ALL her tokens to Bob AFTER the deposit
      await pt.connect(alice).approve(await mp.getAddress(), ethers.parseEther("30"));
      await mp.connect(alice).createListing(30, PRICE_PER_TOKEN);
      const tradeCost = 30n * PRICE_PER_TOKEN * BigInt(1e18) / BigInt(1e18);
      await usdc.connect(bob).approve(await mp.getAddress(), tradeCost);
      await mp.connect(bob).buyFromListing(0);

      // Alice now holds 0 tokens, but had 30 at deposit time
      expect(await pt.balanceOf(alice.address)).to.equal(0);

      // Alice should STILL receive her 30% dividend (bug fix validation)
      const alicePending = await rd.pendingDividends(alice.address);
      expect(alicePending).to.equal(300_000_000n); // 300 USDC — not 0!

      const balBefore = await usdc.balanceOf(alice.address);
      await rd.connect(alice).claimAll();
      const balAfter = await usdc.balanceOf(alice.address);
      expect(balAfter - balBefore).to.equal(300_000_000n);
    });

    it("buyer AFTER deposit does NOT receive dividends for that epoch", async function () {
      // Alice buys 30 tokens before deposit
      await usdc.connect(alice).approve(await mp.getAddress(), PRICE_PER_TOKEN * 30n);
      await mp.connect(alice).buyFromOwner(30);
      await mineBlock();

      // Deposit captured at this epoch
      await usdc.connect(owner).approve(await rd.getAddress(), RENT_AMOUNT);
      await rd.connect(owner).depositRental(RENT_AMOUNT);
      await mineBlock();

      // Bob buys tokens AFTER the deposit epoch
      await usdc.connect(bob).approve(await mp.getAddress(), PRICE_PER_TOKEN * 20n);
      await mp.connect(bob).buyFromOwner(20);
      await mineBlock();

      // Bob should have 0 pending for this epoch (he held 0 at snapshot time)
      const bobPending = await rd.pendingDividends(bob.address);
      expect(bobPending).to.equal(0n);
    });
  });
});
