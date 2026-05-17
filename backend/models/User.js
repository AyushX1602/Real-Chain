const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  wallet:        { type: String, required: true, unique: true, lowercase: true },
  role:          { type: String, enum: ["owner", "investor", "unknown"], default: "unknown" },
  lastConnected: { type: Date, default: Date.now },
  totalClaimed:  { type: Number, default: 0 },   // total USDC claimed via dividends
  totalInvested: { type: Number, default: 0 },   // total USDC spent buying tokens
  totalDeposited:{ type: Number, default: 0 },   // total USDC deposited as rent (owners)
  txCount:       { type: Number, default: 0 },
}, {
  timestamps: true,
});

module.exports = mongoose.model("User", UserSchema);
