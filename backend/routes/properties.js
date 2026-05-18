const express = require("express");
const router = express.Router();
const Property = require("../models/Property");

// ── GET /api/properties — List all properties ────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const properties = await Property.find().sort({ propertyId: 1 });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/properties/:id — Get single property ────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const property = await Property.findOne({ propertyId: Number(req.params.id) });
    if (!property) return res.status(404).json({ error: "Property not found" });
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/properties/sync — Trigger on-chain sync ────────────────────────
// Called manually or by the sync service to pull data from the blockchain
router.post("/sync", async (req, res) => {
  try {
    const { ethers } = require("ethers");
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Read deployed addresses from the root config
    let addresses;
    try {
      addresses = require("../../deployed-addresses.json");
    } catch {
      return res.status(400).json({ error: "deployed-addresses.json not found. Deploy contracts first." });
    }

    const factoryABI = [
      "function getPropertiesCount() view returns (uint256)",
      "function properties(uint256) view returns (string name,string location,uint256 valueInr,address propertyToken,address rentalDistribution,address marketplace,address owner)",
    ];

    const factory = new ethers.Contract(addresses.factory, factoryABI, provider);
    const count = Number(await factory.getPropertiesCount());

    const synced = [];
    for (let i = 0; i < count; i++) {
      const p = await factory.properties(i);
      const doc = await Property.findOneAndUpdate(
        { propertyId: i },
        {
          propertyId: i,
          name: p.name,
          location: p.location,
          totalValue: Number(p.valueInr),
          tokenAddress: p.propertyToken,
          rentalAddress: p.rentalDistribution,
          marketAddress: p.marketplace,
          owner: p.owner.toLowerCase(),
        },
        { upsert: true, new: true }
      );
      synced.push(doc);
    }

    res.json({ message: `Synced ${synced.length} properties`, properties: synced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/properties/owner/:wallet — Properties owned by a wallet ─────────
router.get("/owner/:wallet", async (req, res) => {
  try {
    const properties = await Property.find({
      owner: req.params.wallet.toLowerCase(),
    });
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/properties/:id/holders — Top holders for a property ─────────────
// Reads from the indexer-maintained Holding collection. Falls back to an empty
// list when the indexer hasn't run yet (the frontend's HolderList component
// keeps its on-chain getLogs path as a backup).
router.get("/:id/holders", async (req, res) => {
  try {
    const Holding = require("../models/Holding");
    const propertyId = Number(req.params.id);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const rows = await Holding.find({ propertyId, balance: { $ne: "0" } })
      .sort({ balance: -1 })
      .limit(limit);
    res.json(rows.map((r) => ({
      wallet: r.wallet,
      balance: r.balance,           // BigInt as decimal string (18dp)
      updatedAt: r.updatedAt,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
