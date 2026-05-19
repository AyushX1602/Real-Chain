import { useEffect, useState } from "react";
import { BACKEND_URL, ETH_USD_RATE as ENV_RATE } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// useMarketPrice — single source of truth for ETH/USD across the app.
//
// Resolution order (matches the backend route's contract):
//   1. /api/market/price        live (cached server-side for 5 minutes)
//   2. ENV_RATE                 build-time fallback (defaults to 2000)
//
// Behaviour:
//   - Returns the env value synchronously while the fetch is pending so the
//     CostBanner / SmartAgent never wait for the network just to render an
//     order-of-magnitude number.
//   - Background-refreshes once on mount; consumers receive the new rate via
//     the returned `rate`. No polling — the server already caches.
//   - All errors are swallowed; the env rate is always a valid fallback.
// ─────────────────────────────────────────────────────────────────────────────

let _cached = null;       // { value, source, fetchedAt }
let _inflight = null;     // shared promise so concurrent hooks don't fan out

async function loadRate() {
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/market/price`, {
        signal: AbortSignal.timeout?.(4_000),
      });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      const v = Number(data?.value);
      if (!Number.isFinite(v) || v <= 0) throw new Error("invalid");
      _cached = { value: v, source: data?.source || "backend", fetchedAt: Date.now() };
      return _cached;
    } catch {
      _cached = { value: ENV_RATE, source: "env", fetchedAt: Date.now() };
      return _cached;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

export default function useMarketPrice() {
  const [snap, setSnap] = useState(_cached || { value: ENV_RATE, source: "env", fetchedAt: 0 });

  useEffect(() => {
    let alive = true;
    // Skip the network if the cache is fresh-ish (< 5 min) — matches the
    // server's TTL so we don't double-fetch right after another component
    // already populated the cache.
    const age = _cached ? Date.now() - _cached.fetchedAt : Infinity;
    if (age < 5 * 60 * 1000 && _cached) {
      setSnap(_cached);
      return undefined;
    }
    loadRate().then((data) => { if (alive) setSnap(data); });
    return () => { alive = false; };
  }, []);

  return snap.value;
}

// Imperative variant for non-React callers (e.g. SmartAgentContext heuristics
// that need a price during a one-shot computation, not in render).
export function getEthUsdRateSync() {
  return _cached?.value ?? ENV_RATE;
}
export function getEthUsdRateAsync() {
  return loadRate().then((d) => d.value);
}
