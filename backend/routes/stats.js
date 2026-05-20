const express = require("express");
const router = express.Router();
const Property = require("../models/Property");
const Holding = require("../models/Holding");

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stats — Aggregated platform metrics for the Live Stats Banner.
//
// Returns in one call:
//   tvlInr           — sum of all property valuations (raw paisa)
//   totalRentPaid    — sum of totalRentDeposited across properties (USDC)
//   totalEpochs      — sum of epochCount across all properties
//   activeHolders    — count of distinct wallets with balance > 0 in Holding
//   propertyCount    — total number of tokenised properties
//
// Cached for 30 s on the server to prevent hammering Mongo on every banner
// refresh (frontend polls every 30 s anyway).
// ─────────────────────────────────────────────────────────────────────────────

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 30_000;

router.get("/", async (req, res) => {
  try {
    const now = Date.now();
    if (_cache && now - _cacheAt < CACHE_TTL_MS) {
      return res.json(_cache);
    }

    const [properties, holderCount] = await Promise.all([
      Property.find({}, { totalValue: 1, totalRentDeposited: 1, epochCount: 1 }).lean(),
      Holding.countDocuments({ balance: { $ne: "0" } }).catch(() => null),
    ]);

    const tvlInr           = properties.reduce((s, p) => s + (p.totalValue  || 0), 0);
    const totalRentPaid    = properties.reduce((s, p) => s + (p.totalRentDeposited || 0), 0);
    const totalEpochs      = properties.reduce((s, p) => s + (p.epochCount  || 0), 0);
    const propertyCount    = properties.length;

    _cache = {
      tvlInr,
      totalRentPaid,
      totalEpochs,
      activeHolders: holderCount ?? 0,
      propertyCount,
      updatedAt: new Date().toISOString(),
    };
    _cacheAt = now;

    res.json(_cache);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
