const { ethers } = require("ethers");
const AuthNonce = require("../models/AuthNonce");

// ─────────────────────────────────────────────────────────────────────────────
// SIWE-style wallet authentication.
//
// Flow:
//   1. Frontend GETs /api/auth/nonce?wallet=0x... → server stores a nonce that
//      expires in 5 minutes and returns it.
//   2. Frontend asks the wallet to sign the message
//      `RealChain SIWE: <nonce>`.
//   3. Frontend includes the signature in subsequent protected requests via
//      headers `X-Wallet-Signature` and `X-Wallet-Nonce`, and the wallet
//      address in `X-Wallet-Address`.
//   4. requireSignedWallet verifies: nonce exists, signature recovers to
//      address, then deletes the nonce so it can't be replayed.
//
// This is intentionally additive: existing routes that don't use this
// middleware still take an unauthenticated wallet body. New write routes
// should opt in by mounting requireSignedWallet.
// ─────────────────────────────────────────────────────────────────────────────

const NONCE_TTL_MS = 5 * 60 * 1000;
const SIWE_PREFIX = "RealChain SIWE: ";

function isAddress(addr) {
  return typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

async function issueNonce(wallet) {
  if (!isAddress(wallet)) throw new Error("invalid wallet");
  const nonce = ethers.hexlify(ethers.randomBytes(16));
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS);
  await AuthNonce.findOneAndUpdate(
    { wallet: wallet.toLowerCase() },
    { wallet: wallet.toLowerCase(), nonce, expiresAt },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { nonce, message: SIWE_PREFIX + nonce, expiresAt };
}

async function requireSignedWallet(req, res, next) {
  try {
    const wallet = (req.header("x-wallet-address") || "").toLowerCase();
    const sig    = req.header("x-wallet-signature");
    const nonce  = req.header("x-wallet-nonce");

    if (!isAddress(wallet) || !sig || !nonce) {
      return res.status(401).json({ error: "Missing wallet signature headers" });
    }

    const stored = await AuthNonce.findOne({ wallet });
    if (!stored || stored.nonce !== nonce) {
      return res.status(401).json({ error: "Unknown or expired nonce — request a fresh one" });
    }
    if (stored.expiresAt < new Date()) {
      await AuthNonce.deleteOne({ _id: stored._id });
      return res.status(401).json({ error: "Nonce expired — request a fresh one" });
    }

    let recovered;
    try {
      recovered = ethers.verifyMessage(SIWE_PREFIX + nonce, sig);
    } catch (e) {
      return res.status(401).json({ error: "Signature verification failed" });
    }
    if (recovered.toLowerCase() !== wallet) {
      return res.status(401).json({ error: "Signature does not match wallet" });
    }

    // Single-use: burn the nonce.
    await AuthNonce.deleteOne({ _id: stored._id });

    req.signedWallet = wallet;
    return next();
  } catch (err) {
    return res.status(500).json({ error: "Auth middleware failure: " + err.message });
  }
}

module.exports = { issueNonce, requireSignedWallet, SIWE_PREFIX };
