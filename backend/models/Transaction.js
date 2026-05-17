const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  txHash:      { type: String, required: true, unique: true },
  type:        { type: String, enum: ["buy", "sell", "deposit", "claim", "listing", "cancel"], required: true },
  from:        { type: String, required: true },  // wallet address
  propertyId:  { type: Number },
  amount:      { type: Number, default: 0 },      // USDC amount (human-readable, e.g. 500.00)
  tokenAmount: { type: Number, default: 0 },      // PROP token amount
  gasMethod:   { type: String, enum: ["eth", "ugf"], default: "eth" },
  gasCostUsd:  { type: Number, default: 0 },      // gas cost in Mock USD (if UGF)
  status:      { type: String, enum: ["pending", "confirmed", "failed"], default: "confirmed" },
  chainId:     { type: Number, default: 84532 },
}, {
  timestamps: true,
});

// Index for fast wallet-based queries
TransactionSchema.index({ from: 1, type: 1 });
TransactionSchema.index({ propertyId: 1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
