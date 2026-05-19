const express = require("express");
const router = express.Router();
const Property = require("../models/Property");
const Holding = require("../models/Holding");

// ─────────────────────────────────────────────────────────────────────────────
// /api/properties — frontend-shaped responses.
//
// The Mongoose model uses storage-friendly names (`tokenAddress`,
// `rentalAddress`, `marketAddress`, `totalValue`). The frontend (and the
// PropertyFactory contract) speak in `propertyToken`, `rentalDistribution`,
// `marketplace`, `valueInr`. This module is the translation layer: every
// response presents BOTH spellings so old code keeps working AND the new
// per-screen agents get the field names they expect without monkey-patching.
//
// We also derive frontend-only conveniences from the indexer state:
//   • `tokensRemaining = totalSupply - ownerSupply` (owner-held = primary stock)
//   • `pricePerToken`   = stored as raw 6-decimal USDC; surface as Number
//   • `holderCount`     = Holding.countDocuments({ balance != "0" })
// All are best-effort — when the indexer hasn't run, fields fall back to null.
// ─────────────────────────────────────────────────────────────────────────────

function shape(p, extras = {}) {
  if (!p) return null;
  const doc = p.toObject ? p.toObject() : p;
  return {
    id:                  doc.propertyId,
    propertyId:          doc.propertyId,
    name:                doc.name,
    location:            doc.location,
    valueInr:            doc.totalValue ?? doc.valueInr ?? 0,
    totalValue:          doc.totalValue ?? doc.valueInr ?? 0,
    // Both spellings — old + new.
    tokenAddress:        doc.tokenAddress,
    rentalAddress:       doc.rentalAddress,
    marketAddress:       doc.marketAddress,
    propertyToken:       doc.tokenAddress,
    rentalDistribution:  doc.rentalAddress,
    marketplace:         doc.marketAddress,
    owner:               doc.owner,
    totalSupply:         doc.totalSupply ?? null,
    availableSupply:     doc.availableSupply ?? null,
    tokensRemaining:     doc.tokensRemaining ?? doc.availableSupply ?? null,
    pricePerToken:       doc.pricePerToken ?? null,
    epochCount:          doc.epochCount ?? 0,
    totalRentDeposited:  doc.totalRentDeposited ?? 0,
    lastDepositAt:       doc.lastDepositAt ?? null,
    cadenceDays:         doc.cadenceDays ?? null,
    chainId:             doc.chainId,
    createdAt:           doc.createdAt,
    updatedAt:           doc.updatedAt,
    ...extras,
  };
}

// ── GET /api/properties — List all properties ────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.owner) filter.owner = String(req.query.owner).toLowerCase();
    const properties = await Property.find(filter).sort({ propertyId: 1 });
    res.json(properties.map((p) => shape(p)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/properties/:id — Get single property ────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const property = await Property.findOne({ propertyId: Number(req.params.id) });
    if (!property) return res.status(404).json({ error: "Property not found" });
    // Cheap holder count alongside the property metadata.
    let holderCount = null;
    try { holderCount = await Holding.countDocuments({ propertyId: property.propertyId, balance: { $ne: "0" } }); }
    catch { /* indexer not running — leave null */ }
    res.json(shape(property, { holderCount }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/properties/sync — Trigger on-chain sync ────────────────────────
// Manual sync endpoint. The indexer maintains the same data continuously when
// ENABLE_INDEXER=true; this exists for one-shot bootstrapping.
router.post("/sync", async (req, res) => {
  try {
    const { ethers } = require("ethers");
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    let addresses;
    try { addresses = require("../../deployed-addresses.json"); }
    catch {
      return res.status(400).json({ error: "deployed-addresses.json not found. Deploy contracts first." });
    }

    const factoryABI = [
      "function getPropertiesCount() view returns (uint256)",
      "function properties(uint256) view returns (string name,string location,uint256 valueInr,address propertyToken,address rentalDistribution,address marketplace,address owner)",
    ];
    const tokenABI = ["function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)"];
    const marketABI = ["function pricePerToken() view returns (uint256)"];

    const factory = new ethers.Contract(addresses.factory, factoryABI, provider);
    const count = Number(await factory.getPropertiesCount());

    const synced = [];
    for (let i = 0; i < count; i++) {
      const p = await factory.properties(i);
      const ownerAddr = (p.owner || "").toLowerCase();
      let totalSupply = null, ownerSupply = 0n, pricePerToken = null;
      try {
        const t = new ethers.Contract(p.propertyToken, tokenABI, provider);
        const m = new ethers.Contract(p.marketplace, marketABI, provider);
        const [ts, ob, ppt] = await Promise.all([
          t.totalSupply(),
          t.balanceOf(p.owner),
          m.pricePerToken(),
        ]);
        totalSupply = Number(ethers.formatEther(ts));
        ownerSupply = ob;
        pricePerToken = Number(ppt) / 1e6;
      } catch { /* leave nulls — chain unreachable */ }
      const tokensRemaining = totalSupply != null
        ? Math.max(0, totalSupply - Number(ethers.formatEther(ownerSupply)))
        : null;
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
          owner: ownerAddr,
          ...(totalSupply != null ? { totalSupply, availableSupply: tokensRemaining, tokensRemaining } : {}),
          ...(pricePerToken != null ? { pricePerToken } : {}),
        },
        { upsert: true, new: true }
      );
      synced.push(shape(doc));
    }

    res.json({ message: `Synced ${synced.length} properties`, properties: synced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/properties/owner/:wallet — Properties owned by a wallet ─────────
router.get("/owner/:wallet", async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.params.wallet.toLowerCase() });
    res.json(properties.map((p) => shape(p)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/properties/:id/holders — Top holders for a property ─────────────
// Response envelope:
//   { count: <distinct holders>, holders: [{ wallet, balance, balanceFormatted, sharePct, updatedAt }] }
// `count` lets the Marketplace card render a holder badge in O(1).
router.get("/:id/holders", async (req, res) => {
  try {
    const propertyId = Number(req.params.id);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const [count, rows, totalRow] = await Promise.all([
      Holding.countDocuments({ propertyId, balance: { $ne: "0" } }),
      Holding.find({ propertyId, balance: { $ne: "0" } })
        .sort({ balance: -1 })
        .limit(limit),
      Holding.aggregate([
        { $match: { propertyId, balance: { $ne: "0" } } },
        // BigInt-as-string sum is awkward in Mongo; we approximate with Number
        // for the share-pct view and keep the raw string for clients that
        // want exact arithmetic.
        { $project: { balance: { $toDouble: "$balance" } } },
        { $group: { _id: null, total: { $sum: "$balance" } } },
      ]),
    ]);

    const total = totalRow[0]?.total || 0;
    const holders = rows.map((r) => {
      const bal = Number(r.balance);
      return {
        wallet: r.wallet,
        balance: r.balance,                    // exact BigInt as decimal string (18dp wei)
        balanceFormatted: bal / 1e18,          // human PROP for charts
        sharePct: total > 0 ? Math.round((bal / total) * 10000) / 100 : 0,
        updatedAt: r.updatedAt,
      };
    });

    res.json({ count, holders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
