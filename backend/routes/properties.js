const express = require("express");
const router = express.Router();
const Property = require("../models/Property");
const Holding = require("../models/Holding");
const Epoch = require("../models/Epoch");

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
    imageUrl:            doc.imageUrl ?? null,
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
        { upsert: true, returnDocument: "after" }
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

// ── PATCH /api/properties/:id/image — Store owner-uploaded image URL ─────────
// Called right after createProperty() succeeds on-chain.
// No auth guard — property ownership is established on-chain; the frontend
// only calls this after a successful tx from the owner wallet.
router.patch("/:id/image", async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({ error: "imageUrl (string) is required" });
    }
    // Basic URL validation — reject obviously non-URL strings
    try { new URL(imageUrl); } catch {
      return res.status(400).json({ error: "imageUrl must be a valid URL" });
    }
    const doc = await Property.findOneAndUpdate(
      { propertyId: Number(req.params.id) },
      { imageUrl: imageUrl.trim().slice(0, 2000) },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Property not found" });
    res.json({ ok: true, imageUrl: doc.imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/properties/sync — Resync chain → MongoDB ──────────────────────
// One-click re-read all on-chain properties from the Factory contract into
// MongoDB. Useful after a Hardhat node restart (which wipes in-memory state).
// Falls back to a direct RPC call even when the indexer is disabled.
router.post("/sync", async (req, res) => {
  try {
    const { ethers } = require("ethers");
    const path = require("path");
    const fs = require("fs");

    // Read deployed addresses
    const addrPath = path.resolve(__dirname, "../../deployed-addresses.json");
    if (!fs.existsSync(addrPath)) {
      return res.status(400).json({ error: "deployed-addresses.json not found. Run deploy first." });
    }
    const addrs = JSON.parse(fs.readFileSync(addrPath, "utf8"));
    if (!addrs.factory) {
      return res.status(400).json({ error: "No factory address in deployed-addresses.json" });
    }

    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "http://127.0.0.1:8545";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    const ABI = [
      "function getPropertiesCount() view returns (uint256)",
      "function properties(uint256) view returns (string name,string location,uint256 valueInr,address propertyToken,address rentalDistribution,address marketplace,address owner)",
    ];
    const factory = new ethers.Contract(addrs.factory, ABI, provider);
    const count = Number(await factory.getPropertiesCount());

    let synced = 0;
    for (let i = 0; i < count; i++) {
      const p = await factory.properties(i);
      await Property.findOneAndUpdate(
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
          chainId,
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      synced++;
    }

    res.json({ ok: true, synced, chainId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/properties/:id/epochs — List epochs for a property ─────────────
router.get("/:id/epochs", async (req, res) => {
  try {
    const propertyId = Number(req.params.id);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const epochs = await Epoch.find({ propertyId })
      .sort({ epochIndex: -1 })
      .limit(limit)
      .lean();
    res.json(epochs.map((e) => ({
      id: e.epochIndex,
      total: e.amountRaw || String(Math.round(e.amount * 1e6)),
      totalFormatted: e.amount,
      ts: e.timestamp,
      txHash: e.txHash,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/properties/:id/epochs — Record a new epoch (fast-path) ────────
// Called by the frontend immediately after a successful depositRental tx.
// This is the fast-path so the "Recent epochs" table updates instantly,
// without waiting for the background indexer to pick up the chain event.
router.post("/:id/epochs", async (req, res) => {
  try {
    const propertyId = Number(req.params.id);
    const { epochIndex, amount, amountRaw, timestamp, txHash, depositor } = req.body;
    if (epochIndex == null || amount == null || timestamp == null) {
      return res.status(400).json({ error: "epochIndex, amount, and timestamp are required" });
    }
    const epoch = await Epoch.findOneAndUpdate(
      { propertyId, epochIndex: Number(epochIndex) },
      {
        propertyId,
        epochIndex: Number(epochIndex),
        amount: Number(amount),
        amountRaw: amountRaw || String(Math.round(Number(amount) * 1e6)),
        timestamp: Number(timestamp),
        txHash: txHash || null,
        depositor: depositor ? String(depositor).toLowerCase() : null,
      },
      { upsert: true, returnDocument: "after" }
    );
    // Also bump epochCount + totalRentDeposited on the Property doc
    await Property.findOneAndUpdate(
      { propertyId },
      {
        $max: { epochCount: Number(epochIndex) + 1 },
        $inc: { totalRentDeposited: Number(amount) },
        lastDepositAt: new Date(Number(timestamp) * 1000),
      }
    );
    res.json({ ok: true, epoch: { id: epoch.epochIndex, total: epoch.amountRaw, ts: epoch.timestamp } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
