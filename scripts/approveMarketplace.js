// scripts/approveMarketplace.js
// Approves ALL property marketplaces so investors can buy via buyFromOwner.
// Usage: npx hardhat run scripts/approveMarketplace.js --network baseSepolia

const { ethers } = require("hardhat");

const FACTORY_ADDR = process.env.VITE_PROPERTY_FACTORY_ADDRESS;
const FACTORY_ABI = [
  "function getPropertiesCount() view returns (uint256)",
  "function properties(uint256) view returns (string,string,uint256,address,address,address,address)",
];
const TOKEN_ABI = [
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`\nOwner: ${owner.address}`);
  console.log(`Factory: ${FACTORY_ADDR}\n`);

  const factory = new ethers.Contract(FACTORY_ADDR, FACTORY_ABI, owner);
  const count = Number(await factory.getPropertiesCount());
  console.log(`Found ${count} properties\n`);

  for (let i = 0; i < count; i++) {
    const p = await factory.properties(i);
    const [name, , , tokenAddr, , marketAddr, propOwner] = p;
    console.log(`#${i} "${name}" — token ${tokenAddr.slice(0,10)}… market ${marketAddr.slice(0,10)}…`);

    if (propOwner.toLowerCase() !== owner.address.toLowerCase()) {
      console.log(`   ⏭ skipped (owner is ${propOwner}, not you)\n`);
      continue;
    }

    const token = new ethers.Contract(tokenAddr, TOKEN_ABI, owner);
    const allowance = await token.allowance(owner.address, marketAddr);

    if (allowance >= ethers.MaxUint256 / 2n) {
      console.log(`   ✓ already unlimited\n`);
      continue;
    }
    console.log(`   Current allowance: ${Number(allowance / 10n**18n)} PROP — upgrading to unlimited…`);

    const tx = await token.approve(marketAddr, ethers.MaxUint256);
    await tx.wait();
    console.log(`   ✅ approved! tx: ${tx.hash}\n`);
  }

  console.log("Done! Investors can now buy tokens.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
