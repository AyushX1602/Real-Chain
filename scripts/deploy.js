const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Optional mode switch: DISTRIBUTION_MODE=v1|v2 (default: v1)
  const mode = (process.env.DISTRIBUTION_MODE || "v1").toLowerCase();
  const useV2 = mode === "v2";

  // ── Step 1: Deploy MockUSDC ───────────────────────────────────────────────
  console.log("\n[1/3] Deploying MockUSDC...");
  const USDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await USDC.deploy(deployer.address);
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log("MockUSDC deployed to:", usdcAddr);

  // ── Step 2: Deploy PropertyFactory (with USDC address) ───────────────────
  console.log("\n[2/3] Deploying PropertyFactory...");
  const Factory = await ethers.getContractFactory("PropertyFactory");
  const factory = await Factory.deploy(usdcAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("PropertyFactory deployed to:", factoryAddr);
  console.log("Distribution mode:", useV2 ? "V2 (constant-time claims)" : "V1 (epoch-loop claims)");

  // ── Step 3: Create 2 Mock Properties ─────────────────────────────────────
  console.log("\n[3/3] Creating initial properties...");
  // Price per token in USDC (6 decimals): 10 USDC = 10_000_000
  const PRICE_1 = 10_000_000n;   // 10 USDC / token
  const PRICE_2 = 50_000_000n;   // 50 USDC / token

  let tx1 = useV2
    ? await factory.createPropertyWithMode(
        "Palm Heights Residency",
        "Bandra West, Mumbai",
        1_00_00_00_000n,
        PRICE_1,
        true
      )
    : await factory.createProperty(
        "Palm Heights Residency",
        "Bandra West, Mumbai",
        1_00_00_00_000n,
        PRICE_1
      );
  await tx1.wait();
  console.log("  -> Palm Heights created!");

  let tx2 = useV2
    ? await factory.createPropertyWithMode(
        "Ocean View Villas",
        "Goa, India",
        5_00_00_00_000n,
        PRICE_2,
        true
      )
    : await factory.createProperty(
        "Ocean View Villas",
        "Goa, India",
        5_00_00_00_000n,
        PRICE_2
      );
  await tx2.wait();
  console.log("  -> Ocean View Villas created!");

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log(`║  MockUSDC:       ${usdcAddr}  ║`);
  console.log(`║  Factory:        ${factoryAddr}  ║`);
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\nPaste these into frontend/src/config/contracts.js");

  // ── Write to deployed-addresses.json ────────────────────────────────────
  const addresses = {
    network: hre.network.name,
    distributionMode: useV2 ? "v2" : "v1",
    mockUsdc: usdcAddr,
    factory: factoryAddr,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to deployed-addresses.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
