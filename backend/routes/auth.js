const express = require("express");
const router = express.Router();
const { issueNonce } = require("../middleware/siwe");

// ─────────────────────────────────────────────────────────────────────────────
// /api/auth/nonce — issue a single-use nonce for SIWE-style request signing.
// Frontend signs the message "RealChain SIWE: <nonce>" with the connected
// wallet, then includes the signature in subsequent protected requests.
// ─────────────────────────────────────────────────────────────────────────────

router.get("/nonce", async (req, res) => {
  try {
    const wallet = (req.query.wallet || "").toString();
    const out = await issueNonce(wallet);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message || "nonce issue failed" });
  }
});

module.exports = router;
