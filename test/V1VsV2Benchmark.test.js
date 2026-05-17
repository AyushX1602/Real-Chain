const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * V1 vs V2 benchmark for research section.
 *
 * Required outputs:
 *  1) claim gas growth curve
 *  2) deposit gas
 *  3) transfer gas overhead
 *  4) break-even ownership threshold
 */

describe("Benchmark — RentalDistribution V1 vs V2", function () {
  this.timeout(300000);

  const ETH_PRICE_USD = 2000;
  const GAS_PRICE_GWEI = 20;

  const RENT_PER_EPOCH = 1_000_000_000n; // 1000 USDC
  const EPOCH_COUNTS = [1, 3, 6, 12, 24, 48];

  function gasToUsd(gas) {
    const ethSpent = Number(gas) * GAS_PRICE_GWEI * 1e-9;
    return ethSpent * ETH_PRICE_USD;
  }

  function usdFmt(n) {
    return `$${n.toFixed(3)}`;
  }

  async function deployV1() {
    const [owner, alice] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await USDC.deploy(owner.address);
    await usdc.waitForDeployment();

    const PT = await ethers.getContractFactory("PropertyToken");
    const token = await PT.deploy("V1 Property", "Mumbai", 1000000n, owner.address);
    await token.waitForDeployment();

    const RD1 = await ethers.getContractFactory("RentalDistribution");
    const rd1 = await RD1.deploy(await token.getAddress(), await usdc.getAddress(), owner.address);
    await rd1.waitForDeployment();

    await token.connect(owner).transfer(alice.address, ethers.parseEther("30"));

    return { owner, alice, usdc, token, rd1 };
  }

  async function deployV2() {
    const [owner, alice] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await USDC.deploy(owner.address);
    await usdc.waitForDeployment();

    const PT = await ethers.getContractFactory("PropertyToken");
    const token = await PT.deploy("V2 Property", "Mumbai", 1000000n, owner.address);
    await token.waitForDeployment();

    const RD2 = await ethers.getContractFactory("RentalDistributionV2");
    const rd2 = await RD2.deploy(await token.getAddress(), await usdc.getAddress(), owner.address);
    await rd2.waitForDeployment();

    await token.connect(owner).setDistributionHook(await rd2.getAddress());
    await token.connect(owner).transfer(alice.address, ethers.parseEther("30"));

    return { owner, alice, usdc, token, rd2 };
  }

  async function depositManyV1(ctx, n) {
    await ctx.usdc.connect(ctx.owner).approve(await ctx.rd1.getAddress(), RENT_PER_EPOCH * BigInt(n));
    for (let i = 0; i < n; i++) {
      await ctx.rd1.connect(ctx.owner).depositRental(RENT_PER_EPOCH);
    }
  }

  async function depositManyV2(ctx, n) {
    await ctx.usdc.connect(ctx.owner).approve(await ctx.rd2.getAddress(), RENT_PER_EPOCH * BigInt(n));
    for (let i = 0; i < n; i++) {
      await ctx.rd2.connect(ctx.owner).depositRental(RENT_PER_EPOCH);
    }
  }

  it("prints V1 vs V2 benchmark tables", async function () {
    const claimRows = [];

    for (const epochs of EPOCH_COUNTS) {
      const v1 = await deployV1();
      await depositManyV1(v1, epochs);
      const claimV1Tx = await v1.rd1.connect(v1.alice).claimAll();
      const claimV1Rcpt = await claimV1Tx.wait();

      const v2 = await deployV2();
      await depositManyV2(v2, epochs);
      const claimV2Tx = await v2.rd2.connect(v2.alice).claimAll();
      const claimV2Rcpt = await claimV2Tx.wait();

      claimRows.push({
        epochs,
        v1Gas: Number(claimV1Rcpt.gasUsed),
        v2Gas: Number(claimV2Rcpt.gasUsed),
      });
    }

    // Deposit gas comparison
    const depV1 = await deployV1();
    await depV1.usdc.connect(depV1.owner).approve(await depV1.rd1.getAddress(), RENT_PER_EPOCH);
    const depV1Tx = await depV1.rd1.connect(depV1.owner).depositRental(RENT_PER_EPOCH);
    const depV1Rcpt = await depV1Tx.wait();

    const depV2 = await deployV2();
    await depV2.usdc.connect(depV2.owner).approve(await depV2.rd2.getAddress(), RENT_PER_EPOCH);
    const depV2Tx = await depV2.rd2.connect(depV2.owner).depositRental(RENT_PER_EPOCH);
    const depV2Rcpt = await depV2Tx.wait();

    // Transfer gas overhead due to hook path
    const [owner, alice] = await ethers.getSigners();

    const PT = await ethers.getContractFactory("PropertyToken");
    const plainToken = await PT.deploy("Plain Property", "Mumbai", 1000000n, owner.address);
    await plainToken.waitForDeployment();
    const plainTransferTx = await plainToken.connect(owner).transfer(alice.address, ethers.parseEther("1"));
    const plainTransferRcpt = await plainTransferTx.wait();

    const hookCtx = await deployV2();
    await hookCtx.usdc.connect(hookCtx.owner).approve(await hookCtx.rd2.getAddress(), RENT_PER_EPOCH);
    await hookCtx.rd2.connect(hookCtx.owner).depositRental(RENT_PER_EPOCH);
    const hookedTransferTx = await hookCtx.token.connect(hookCtx.owner).transfer(alice.address, ethers.parseEther("1"));
    const hookedTransferRcpt = await hookedTransferTx.wait();

    const transferOverhead = Number(hookedTransferRcpt.gasUsed) - Number(plainTransferRcpt.gasUsed);

    console.log("\n  ╔════════════════════════════════════════════════════════════════════════════╗");
    console.log("  ║                CLAIM GAS GROWTH CURVE (V1 LOOP vs V2 INDEX)             ║");
    console.log("  ╠════════════╦══════════════╦══════════════╦══════════════╦══════════════╣");
    console.log("  ║ Epochs     ║ V1 claim gas ║ V2 claim gas ║ V1 cost      ║ V2 cost      ║");
    console.log("  ╠════════════╬══════════════╬══════════════╬══════════════╬══════════════╣");
    for (const row of claimRows) {
      const v1Cost = usdFmt(gasToUsd(row.v1Gas));
      const v2Cost = usdFmt(gasToUsd(row.v2Gas));
      console.log(`  ║ ${String(row.epochs).padEnd(10)} ║ ${row.v1Gas.toLocaleString().padStart(12)} ║ ${row.v2Gas.toLocaleString().padStart(12)} ║ ${v1Cost.padStart(12)} ║ ${v2Cost.padStart(12)} ║`);
    }
    console.log("  ╚════════════╩══════════════╩══════════════╩══════════════╩══════════════╝");

    console.log("\n  ╔════════════════════════════════════════════════════════════════════════════╗");
    console.log("  ║                        DEPOSIT GAS (single deposit)                      ║");
    console.log("  ╠════════════════════════════╦══════════════╦═══════════════════════════════╣");
    console.log("  ║ Path                       ║ Gas Used     ║ Est. Cost                     ║");
    console.log("  ╠════════════════════════════╬══════════════╬═══════════════════════════════╣");
    console.log(`  ║ V1 depositRental()         ║ ${Number(depV1Rcpt.gasUsed).toLocaleString().padStart(12)} ║ ${usdFmt(gasToUsd(depV1Rcpt.gasUsed)).padStart(29)} ║`);
    console.log(`  ║ V2 depositRental()         ║ ${Number(depV2Rcpt.gasUsed).toLocaleString().padStart(12)} ║ ${usdFmt(gasToUsd(depV2Rcpt.gasUsed)).padStart(29)} ║`);
    console.log("  ╚════════════════════════════╩══════════════╩═══════════════════════════════╝");

    console.log("\n  ╔════════════════════════════════════════════════════════════════════════════╗");
    console.log("  ║                 TRANSFER GAS OVERHEAD (hook-enabled V2)                  ║");
    console.log("  ╠════════════════════════════╦══════════════╦═══════════════════════════════╣");
    console.log("  ║ Path                       ║ Gas Used     ║ Est. Cost                     ║");
    console.log("  ╠════════════════════════════╬══════════════╬═══════════════════════════════╣");
    console.log(`  ║ Baseline transfer          ║ ${Number(plainTransferRcpt.gasUsed).toLocaleString().padStart(12)} ║ ${usdFmt(gasToUsd(plainTransferRcpt.gasUsed)).padStart(29)} ║`);
    console.log(`  ║ Hooked transfer (V2)       ║ ${Number(hookedTransferRcpt.gasUsed).toLocaleString().padStart(12)} ║ ${usdFmt(gasToUsd(hookedTransferRcpt.gasUsed)).padStart(29)} ║`);
    console.log(`  ║ Overhead                   ║ ${transferOverhead.toLocaleString().padStart(12)} ║ ${usdFmt(gasToUsd(transferOverhead)).padStart(29)} ║`);
    console.log("  ╚════════════════════════════╩══════════════╩═══════════════════════════════╝");

    console.log("\n  ╔════════════════════════════════════════════════════════════════════════════╗");
    console.log("  ║                 BREAK-EVEN OWNERSHIP THRESHOLD (1000 USDC/epoch)         ║");
    console.log("  ╠════════════╦══════════════╦══════════════╦══════════════╦══════════════╣");
    console.log("  ║ Epochs     ║ V1 min %     ║ V2 min %     ║ V1 min USDC  ║ V2 min USDC  ║");
    console.log("  ╠════════════╬══════════════╬══════════════╬══════════════╬══════════════╣");
    for (const row of claimRows) {
      const totalRent = row.epochs * 1000;
      const v1Cost = gasToUsd(row.v1Gas);
      const v2Cost = gasToUsd(row.v2Gas);

      const v1Pct = (v1Cost / totalRent) * 100;
      const v2Pct = (v2Cost / totalRent) * 100;

      // USD earned if user owns 1% = totalRent / 100
      const onePercentIncome = totalRent / 100;
      const v1MinStakeUsd = v1Cost / onePercentIncome;
      const v2MinStakeUsd = v2Cost / onePercentIncome;

      console.log(
        `  ║ ${String(row.epochs).padEnd(10)} ║ ${(v1Pct.toFixed(3) + "%").padStart(12)} ║ ${(v2Pct.toFixed(3) + "%").padStart(12)} ║ ${(">" + v1MinStakeUsd.toFixed(3)).padStart(12)} ║ ${(">" + v2MinStakeUsd.toFixed(3)).padStart(12)} ║`
      );
    }
    console.log("  ╚════════════╩══════════════╩══════════════╩══════════════╩══════════════╝\n");

    // Sanity assertions to keep benchmark meaningful
    expect(claimRows[claimRows.length - 1].v1Gas).to.be.greaterThan(claimRows[0].v1Gas);
    expect(claimRows[claimRows.length - 1].v2Gas).to.be.lessThan(claimRows[claimRows.length - 1].v1Gas);
    expect(transferOverhead).to.be.greaterThan(0);
  });
});
