import React, { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { BACKEND_URL } from "../config/contracts";
import {
  KpiTile,
  IndexerStatus,
  HolderConcentrationStrip,
  WalletShort,
} from "../components/ScreenPrimitives";

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
  const [holders, setHolders] = useState([]);  // [{ propertyId, name, top5 }]
  const [leaders, setLeaders] = useState([]);
  const [error, setError] = useState(null);
  const [lastUpdatedMs, setLastUpdatedMs] = useState(null);

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
        else setLastUpdatedMs(Date.now());
      } catch (e) {
        if (alive) setError(e?.message || "Backend unreachable");
      }
    })();

    // Holder concentration per property — best-effort; populates lazily.
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/properties`);
        if (!r.ok) return;
        const data = await r.json();
        const list = Array.isArray(data) ? data : (data?.properties || []);
        const out = [];
        for (const p of list.slice(0, 12)) {
          try {
            const h = await fetch(`${BACKEND_URL}/api/properties/${p.id ?? p._id}/holders`);
            if (!h.ok) continue;
            const dh = await h.json();
            const holders = Array.isArray(dh?.holders) ? dh.holders : Array.isArray(dh) ? dh : [];
            // Server-side sharePct is preferred when present; otherwise compute.
            let top5;
            if (holders.length > 0 && typeof holders[0]?.sharePct === "number") {
              top5 = holders.slice(0, 5).map((x) => Number(x.sharePct));
            } else {
              const sorted = holders.slice().sort((x, y) => Number(y.balance) - Number(x.balance));
              const total = sorted.reduce((s, x) => s + Number(x.balance), 0);
              if (total === 0) continue;
              top5 = sorted.slice(0, 5).map((x) => Math.round((Number(x.balance) / total) * 1000) / 10);
            }
            out.push({ propertyId: p.id ?? p._id, name: p.name, top5 });
          } catch { /* skip property */ }
        }
        if (alive) setHolders(out);
      } catch { /* indexer offline — leave list empty */ }
    })();

    // Leaderboard — top wallets by lifetime rent received.
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/users/leaderboard/top?limit=10`);
        if (!r.ok) return;
        const data = await r.json();
        const rows = Array.isArray(data) ? data : (data?.leaders || []);
        if (alive) setLeaders(rows);
      } catch { /* leave empty */ }
    })();

    return () => { alive = false; };
  }, []);

  return (
    <div className="container reveal">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Protocol <span className="accent">analytics</span></h1>
            <p>Live aggregates from the Express + MongoDB indexer. Hover any tile to see its on-chain source.</p>
          </div>
          <IndexerStatus offline={Boolean(error)} lastUpdatedMs={lastUpdatedMs} />
        </div>
      </div>

      {error && (
        <div className="banner banner-warn" style={{ marginBottom: 24 }}>
          <Icon name="alert" size={14} /> {error} — start the backend at {BACKEND_URL} to see live data.
        </div>
      )}

      {/* KPIs with hover-revealed contract source */}
      <div className="stats-row" style={{ marginBottom: 32 }}>
        <KpiTile
          icon="history"
          label="Total transactions"
          value={fmtCount(stats?.totalTransactions)}
          sourceText="Sourced from Marketplace + RentalDistribution events via indexer"
        />
        <KpiTile
          icon="bolt"
          label="Gasless via UGF"
          value={fmtCount(stats?.ugfTransactions)}
          tone="accent"
          sourceText="Tx records where gasMethod === 'ugf'"
        />
        <KpiTile
          icon="coins"
          label="Rent claimed"
          value={fmtMoney(stats?.totalClaimed)}
          tone="dark"
          sourceText="Sum of RentalDistribution.claim / claimAll amounts"
        />
        <KpiTile
          icon="trending"
          label="Tokens bought"
          value={fmtMoney(stats?.totalInvested)}
          sourceText="Sum of Marketplace.buyFromOwner + buyFromListing volumes"
        />
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

      {/* Holder concentration leaderboard */}
      <div className="section">
        <h2 className="section-title"><Icon name="users" size={14} /> Holder concentration</h2>
        <div className="card card-elevated">
          <div className="card-body">
            {holders.length === 0 ? (
              <div className="text-muted" style={{ padding: 12 }}>
                Concentration data appears once the indexer sees its first <code>Transfer</code> event per property.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {holders.map((h) => (
                  <div key={h.propertyId} style={{
                    display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, alignItems: "center",
                    padding: 12, border: "1px solid #191A23", borderRadius: 10, background: "#fff",
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{h.name || `Property #${h.propertyId}`}</div>
                    <HolderConcentrationStrip shares={h.top5} label="Top-5" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lifetime-rent leaderboard */}
      <div className="section">
        <h2 className="section-title"><Icon name="trending" size={14} /> Lifetime rent leaderboard</h2>
        <div className="card card-elevated">
          <div className="card-body" style={{ padding: 0 }}>
            {leaders.length === 0 ? (
              <div className="text-muted" style={{ padding: 18 }}>
                Leaderboard populates once wallets begin claiming rent.
              </div>
            ) : (
              <div>
                {leaders.slice(0, 10).map((row, i) => (
                  <div key={row.address || i} className="sp-compact-row" style={{ gridTemplateColumns: "32px 1fr auto" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#191A23" }}>#{i + 1}</div>
                    <WalletShort address={row.address || row.wallet} />
                    <div style={{ fontWeight: 800, fontFeatureSettings: "'tnum' on" }}>
                      ${Number(row.lifetimeRentUsd ?? row.lifetimeRent ?? row.amount ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

function fmtCount(v) {
  const n = Number(v);
  return (v == null || !Number.isFinite(n)) ? "—" : n.toLocaleString("en-US");
}
function fmtMoney(v) {
  const n = Number(v);
  return (v == null || !Number.isFinite(n)) ? "—" : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
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
