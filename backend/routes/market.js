const express = require("express");
const router = express.Router();
const logger = require("../logger");

// ─────────────────────────────────────────────────────────────────────────────
// /api/market — auxiliary market-data routes for the frontend.
//
// Today this serves a single endpoint: GET /api/market/price → ETH/USD.
// Used by the cost banner and the SmartAgent worth-it heuristic so we can
// drop the build-time `VITE_ETH_USD_RATE` constant in favour of a single,
// reactive source of truth.
//
// Source ordering:
//   1. Env override         MARKET_ETH_USD_RATE        (instant, deterministic)
//   2. Coingecko free tier  https://api.coingecko.com  (cached for 5 minutes)
//   3. Hardcoded fallback   2000                       (so demos never break)
//
// We deliberately keep this decoupled from any paid feed — the project is a
// hackathon submission and a noisy 0.5% drift in ETH/USD does not change any
// claim decision the user is about to make.
// ─────────────────────────────────────────────────────────────────────────────

const TTL_MS = 5 * 60 * 1000;
const FALLBACK = 2000;
let cache = { value: null, fetchedAt: 0, source: "fallback" };

async function fetchCoingecko() {
  if (typeof fetch !== "function") return null; // older Node without global fetch
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`coingecko ${r.status}`);
    const data = await r.json();
    const v = Number(data?.ethereum?.usd);
    if (!Number.isFinite(v) || v <= 0) throw new Error("invalid price");
    return v;
  } catch (err) {
    logger.debug({ err: err.message }, "market: coingecko fetch failed");
    return null;
  }
}

async function getEthUsd() {
  // 1) Env override is authoritative.
  const envRate = Number(process.env.MARKET_ETH_USD_RATE);
  if (Number.isFinite(envRate) && envRate > 0) {
    return { value: envRate, source: "env", fetchedAt: Date.now() };
  }
  // 2) Cached coingecko within TTL.
  if (cache.value && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache;
  }
  // 3) Fresh coingecko, falling back to last cached or the hardcoded default.
  const fresh = await fetchCoingecko();
  if (fresh != null) {
    cache = { value: fresh, fetchedAt: Date.now(), source: "coingecko" };
    return cache;
  }
  if (cache.value) return cache; // stale-but-better-than-nothing
  cache = { value: FALLBACK, fetchedAt: Date.now(), source: "fallback" };
  return cache;
}

router.get("/price", async (_req, res) => {
  try {
    const { value, source, fetchedAt } = await getEthUsd();
    res.json({
      pair:      "ETH/USD",
      value,
      source,
      fetchedAt: new Date(fetchedAt).toISOString(),
      ttlSeconds: Math.max(0, Math.floor((TTL_MS - (Date.now() - fetchedAt)) / 1000)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
