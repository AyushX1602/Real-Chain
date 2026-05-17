const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PropertyFactory — Distribution Mode Switch", function () {
  let owner;
  let usdc;
  let factory;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("MockUSDC");
    usdc = await USDC.deploy(owner.address);
    await usdc.waitForDeployment();

    const Factory = await ethers.getContractFactory("PropertyFactory");
    factory = await Factory.deploy(await usdc.getAddress());
    await factory.waitForDeployment();
  });

  it("createProperty() keeps default V1 behavior", async function () {
    await factory.createProperty("Palm Heights", "Mumbai", 1000000n, 10_000_000n);

    const p = await factory.properties(0);

    const token = await ethers.getContractAt("PropertyToken", p.propertyToken);
    expect(await token.distributionHook()).to.equal(ethers.ZeroAddress);

    // V1 contract still works with existing API.
    const rd1 = await ethers.getContractAt("RentalDistribution", p.rentalDistribution);
    expect(await rd1.epochCount()).to.equal(0n);
  });

  it("createPropertyWithMode(..., true) deploys V2 and sets token hook", async function () {
    await factory.createPropertyWithMode("Ocean View", "Goa", 2000000n, 10_000_000n, true);

    const p = await factory.properties(0);

    const token = await ethers.getContractAt("PropertyToken", p.propertyToken);
    expect(await token.distributionHook()).to.equal(p.rentalDistribution);

    const rd2 = await ethers.getContractAt("RentalDistributionV2", p.rentalDistribution);

    // Sanity: V2 deposit and pending path is live.
    await usdc.approve(p.rentalDistribution, 1_000_000_000n);
    await rd2.depositRental(1_000_000_000n);

    const pendingOwner = await rd2.pendingDividends(owner.address);
    expect(pendingOwner).to.equal(1_000_000_000n);

    // Compatibility views for existing UIs/indexers.
    expect(await rd2.epochCount()).to.equal(1n);
    const [amount] = await rd2.getEpoch(0);
    expect(amount).to.equal(1_000_000_000n);
  });
});
