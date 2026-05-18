import React, { useMemo, useState } from "react";
import Icon from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// RentChart — inline SVG line + area chart of rent per epoch for a property.
// No charting dependency on purpose; the dataset is at most a few dozen points
// and the visual budget is "fits the Positivus aesthetic". Lime fill, black
// line, black axis baseline, currentColor labels.
//
// Props:
//   data: Array<{ id: number, total: bigint, ts: number }>  // ts in seconds
//   height: number (default 220)
// ─────────────────────────────────────────────────────────────────────────────

const W = 800;
const PAD = { top: 24, right: 16, bottom: 36, left: 56 };

function formatUsd(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function formatDate(ts) {
  return new Date(ts * 1000).toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}

export default function RentChart({ data, height = 240 }) {
  const points = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    return data
      .map((e) => ({
        id: Number(e.id ?? 0),
        usd: Number(e.total) / 1e6,
        ts: Number(e.ts ?? 0),
      }))
      .filter((d) => Number.isFinite(d.usd) && Number.isFinite(d.ts))
      .sort((a, b) => a.id - b.id);
  }, [data]);

  const [hover, setHover] = useState(null);

  if (points.length === 0) {
    return (
      <div className="rent-chart-empty">
        <Icon name="history" size={28} style={{ opacity: 0.45, marginBottom: 8 }} />
        <div>No rent history yet.</div>
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
          The owner hasn't deposited rent for this property.
        </div>
      </div>
    );
  }

  // Scale: x = pad.left + i * step ; y = top + (1 - usd/maxUsd) * innerH.
  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const maxUsd = Math.max(1, ...points.map((p) => p.usd));
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  function px(i) { return PAD.left + i * step; }
  function py(usd) { return PAD.top + (1 - usd / maxUsd) * innerH; }

  // Build the line + area path.
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(2)} ${py(p.usd).toFixed(2)}`).join(" ");
  const areaPath = points.length > 0
    ? `${linePath} L ${px(points.length - 1).toFixed(2)} ${(PAD.top + innerH).toFixed(2)} L ${px(0).toFixed(2)} ${(PAD.top + innerH).toFixed(2)} Z`
    : "";

  // Y-axis ticks (3 evenly spaced).
  const yTicks = [0, maxUsd / 2, maxUsd];

  // Total deposited across the visible window.
  const total = points.reduce((sum, p) => sum + p.usd, 0);

  return (
    <div className="rent-chart">
      <div className="rent-chart-head">
        <div>
          <div className="rent-chart-title">Rent per epoch</div>
          <div className="rent-chart-meta">
            {points.length} {points.length === 1 ? "epoch" : "epochs"} · total {formatUsd(total)}
          </div>
        </div>
        {hover && (
          <div className="rent-chart-tooltip">
            <span className="badge badge-muted font-mono">#{hover.id}</span>
            <span className="rent-chart-tooltip-amt">{formatUsd(hover.usd)}</span>
            <span className="rent-chart-tooltip-date">{formatDate(hover.ts)}</span>
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label="Rent per epoch chart" className="rent-chart-svg">
        {/* Y-axis grid lines + labels */}
        {yTicks.map((tick, i) => {
          const y = py(tick);
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#191A23" strokeOpacity="0.12" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="11" fill="#191A23" opacity="0.6">
                {formatUsd(tick)}
              </text>
            </g>
          );
        })}

        {/* X-axis baseline */}
        <line x1={PAD.left} y1={PAD.top + innerH} x2={W - PAD.right} y2={PAD.top + innerH} stroke="#191A23" strokeWidth="2" />

        {/* Area under line — solid lime */}
        <path d={areaPath} fill="#B9FF66" stroke="none" />
        {/* Line on top */}
        <path d={linePath} fill="none" stroke="#191A23" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Points + hover hit zones */}
        {points.map((p, i) => {
          const cx = px(i);
          const cy = py(p.usd);
          const active = hover?.id === p.id;
          return (
            <g key={p.id}>
              {/* Wide invisible hit area for easy hover */}
              <rect
                x={cx - step / 2}
                y={PAD.top}
                width={Math.max(20, step)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`Epoch ${p.id}: ${formatUsd(p.usd)} on ${formatDate(p.ts)}`}
              />
              <circle cx={cx} cy={cy} r={active ? 6 : 4} fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
              {/* X-axis label every Nth point so it doesn't crowd. */}
              {(i === 0 || i === points.length - 1 || i % Math.max(1, Math.floor(points.length / 6)) === 0) && (
                <text
                  x={cx}
                  y={PAD.top + innerH + 22}
                  textAnchor="middle"
                  fontFamily="Space Grotesk, sans-serif"
                  fontSize="11"
                  fill="#191A23"
                  opacity="0.7"
                >
                  #{p.id}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
