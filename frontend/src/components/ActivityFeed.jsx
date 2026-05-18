import React, { useEffect, useState, useMemo } from "react";
import Icon from "./Icon";
import { BACKEND_URL } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// ActivityFeed — right-rail panel that polls /api/transactions every 8s.
// Degrades gracefully: shows "feed offline" inline if backend unreachable.
// ─────────────────────────────────────────────────────────────────────────────

const POLL_MS = 8000;

const VERB = {
  claim:   "claimed",
  buy:     "bought tokens for",
  sell:    "sold tokens for",
  deposit: "deposited rent of",
  listing: "listed tokens for",
  cancel:  "cancelled a listing",
};

function timeAgo(ts) {
  if (!ts) return "";
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function shortAddr(a) {
  if (!a) return "0x…";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function avatarKind(type) {
  if (type === "deposit") return "is-deposit";
  if (type === "buy" || type === "sell") return "is-buy";
  return "";
}

function fmtAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export default function ActivityFeed() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | online | offline

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function fetchOnce() {
      try {
        const r = await fetch(`${BACKEND_URL}/api/transactions?limit=20`);
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        if (!alive) return;
        const list = Array.isArray(data) ? data : (data.transactions || data.items || []);
        setItems(list);
        setStatus("online");
      } catch (_) {
        if (!alive) return;
        setStatus("offline");
      } finally {
        if (alive) timer = setTimeout(fetchOnce, POLL_MS);
      }
    }

    fetchOnce();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);

  const sample = useMemo(() => SAMPLE_FEED, []);
  const display = items.length > 0 ? items : (status === "offline" ? sample : []);

  return (
    <aside className="activity-card" aria-label="Live activity feed">
      <div className="activity-head">
        <h3>
          <span className="status-dot" aria-hidden="true" />
          Live activity
        </h3>
        {status === "offline" ? (
          <span className="badge badge-muted" title="Backend unreachable — showing sample data">
            <Icon name="info" size={11} /> demo
          </span>
        ) : status === "online" ? (
          <span className="badge badge-success">
            <Icon name="check" size={11} /> online
          </span>
        ) : (
          <span className="badge badge-muted"><span className="spinner" style={{ width: 11, height: 11, borderWidth: 1.5 }} /></span>
        )}
      </div>

      <div className="activity-list">
        {display.length === 0 ? (
          <div className="activity-empty">
            <Icon name="history" size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>No transactions yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Claim some rent to kick things off.</div>
          </div>
        ) : display.slice(0, 10).map((t, i) => {
          const type = t.type || "claim";
          const verb = VERB[type] || "did";
          const isUgf = (t.gasMethod || t.method) === "ugf";
          return (
            <div className="activity-row" key={t.txHash || t._id || i}>
              <div className={`activity-avatar ${avatarKind(type)}`}>
                <Icon
                  name={type === "deposit" ? "send" : type === "buy" ? "wallet" : type === "claim" ? "claim" : "spark"}
                  size={14}
                />
              </div>
              <div className="activity-body">
                <div className="activity-line">
                  <span className="addr">{shortAddr(t.from)}</span>
                  {" "}{verb}{" "}
                  <span className="amt">{fmtAmount(t.amount ?? t.amountUsd ?? 0)}</span>
                </div>
                <div className="activity-meta">
                  <span>{timeAgo(t.createdAt || t.timestamp)}</span>
                  <span>·</span>
                  <span className={`badge ${isUgf ? "badge-accent" : "badge-muted"}`} style={{ padding: "2px 8px" }}>
                    {isUgf ? <Icon name="drop" size={10} /> : <Icon name="alert" size={10} />}
                    {isUgf ? "gasless" : "ETH gas"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// Stable demo data so the panel never looks empty during the pitch.
const SAMPLE_FEED = [
  { from: "0xa7Fa1328a934c83bdf8a30dd71d3aA8c12bd9bc3b", type: "claim",   amount: 300.00, gasMethod: "ugf", createdAt: new Date(Date.now() - 35_000).toISOString() },
  { from: "0xC4f9fE3742F4a55a6e9F2dD5f1bdc9dB5e8b9dC1c", type: "buy",     amount: 60.00,  gasMethod: "ugf", createdAt: new Date(Date.now() - 4 * 60_000).toISOString() },
  { from: "0x9F4adC3c982AaB1f2e35aF4b2C9bdfaB8c4f5Ec3D", type: "deposit", amount: 1000.0, gasMethod: "ugf", createdAt: new Date(Date.now() - 12 * 60_000).toISOString() },
  { from: "0x21e90a1C5f6dC4b3aF34d66cF7e1aDc4b89E5fA21", type: "claim",   amount: 87.45,  gasMethod: "eth", createdAt: new Date(Date.now() - 28 * 60_000).toISOString() },
  { from: "0x8B17e0F9b9C4dEa1a02C3D9f1E2b4Ad5cF6A7B8C9", type: "claim",   amount: 142.10, gasMethod: "ugf", createdAt: new Date(Date.now() - 47 * 60_000).toISOString() },
];
