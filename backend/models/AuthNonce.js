const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// AuthNonce — short-lived nonce for SIWE-style request signing.
// The frontend asks for a nonce, signs `RealChain SIWE: <nonce>` with the
// connected wallet, and POSTs the signature back. The server verifies the
// signature, deletes the nonce, and trusts that the wallet body is the
// real wallet for the next call.
// ─────────────────────────────────────────────────────────────────────────────

const AuthNonceSchema = new mongoose.Schema({
  wallet:    { type: String, required: true, lowercase: true, index: true },
  nonce:     { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
});

// Auto-expire entries via Mongo TTL — saves us writing a cleanup cron.
AuthNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AuthNonce", AuthNonceSchema);
