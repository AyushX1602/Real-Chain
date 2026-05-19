const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Holding = require("../models/Holding");
const Property = require("../models/Property");
const Transaction = require("../models/Transaction");

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

// ── GET /api/users/:wallet/summary — One-shot dashboard payload ──────────────
// Returns the user's profile, every property they OWN (as creator), every
// property they HOLD tokens in, and the most recent on-chain activity.
// The frontend uses this to render fully dynamic per-user dashboards without
// fanning out across multiple endpoints — and without ever rendering a
// static demo card. Empty arrays are intentional for brand-new wallets so
// the UI can show its real "No properties yet / No holdings yet" empty state.
router.get("/:wallet/summary", async (req, res) => {
  try {
    const wallet = String(req.params.wallet || "").toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    const txLimit = Math.min(parseInt(req.query.txLimit, 10) || 20, 100);

    const [profile, ownedRaw, holdingsRaw, recentTxs] = await Promise.all([
      User.findOne({ wallet }),
      Property.find({ owner: wallet }).sort({ propertyId: 1 }),
      Holding.find({ wallet, balance: { $ne: "0" } }).sort({ propertyId: 1 }),
      Transaction.find({ from: wallet }).sort({ createdAt: -1, _id: -1 }).limit(txLimit),
    ]);

    // Hydrate each holding with its parent Property in one round-trip.
    const heldIds = holdingsRaw.map((h) => h.propertyId);
    const heldProps = heldIds.length
      ? await Property.find({ propertyId: { $in: heldIds } })
      : [];
    const propById = new Map(heldProps.map((p) => [p.propertyId, p]));

    const holdings = holdingsRaw.map((h) => {
      const p = propById.get(h.propertyId);
      return {
        propertyId: h.propertyId,
        balance:    h.balance,
        property:   p ? {
          id:                 p.propertyId,
          name:               p.name,
          location:           p.location,
          owner:              p.owner,
          propertyToken:      p.tokenAddress,
          rentalDistribution: p.rentalAddress,
          marketplace:        p.marketAddress,
          totalSupply:        p.totalSupply,
          pricePerToken:      p.pricePerToken,
        } : null,
      };
    });

    const owned = ownedRaw.map((p) => ({
      id:                 p.propertyId,
      name:               p.name,
      location:           p.location,
      valueInr:           p.totalValue,
      propertyToken:      p.tokenAddress,
      rentalDistribution: p.rentalAddress,
      marketplace:        p.marketAddress,
      totalSupply:        p.totalSupply,
      availableSupply:    p.availableSupply,
      pricePerToken:      p.pricePerToken,
      epochCount:         p.epochCount,
      totalRentDeposited: p.totalRentDeposited,
      lastDepositAt:      p.lastDepositAt,
      cadenceDays:        p.cadenceDays,
    }));

    const activity = recentTxs.map((r) => {
      const o = r.toObject();
      return { ...o, action: o.type };
    });

    res.json({
      wallet,
      profile: profile || null,
      role:    profile?.role || null,
      counts:  {
        owned:    owned.length,
        holdings: holdings.length,
        activity: activity.length,
      },
      owned,
      holdings,
      activity,
    });
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
