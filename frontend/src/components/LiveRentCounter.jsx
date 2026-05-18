import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { BACKEND_URL } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// LiveRentCounter — small pill that ticks the global "rent claimed" total
// upward in real time. Source of truth is GET /api/transactions/stats.
// Polls every 12s and tweens the displayed number with requestAnimationFrame
// so the change is visible rather than a jarring jump.
// Renders nothing until the backend confirms a non-zero total — never fakes.
// ─────────────────────────────────────────────────────────────────────────────

const POLL_MS = 12_000;
const TWEEN_MS = 900;

function formatUsd(n) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function LiveRentCounter({ className = "" }) {
  const [target, setTarget] = useState(null);
  const [shown, setShown] = useState(0);
  const rafRef = useRef(0);

  // Poll the backend stats endpoint.
  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const r = await fetch(`${BACKEND_URL}/api/transactions/stats`);
        if (!r.ok) return;
        const data = await r.json();
        if (!alive) return;
        const t = Number(data?.totalClaimed ?? 0);
        if (Number.isFinite(t)) setTarget(t);
      } catch { /* offline — keep last known target */ }
    }
    pull();
    const id = setInterval(pull, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Tween shown → target whenever the target moves.
  useEffect(() => {
    if (target == null) return undefined;
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const from = shown;
    const to = target;
    function tick(now) {
      const t = Math.min(1, (now - start) / TWEEN_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (target == null || target <= 0) return null;

  return (
    <div className={`live-rent-pill ${className}`} role="status" aria-live="polite">
      <span className="live-rent-dot" aria-hidden="true" />
      <span className="live-rent-label">
        <Icon name="coins" size={12} /> Rent claimed protocol-wide
      </span>
      <span className="live-rent-value tabular">{formatUsd(shown)}</span>
    </div>
  );
}
