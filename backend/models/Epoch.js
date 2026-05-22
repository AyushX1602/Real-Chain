const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// Epoch — stores individual rent deposit epochs per property.
//
// Each epoch represents one on-chain depositRental() call.
// Source of truth: RentalDistribution.getEpoch(i) on-chain.
// This collection is a fast-read cache so the frontend doesn't have to
// make N sequential RPC calls just to render the "Recent epochs" table.
// ─────────────────────────────────────────────────────────────────────────────

const EpochSchema = new mongoose.Schema({
  propertyId:   { type: Number, required: true },
  epochIndex:   { type: Number, required: true },
  amount:       { type: Number, required: true },    // human USDC (6dp already divided)
  amountRaw:    { type: String, default: null },      // raw uint256 string for precision
  timestamp:    { type: Number, required: true },     // unix seconds from chain
  txHash:       { type: String, default: null },
  depositor:    { type: String, default: null },      // owner wallet (lowercase)
  chainId:      { type: Number, default: 84532 },
}, {
  timestamps: true,
});

// Unique per property + epoch index — upsert-safe
EpochSchema.index({ propertyId: 1, epochIndex: 1 }, { unique: true });
// Fast lookup for recent epochs
EpochSchema.index({ propertyId: 1, timestamp: -1 });

module.exports = mongoose.model("Epoch", EpochSchema);
