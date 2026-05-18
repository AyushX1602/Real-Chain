const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// Holding — one row per (propertyId, wallet) pair, persisted by the indexer
// from PropertyToken Transfer events. Replaces the live `getLogs` rebuild
// in HolderList.jsx so the holders tab is O(1) instead of O(events).
// ─────────────────────────────────────────────────────────────────────────────

const HoldingSchema = new mongoose.Schema({
  propertyId: { type: Number, required: true },
  wallet:     { type: String, required: true, lowercase: true },
  balance:    { type: String, required: true, default: "0" }, // BigInt as decimal string
  chainId:    { type: Number, default: 84532 },
}, {
  timestamps: true,
});

// One row per (property, wallet) — upsert key.
HoldingSchema.index({ propertyId: 1, wallet: 1 }, { unique: true });
// Frequent query: top holders for a property.
HoldingSchema.index({ propertyId: 1, balance: -1 });

module.exports = mongoose.model("Holding", HoldingSchema);
