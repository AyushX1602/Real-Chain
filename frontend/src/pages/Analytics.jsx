import React, { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { BACKEND_URL } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// Analytics — protocol-wide chart page. Pulls live data from:
//   GET /api/transactions/stats          (top KPIs)
//   GET /api/transactions/timeseries?bucket=day   (daily series)
//
// Renders four KPI tiles, a daily volume bar chart, and a UGF vs ETH gas split.
// All zero values render as "—" so the page never lies about activity.
// ─────────────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [series, setSeries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          fetch(`${BACKEND_URL}/api/transactions/stats`),
          fetch(`${BACKEND_URL}/api/transactions/timeseries?bucket=day`),
        ]);
        if (!alive) return;
        if (a.ok) setStats(await a.json());
        if (b.ok) setSeries(await b.json());
        if (!a.ok && !b.ok) setError("Backend unreachable");
      } catch (e) {
        if (alive) setError(e?.message || "Backend unreachable");
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="container reveal">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Protocol <span className="accent">analytics</span></h1>
            <p>Live aggregates from the Express + MongoDB backend. Updated each time the page loads.</p>
          </div>
          <span className={`badge ${error ? "badge-danger" : "badge-success"}`}>
            <Icon name={error ? "alert" : "check"} size={11} /> {error ? "Offline" : "Live"}
          </span>
        </div>
      </div>

      {error && (
        <div className="banner banner-warn" style={{ marginBottom: 24 }}>
          <Icon name="alert" size={14} /> {error} — start the backend at {BACKEND_URL} to see live data.
        </div>
      )}

      {/* KPIs */}
      <div className="stats-row" style={{ marginBottom: 32 }}>
        <KpiTile icon="history" label="Total transactions" value={stats?.totalTransactions} />
        <KpiTile icon="bolt"    label="Gasless via UGF"    value={stats?.ugfTransactions} />
        <KpiTile icon="coins"   label="Rent claimed"       value={stats?.totalClaimed}  money />
        <KpiTile icon="trending" label="Tokens bought"      value={stats?.totalInvested} money />
      </div>

      {/* Daily volume bars */}
      <div className="section">
        <h2 className="section-title"><Icon name="history" size={14} /> Daily activity</h2>
        <div className="card card-elevated">
          <div className="card-body">
            <DailyBars points={series?.daily ?? []} />
          </div>
        </div>
      </div>

      {/* Gas split */}
      <div className="section">
        <h2 className="section-title"><Icon name="bolt" size={14} /> Gas method split</h2>
        <div className="card card-elevated">
          <div className="card-body">
            <GasSplit ugf={stats?.ugfTransactions ?? 0} total={stats?.totalTransactions ?? 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ icon, label, value, money = false }) {
  const v = Number(value);
  const display = (value === undefined || value === null || !Number.isFinite(v))
    ? "—"
    : money
      ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : v.toLocaleString("en-US");
  return (
    <div className="stat-card">
      <div className="stat-label"><Icon name={icon} size={12} /> {label}</div>
      <div className="stat-value">{display}</div>
    </div>
  );
}

// ── Daily bars (inline SVG, no charting dep) ────────────────────────────────
function DailyBars({ points }) {
  if (!Array.isArray(points) || points.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 32 }}>
        <span className="emoji" style={{ width: 56, height: 56 }}><Icon name="history" size={20} /></span>
        <h3>No activity yet</h3>
        <p>Daily volume will appear once transactions are logged through the API.</p>
      </div>
    );
  }
  const max = Math.max(1, ...points.map((p) => Number(p.count || 0)));
  const W = 800;
  const H = 220;
  const bw = W / points.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H }} role="img" aria-label="Daily transactions">
      {/* baseline */}
      <line x1="0" y1={H - 24} x2={W} y2={H - 24} stroke="#191A23" strokeWidth="2" />
      {points.map((p, i) => {
        const c = Number(p.count || 0);
        const h = (c / max) * (H - 50);
        return (
          <g key={p.day || i}>
            <rect
              x={i * bw + 4}
              y={H - 24 - h}
              width={bw - 8}
              height={h}
              fill="#B9FF66"
              stroke="#191A23"
              strokeWidth="1.5"
              rx="6"
            >
              <title>{`${p.day}: ${c} tx · $${Number(p.volume || 0).toFixed(2)}`}</title>
            </rect>
            {(i === 0 || i === points.length - 1 || i % Math.max(1, Math.floor(points.length / 6)) === 0) && (
              <text
                x={i * bw + bw / 2}
                y={H - 6}
                textAnchor="middle"
                fontFamily="Space Grotesk, sans-serif"
                fontSize="11"
                fill="#191A23"
                opacity="0.7"
              >
                {String(p.day || "").slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function GasSplit({ ugf, total }) {
  const eth = Math.max(0, total - ugf);
  if (total === 0) {
    return <div className="text-muted">No transactions logged yet.</div>;
  }
  const pctUgf = (ugf / total) * 100;
  const pctEth = (eth / total) * 100;
  return (
    <div>
      <div className="gas-split-bar">
        <div className="gas-split-ugf" style={{ width: `${pctUgf}%` }} title={`UGF ${pctUgf.toFixed(1)}%`} />
        <div className="gas-split-eth" style={{ width: `${pctEth}%` }} title={`ETH ${pctEth.toFixed(1)}%`} />
      </div>
      <div className="gas-split-legend">
        <span className="badge badge-accent">
          <Icon name="bolt" size={11} /> UGF {ugf} ({pctUgf.toFixed(1)}%)
        </span>
        <span className="badge badge-muted">
          <Icon name="alert" size={11} /> ETH {eth} ({pctEth.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}
