const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");

// ─────────────────────────────────────────────────────────────────────────────
// /api/faucet/usdc — server-side mint of 100 mock USDC.
//
// Requires FAUCET_PRIVATE_KEY (or PRIVATE_KEY) and VITE_MOCK_USDC_ADDRESS in
// the root .env. If either is missing, returns 503 with a clear hint so the
// frontend toast says "faucet unavailable" but the rest of the UI keeps working.
// ─────────────────────────────────────────────────────────────────────────────

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per wallet
const _lastMint = new Map();        // in-memory rate limit

const MOCK_USDC_ABI = [
  "function mint(address,uint256) external",
  "function transfer(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

function getEnv(name, fallback) {
  return process.env[name] && process.env[name].length > 0 ? process.env[name] : fallback;
}

router.post("/usdc", async (req, res) => {
  try {
    const { wallet } = req.body || {};
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }

    const now = Date.now();
    const last = _lastMint.get(wallet.toLowerCase()) || 0;
    if (now - last < COOLDOWN_MS) {
      const minsLeft = Math.ceil((COOLDOWN_MS - (now - last)) / 60000);
      return res.status(429).json({ error: `Cooldown — try again in ${minsLeft}m` });
    }

    const pk = getEnv("FAUCET_PRIVATE_KEY", getEnv("PRIVATE_KEY", null));
    if (!pk) {
      return res.status(503).json({
        error: "Faucet not configured",
        hint: "Set FAUCET_PRIVATE_KEY in .env to enable backend minting",
      });
    }

    const usdcAddress = getEnv("VITE_MOCK_USDC_ADDRESS", null);
    if (!usdcAddress) {
      return res.status(503).json({ error: "VITE_MOCK_USDC_ADDRESS not set" });
    }

    const rpcUrl = getEnv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org");
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, provider);
    const usdc = new ethers.Contract(usdcAddress, MOCK_USDC_ABI, signer);

    const amount = 100n * 10n ** 6n; // 100 USDC (6 decimals)
    const tx = await usdc.mint(wallet, amount);
    await tx.wait();

    _lastMint.set(wallet.toLowerCase(), now);
    res.json({ message: "Minted 100 USDC", txHash: tx.hash });
  } catch (err) {
    console.error("[faucet]", err?.message || err);
    res.status(500).json({ error: err?.shortMessage || err?.message || "Faucet error" });
  }
});

router.get("/usdc/:wallet", (req, res) => {
  const wallet = (req.params.wallet || "").toLowerCase();
  const last = _lastMint.get(wallet) || 0;
  const now = Date.now();
  const remaining = Math.max(0, COOLDOWN_MS - (now - last));
  res.json({
    available: remaining === 0,
    nextAvailableInMs: remaining,
    cooldownMs: COOLDOWN_MS,
  });
});

module.exports = router;
