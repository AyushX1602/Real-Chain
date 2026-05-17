const express = require("express");
const router = express.Router();
const User = require("../models/User");

// ── POST /api/users/connect — Register or update user on wallet connect ──────
router.post("/connect", async (req, res) => {
  try {
    const { wallet, role } = req.body;
    if (!wallet) return res.status(400).json({ error: "wallet is required" });

    const user = await User.findOneAndUpdate(
      { wallet: wallet.toLowerCase() },
      {
        $set: {
          lastConnected: new Date(),
          ...(role && { role: role.toLowerCase() }),
        },
      },
      { upsert: true, new: true }
    );

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/users/:wallet — Get user profile ────────────────────────────────
router.get("/:wallet", async (req, res) => {
  try {
    const user = await User.findOne({ wallet: req.params.wallet.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/users/leaderboard — Top investors by total claimed ──────────────
router.get("/leaderboard/top", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const users = await User.find({ role: "investor", totalClaimed: { $gt: 0 } })
      .sort({ totalClaimed: -1 })
      .limit(limit)
      .select("wallet totalClaimed totalInvested txCount");

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
