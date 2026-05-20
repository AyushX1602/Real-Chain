import React, { useMemo } from "react";
import Icon from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// EpochCountdown — shows estimated time until next rent deposit based on the
// median gap (cadence) between past epochs. If < 2 epochs exist, shows "—".
// ─────────────────────────────────────────────────────────────────────────────

export default function EpochCountdown({ epochs, compact = false }) {
  const info = useMemo(() => {
    if (!Array.isArray(epochs) || epochs.length < 2) return null;

    // Sort by timestamp ascending
    const sorted = [...epochs]
      .map((e) => (typeof e === "number" ? e : Number(e.ts || e.timestamp || 0)))
      .filter((t) => t > 0)
      .sort((a, b) => a - b);

    if (sorted.length < 2) return null;

    // Calculate gaps between consecutive epochs
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(sorted[i] - sorted[i - 1]);
    }

    // Median gap
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const mid = Math.floor(sortedGaps.length / 2);
    const medianGap = sortedGaps.length % 2 === 0
      ? (sortedGaps[mid - 1] + sortedGaps[mid]) / 2
      : sortedGaps[mid];

    const lastEpoch = sorted[sorted.length - 1];
    const nextExpected = lastEpoch + medianGap;
    const now = Date.now() / 1000;
    const remaining = Math.max(0, nextExpected - now);

    return { medianGap, remaining, nextExpected, lastEpoch };
  }, [epochs]);

  if (!info) {
    if (compact) return null;
    return (
      <div className="epoch-countdown is-unknown">
        <Icon name="clock" size={12} />
        <span className="text-muted text-xs">Cadence unavailable</span>
      </div>
    );
  }

  const { remaining, medianGap } = info;
  const pct = medianGap > 0 ? Math.min(100, ((medianGap - remaining) / medianGap) * 100) : 0;
  const isOverdue = remaining === 0;

  function fmtDuration(secs) {
    if (secs <= 0) return "Overdue";
    if (secs < 60) return `${Math.round(secs)}s`;
    if (secs < 3600) return `${Math.round(secs / 60)}m`;
    if (secs < 86400) return `${Math.round(secs / 3600)}h`;
    const days = Math.round(secs / 86400);
    return `${days}d`;
  }

  function fmtCadence(secs) {
    if (secs < 3600) return `Every ${Math.round(secs / 60)}m`;
    if (secs < 86400) return `Every ${Math.round(secs / 3600)}h`;
    const days = Math.round(secs / 86400);
    return `Every ${days}d`;
  }

  if (compact) {
    return (
      <div className="epoch-countdown is-compact" title={`Next deposit expected in ${fmtDuration(remaining)}`}>
        <Icon name="clock" size={11} />
        <span style={{ fontWeight: 700, fontSize: 12, color: isOverdue ? "var(--amber-400)" : "var(--text-primary)" }}>
          {isOverdue ? "Due now" : fmtDuration(remaining)}
        </span>
      </div>
    );
  }

  return (
    <div className="epoch-countdown">
      <div className="epoch-countdown-header">
        <span className="flex items-center gap-1">
          <Icon name="clock" size={12} />
          <span style={{ fontWeight: 700, fontSize: 12 }}>Next epoch</span>
        </span>
        <span className="text-xs text-muted">{fmtCadence(medianGap)}</span>
      </div>
      <div className="epoch-countdown-bar">
        <div
          className="epoch-countdown-fill"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="epoch-countdown-label">
        {isOverdue ? (
          <span style={{ color: "var(--amber-400)", fontWeight: 700, fontSize: 12 }}>
            <Icon name="bolt" size={11} /> Deposit expected soon
          </span>
        ) : (
          <span className="text-xs text-muted">~{fmtDuration(remaining)} remaining</span>
        )}
      </div>
    </div>
  );
}
