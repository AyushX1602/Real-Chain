const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const User = require("../models/User");

// ─────────────────────────────────────────────────────────────────────────────
// /api/transactions
//
// Filter contract (accepted on every list endpoint):
//   action     — "buy" | "claim" | "deposit" | "listing" | "cancel" | "all"
//                Alias: type (legacy)
//   gasMethod  — "ugf" | "eth" | "all"
//   property   — propertyId (number)
//   wallet     — 0x… 42-char address (any address field: from)
//   limit      — 1..200, default 50
//   cursor     — opaque createdAt-based cursor for the next page
//   txHash     — exact hash; useful for /activity?txHash=… deep links
//
// Pagination is keyset, not offset — we sort by createdAt desc and use the
// last row's createdAt + _id as the cursor for the next page. Stable across
// inserts and cheap to compute.
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_ALIASES = { all: null, "*": null };
const VALID_ACTIONS = new Set(["buy", "claim", "deposit", "listing", "cancel", "sell"]);

function parseCursor(raw) {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(String(raw), "base64").toString("utf8");
    const obj = JSON.parse(decoded);
    if (typeof obj?.t !== "string" || typeof obj?.id !== "string") return null;
    return { t: new Date(obj.t), id: obj.id };
  } catch { return null; }
}
function makeCursor(row) {
  if (!row) return null;
  const payload = JSON.stringify({ t: row.createdAt.toISOString(), id: String(row._id) });
  return Buffer.from(payload, "utf8").toString("base64");
}

function buildFilter(q) {
  const filter = {};
  const action = q.action || q.type;
  if (action && action !== "all" && action !== "*") {
    if (VALID_ACTIONS.has(action)) filter.type = action;
    else if (ACTION_ALIASES[action] === undefined) filter.type = "__no_match__";
  }
  if (q.gasMethod && q.gasMethod !== "all") {
    if (q.gasMethod === "ugf" || q.gasMethod === "eth") filter.gasMethod = q.gasMethod;
  }
  if (q.property != null && q.property !== "" && q.property !== "all") {
    const pid = Number(q.property);
    if (Number.isFinite(pid)) filter.propertyId = pid;
  }
  if (q.wallet) filter.from = String(q.wallet).toLowerCase();
  if (q.txHash) filter.txHash = String(q.txHash);
  return filter;
}

// ── GET /api/transactions — Paginated list ───────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const cursor = parseCursor(req.query.cursor);
    if (cursor) {
      filter.$or = [
        { createdAt: { $lt: cursor.t } },
        { createdAt: cursor.t, _id: { $lt: cursor.id } },
      ];
    }

    const txs = await Transaction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = txs.length > limit;
    const rows = hasMore ? txs.slice(0, limit) : txs;
    const nextCursor = hasMore ? makeCursor(rows[rows.length - 1]) : null;

    // Surface action alias on every row so old + new clients agree.
    const transactions = rows.map((r) => {
      const o = r.toObject();
      return { ...o, action: o.type };
    });

    res.json({ transactions, nextCursor, count: transactions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/transactions — Log a new transaction ───────────────────────────
// Called by the frontend after a transaction confirms on-chain.
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const action = body.action || body.type;
    const { txHash, from, propertyId, amount, tokenAmount, gasMethod, gasCostUsd } = body;

    if (!txHash || !action || !from) {
      return res.status(400).json({ error: "txHash, action (or type), and from are required" });
    }

    const tx = await Transaction.create({
      txHash,
      type:        action,
      from:        from.toLowerCase(),
      propertyId:  propertyId || 0,
      amount:      amount || 0,
      tokenAmount: tokenAmount || 0,
      gasMethod:   gasMethod || "eth",
      gasCostUsd:  gasCostUsd || 0,
      status:      "confirmed",
    });

    // Update user aggregate stats
    const wallet = from.toLowerCase();
    const updateFields = { $inc: { txCount: 1 }, $set: { lastConnected: new Date() } };
    if (action === "claim") updateFields.$inc.totalClaimed = amount || 0;
    if (action === "buy") updateFields.$inc.totalInvested = amount || 0;
    if (action === "deposit") updateFields.$inc.totalDeposited = amount || 0;
    await User.findOneAndUpdate({ wallet }, updateFields, { upsert: true });

    res.status(201).json({ ...tx.toObject(), action: tx.type });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(200).json({ message: "Transaction already logged" });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/transactions/stats/:wallet — Per-wallet P&L stats ───────────────
router.get("/stats/:wallet", async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const txs = await Transaction.find({
      from: { $regex: new RegExp(`^${wallet}$`, "i") },
    });
    let totalInvested = 0, totalClaimed = 0, claimCount = 0;
    txs.forEach((tx) => {
      const amt = Number(tx.amount || 0);
      const action = tx.type || "";
      if (action === "buy") totalInvested += amt;
      if (action === "claim") { totalClaimed += amt; claimCount++; }
    });
    res.json({ totalInvested, totalClaimed, totalTransactions: txs.length, claimCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/transactions/stats — Global platform stats ──────────────────────
router.get("/stats", async (req, res) => {
  try {
    const [claimStats, buyStats, depositStats, totalTxs, ugfTxs, distinctHolders, distinctProperties] = await Promise.all([
      Transaction.aggregate([{ $match: { type: "claim" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      Transaction.aggregate([{ $match: { type: "buy" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      Transaction.aggregate([{ $match: { type: "deposit" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      Transaction.countDocuments(),
      Transaction.countDocuments({ gasMethod: "ugf" }),
      Transaction.distinct("from").then((arr) => arr.length).catch(() => null),
      Transaction.distinct("propertyId").then((arr) => arr.length).catch(() => null),
    ]);

    const totalClaimed   = claimStats[0]?.total || 0;
    const totalInvested  = buyStats[0]?.total || 0;
    const totalDeposited = depositStats[0]?.total || 0;

    res.json({
      totalTransactions: totalTxs,
      ugfTransactions:   ugfTxs,
      ethTransactions:   Math.max(0, totalTxs - ugfTxs),
      ugfShare:          totalTxs > 0 ? Math.round((ugfTxs / totalTxs) * 1000) / 1000 : 0,
      totalClaimed,
      totalInvested,
      totalDeposited,
      totalVolume:       totalClaimed + totalInvested + totalDeposited,
      claimCount:        claimStats[0]?.count || 0,
      buyCount:          buyStats[0]?.count || 0,
      depositCount:      depositStats[0]?.count || 0,
      distinctWallets:   distinctHolders,
      distinctProperties,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/transactions/timeseries — Bucketed activity ─────────────────────
// Accepts both `?days=` (legacy) and `?window=` (spec) in {7, 30, 90, …}.
router.get("/timeseries", async (req, res) => {
  try {
    const requested = parseInt(req.query.window || req.query.days, 10);
    const days = Math.min(Math.max(Number.isFinite(requested) ? requested : 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const bucket = req.query.bucket === "hour" ? "%Y-%m-%dT%H:00" : "%Y-%m-%d";

    const daily = await Transaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: bucket, date: "$createdAt" } },
          count:    { $sum: 1 },
          volume:   { $sum: "$amount" },
          rent:     { $sum: { $cond: [{ $eq: ["$type", "claim"] }, "$amount", 0] } },
          buys:     { $sum: { $cond: [{ $eq: ["$type", "buy"] }, "$amount", 0] } },
          deposits: { $sum: { $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0] } },
          ugf:      { $sum: { $cond: [{ $eq: ["$gasMethod", "ugf"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, day: "$_id", count: 1, volume: 1, rent: 1, buys: 1, deposits: 1, ugf: 1 } },
    ]);

    res.json({ daily, bucket: req.query.bucket || "day", days, window: days });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/transactions/stats/:wallet — Per-user stats ─────────────────────
router.get("/stats/:wallet", async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const [claimStats, buyStats, txCount, ugfCount] = await Promise.all([
      Transaction.aggregate([{ $match: { from: wallet, type: "claim" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      Transaction.aggregate([{ $match: { from: wallet, type: "buy" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      Transaction.countDocuments({ from: wallet }),
      Transaction.countDocuments({ from: wallet, gasMethod: "ugf" }),
    ]);

    res.json({
      wallet,
      totalTransactions: txCount,
      ugfTransactions:   ugfCount,
      totalClaimed:      claimStats[0]?.total || 0,
      totalInvested:     buyStats[0]?.total || 0,
      claimCount:        claimStats[0]?.count || 0,
      buyCount:          buyStats[0]?.count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
