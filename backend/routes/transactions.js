const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const User = require("../models/User");

// ── GET /api/transactions — List transactions (filterable) ───────────────────
// Query params: ?wallet=0x...&type=claim&limit=50
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.wallet) filter.from = req.query.wallet.toLowerCase();
    if (req.query.type) filter.type = req.query.type;

    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const txs = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/transactions — Log a new transaction ───────────────────────────
// Called by the frontend after a transaction confirms on-chain
router.post("/", async (req, res) => {
  try {
    const { txHash, type, from, propertyId, amount, tokenAmount, gasMethod, gasCostUsd } = req.body;

    if (!txHash || !type || !from) {
      return res.status(400).json({ error: "txHash, type, and from are required" });
    }

    const tx = await Transaction.create({
      txHash,
      type,
      from: from.toLowerCase(),
      propertyId: propertyId || 0,
      amount: amount || 0,
      tokenAmount: tokenAmount || 0,
      gasMethod: gasMethod || "eth",
      gasCostUsd: gasCostUsd || 0,
      status: "confirmed",
    });

    // Update user aggregate stats
    const wallet = from.toLowerCase();
    const updateFields = { $inc: { txCount: 1 }, $set: { lastConnected: new Date() } };

    if (type === "claim") updateFields.$inc.totalClaimed = amount || 0;
    if (type === "buy") updateFields.$inc.totalInvested = amount || 0;
    if (type === "deposit") updateFields.$inc.totalDeposited = amount || 0;

    await User.findOneAndUpdate({ wallet }, updateFields, { upsert: true });

    res.status(201).json(tx);
  } catch (err) {
    // Duplicate txHash = already logged, not an error
    if (err.code === 11000) {
      return res.status(200).json({ message: "Transaction already logged" });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/transactions/stats — Global platform stats ──────────────────────
router.get("/stats", async (req, res) => {
  try {
    const [claimStats, buyStats, depositStats, totalTxs, ugfTxs] = await Promise.all([
      Transaction.aggregate([{ $match: { type: "claim" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      Transaction.aggregate([{ $match: { type: "buy" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      Transaction.aggregate([{ $match: { type: "deposit" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      Transaction.countDocuments(),
      Transaction.countDocuments({ gasMethod: "ugf" }),
    ]);

    res.json({
      totalTransactions: totalTxs,
      ugfTransactions: ugfTxs,
      totalClaimed: claimStats[0]?.total || 0,
      totalInvested: buyStats[0]?.total || 0,
      totalDeposited: depositStats[0]?.total || 0,
      claimCount: claimStats[0]?.count || 0,
      buyCount: buyStats[0]?.count || 0,
      depositCount: depositStats[0]?.count || 0,
    });
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
      ugfTransactions: ugfCount,
      totalClaimed: claimStats[0]?.total || 0,
      totalInvested: buyStats[0]?.total || 0,
      claimCount: claimStats[0]?.count || 0,
      buyCount: buyStats[0]?.count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
