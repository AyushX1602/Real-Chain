import React, { useMemo, useState } from "react";
import Icon from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// PortfolioChart — cumulative rent earnings visualized as an inline SVG area
// chart on the Investor Dashboard. Same rendering approach as RentChart.jsx
// (zero dependencies) but this one aggregates across ALL properties the user
// holds, showing cumulative earnings growth epoch by epoch.
//
// Props:
//   epochs: Array<{ propertyName: string, id: number, total: bigint, ts: number, ownershipPct: number }>
//   height: number (default 240)
// ─────────────────────────────────────────────────────────────────────────────

const W = 900;
const PAD = { top: 24, right: 20, bottom: 38, left: 60 };

function fmtUsd(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function PortfolioChart({ epochs, height = 260 }) {
  // Sort all epochs by timestamp, compute cumulative user rent earned.
  const { points, totalEarned } = useMemo(() => {
    if (!Array.isArray(epochs) || epochs.length === 0) return { points: [], totalEarned: 0 };

    const sorted = [...epochs]
      .filter((e) => Number.isFinite(Number(e.ts)) && Number(e.ts) > 0)
      .sort((a, b) => a.ts - b.ts);

    let cumulative = 0;
    const pts = sorted.map((e, i) => {
      const epochUsd = (Number(e.total) / 1e6) * (e.ownershipPct / 100);
      cumulative += epochUsd;
      return {
        idx: i,
        cumulative,
        epochUsd,
        ts: e.ts,
        label: e.propertyName || `#${e.id}`,
      };
    });

    return { points: pts, totalEarned: cumulative };
  }, [epochs]);

  const [hover, setHover] = useState(null);

  if (points.length === 0) {
    return (
      <div className="rent-chart-empty">
        <Icon name="trending" size={28} style={{ opacity: 0.45, marginBottom: 8 }} />
        <div>No earnings history yet.</div>
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
          Claim rent or wait for owner deposits to see your portfolio grow.
        </div>
      </div>
    );
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const maxY = Math.max(0.01, ...points.map((p) => p.cumulative));
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const px = (i) => PAD.left + i * step;
  const py = (v) => PAD.top + (1 - v / maxY) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)} ${py(p.cumulative).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${px(points.length - 1).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L ${px(0).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;

  const yTicks = [0, maxY * 0.33, maxY * 0.66, maxY];

  return (
    <div className="rent-chart">
      <div className="rent-chart-head">
        <div>
          <div className="rent-chart-title">
            <Icon name="trending" size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            Cumulative earnings
          </div>
          <div className="rent-chart-meta">
            {points.length} epoch{points.length !== 1 ? "s" : ""} · total earned {fmtUsd(totalEarned)}
          </div>
        </div>
        {hover && (
          <div className="rent-chart-tooltip">
            <span className="badge badge-muted font-mono" style={{ fontSize: 10 }}>{hover.label}</span>
            <span className="rent-chart-tooltip-amt">{fmtUsd(hover.cumulative)}</span>
            <span className="rent-chart-tooltip-date">+{fmtUsd(hover.epochUsd)}</span>
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label="Portfolio earnings chart" className="rent-chart-svg">
        {/* Y-axis grid */}
        {yTicks.map((tick, i) => {
          const y = py(tick);
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#191A23" strokeOpacity="0.1" strokeDasharray={i > 0 ? "4 3" : "none"} />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#191A23" opacity="0.5">
                {fmtUsd(tick)}
              </text>
            </g>
          );
        })}

        {/* X-axis baseline */}
        <line x1={PAD.left} y1={PAD.top + innerH} x2={W - PAD.right} y2={PAD.top + innerH} stroke="#191A23" strokeWidth="1.5" />

        {/* Gradient area */}
        <defs>
          <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B9FF66" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#B9FF66" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#portfolioGrad)" stroke="none" />
        <path d={linePath} fill="none" stroke="#191A23" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Points + hover zones */}
        {points.map((p, i) => {
          const cx = px(i);
          const cy = py(p.cumulative);
          const active = hover?.idx === p.idx;
          return (
            <g key={i}>
              <rect
                x={cx - Math.max(10, step / 2)} y={PAD.top}
                width={Math.max(20, step)} height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`Cumulative: ${fmtUsd(p.cumulative)} after epoch from ${p.label}`}
              />
              <circle cx={cx} cy={cy} r={active ? 6 : 3.5} fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
