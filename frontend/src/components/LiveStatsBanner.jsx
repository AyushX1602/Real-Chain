import React, { useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// LiveStatsBanner — Real-time platform metrics bar.
//
// Grid layout: [LIVE pill] [Properties] [TVL] [Rent distributed] [Holders] [Epochs]
// Fetches /api/stats (cached 30s server-side) and updates on realchain:tx.
// Numbers count up smoothly when the value changes.
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target, durationMs = 800) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  const raf  = useRef(null);

  useEffect(() => {
    if (prev.current === target) return;
    const from  = prev.current;
    const start = performance.now();
    function tick(now) {
      const t      = Math.min(1, (now - start) / durationMs);
      const eased  = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else        prev.current = target;
    }
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, durationMs]);

  return display;
}

function fmtNum(n, decimals = 0) {
  return Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function StatItem({ icon, label, value, prefix = "", suffix = "", decimals = 0, highlight }) {
  const animated = useCountUp(value);
  return (
    <div className="lsb-stat" data-highlight={highlight || undefined}>
      <span className="lsb-icon" aria-hidden="true">{icon}</span>
      <div className="lsb-stat-body">
        <span className="lsb-value">
          {prefix}{fmtNum(animated, decimals)}{suffix}
        </span>
        <span className="lsb-label">{label}</span>
      </div>
    </div>
  );
}

export default function LiveStatsBanner() {
  const [stats, setStats]   = useState(null);
  const [error, setError]   = useState(false);

  async function fetchStats() {
    try {
      const r = await fetch(`${BACKEND_URL}/api/stats`, {
        signal: AbortSignal.timeout?.(8_000),
      });
      if (!r.ok) throw new Error(String(r.status));
      setStats(await r.json());
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 30_000);
    window.addEventListener("realchain:tx", fetchStats);
    return () => {
      clearInterval(id);
      window.removeEventListener("realchain:tx", fetchStats);
    };
  }, []);

  // Hide while loading or when the backend is unreachable.
  if (error || !stats) return null;

  // tvlInr is stored in paisa (×100 from INR) → divide to get human INR.
  const tvl      = (stats.tvlInr       || 0) / 100;
  const rent     =  stats.totalRentPaid || 0;   // already human USDC
  const epochs   =  stats.totalEpochs  || 0;
  const holders  =  stats.activeHolders|| 0;
  const propCnt  =  stats.propertyCount|| 0;

  return (
    <div className="lsb-wrap" role="region" aria-label="Live platform statistics">
      <div className="lsb-inner">

        {/* LIVE pill */}
        <div className="lsb-live-cell">
          <div className="lsb-live-pill">
            <span className="lsb-pulse" aria-hidden="true" />
            Live
          </div>
        </div>

        <StatItem icon="🏢" label="Properties"         value={propCnt} />
        <StatItem icon="💎" label="Total value locked" value={tvl}     prefix="₹" />
        <StatItem icon="💸" label="Rent distributed"   value={rent}    prefix="$" suffix=" USDC" decimals={2} highlight />
        <StatItem icon="👥" label="Active holders"     value={holders} />
        <StatItem icon="📅" label="Rent epochs"        value={epochs}  />

      </div>
    </div>
  );
}
