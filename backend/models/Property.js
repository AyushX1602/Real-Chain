const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// Property — Mongoose model.
//
// Storage uses the on-chain field names where possible (totalSupply,
// pricePerToken, etc.) and keeps the legacy camelCase aliases for backward
// compatibility (totalValue ↔ valueInr is exposed by the route layer).
// `tokensRemaining` is denormalised so the Marketplace card can render the
// fractional-ownership progress bar in O(1).
// ─────────────────────────────────────────────────────────────────────────────

const PropertySchema = new mongoose.Schema({
  propertyId:         { type: Number, required: true, unique: true },
  name:               { type: String, required: true },
  location:           { type: String, required: true },
  totalValue:         { type: Number, default: 0 },          // valueInr in paisa from the contract
  tokenAddress:       { type: String, required: true },
  rentalAddress:      { type: String, required: true },
  marketAddress:      { type: String, required: true },
  owner:              { type: String, required: true },      // wallet address (lowercase)
  // Indexer-maintained denormalised state:
  totalSupply:        { type: Number, default: null },       // human PROP (formatEther applied)
  availableSupply:    { type: Number, default: null },       // legacy alias for tokensRemaining
  tokensRemaining:    { type: Number, default: null },       // owner has not yet sold these
  pricePerToken:      { type: Number, default: null },       // human USDC (6dp applied)
  epochCount:         { type: Number, default: 0 },
  totalRentDeposited: { type: Number, default: 0 },          // human USDC
  lastDepositAt:      { type: Date,   default: null },
  cadenceDays:        { type: Number, default: null },
  useV2:              { type: Boolean, default: false },
  chainId:            { type: Number, default: 84532 },
}, {
  timestamps: true,
});

// Quick reverse-lookup by token contract — used by the indexer.
PropertySchema.index({ tokenAddress: 1 });

module.exports = mongoose.model("Property", PropertySchema);
