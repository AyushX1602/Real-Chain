import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { BACKEND_URL } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// ActivityFeed — right-rail panel that polls /api/transactions every 8s.
// Pulls real transactions from the Express backend. When the backend is
// unreachable or returns nothing, renders a clean empty state — no fake data.
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
  if (!Number.isFinite(n)) return "$0.00";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

// Classify a fetch failure into something the user can act on. The default
// browser message ("Failed to fetch") is uniquely unhelpful — it covers
// connection refused, DNS failures, CORS preflight rejection, mixed-content
// blocks, and ad-blockers, all under the same string. We can't tell them
// apart from inside the page, but we can at least hint at the common causes.
function classifyFetchError(err) {
  if (err?.name === "AbortError" || err?.name === "TimeoutError") {
    return "Request timed out — backend may be starting up or overloaded.";
  }
  const msg = String(err?.message || err || "");
  if (/^\d{3}$/.test(msg)) return `Backend responded with HTTP ${msg}.`;
  if (/Failed to fetch|NetworkError|ERR_CONNECTION/i.test(msg)) {
    return "Could not reach the backend (connection refused, CORS, or blocked by a browser extension).";
  }
  return msg || "Unknown error";
}

export default function ActivityFeed() {
  const [items, setItems]   = useState([]);
  const [status, setStatus] = useState("loading"); // loading | online | offline
  const [reason, setReason] = useState(null);      // human-readable failure cause

  // Consecutive-failure counter. We only flip the badge to "offline" after
  // two failures in a row so a single transient hiccup (slow cold start,
  // network blip) doesn't spook the user.
  const failsRef = useRef(0);
  const aliveRef = useRef(true);
  const timerRef = useRef(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    aliveRef.current = true;

    async function fetchOnce() {
      // Per-request timeout. Some misconfigured proxies leave the socket open
      // forever; without this the UI would sit on "loading" indefinitely.
      const ctrl = new AbortController();
      const to   = setTimeout(() => ctrl.abort(), 6000);
      try {
        const r = await fetch(`${BACKEND_URL}/api/transactions?limit=20`, { signal: ctrl.signal });
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        if (!aliveRef.current) return;
        const list = Array.isArray(data) ? data : (data.transactions || data.items || []);
        setItems(list);
        setStatus("online");
        setReason(null);
        failsRef.current = 0;
      } catch (err) {
        if (!aliveRef.current) return;
        failsRef.current += 1;
        setReason(classifyFetchError(err));
        // First miss: stay on "loading" so the badge doesn't flicker. Second
        // miss in a row: commit to "offline" and clear the list.
        if (failsRef.current >= 2) {
          setItems([]);
          setStatus("offline");
        }
      } finally {
        clearTimeout(to);
        if (aliveRef.current) timerRef.current = setTimeout(fetchOnce, POLL_MS);
      }
    }

    fetchOnce();
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [retryNonce]);

  // Manual retry: reset the counter, drop back to "loading", and re-run the
  // effect. Beats waiting 8 s for the next poll tick.
  const retry = () => {
    failsRef.current = 0;
    setStatus("loading");
    setReason(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    setRetryNonce((n) => n + 1);
  };

  return (
    <aside className="activity-card" aria-label="Live activity feed">
      <div className="activity-head">
        <h3>
          <span className="status-dot" aria-hidden="true" />
          Live activity
        </h3>
        {status === "offline" ? (
          <span className="badge badge-danger" title="Backend unreachable">
            <Icon name="alert" size={11} /> offline
          </span>
        ) : status === "online" ? (
          <span className="badge badge-success">
            <Icon name="check" size={11} /> online
          </span>
        ) : (
          <span className="badge badge-muted">
            <span className="spinner" style={{ width: 11, height: 11, borderWidth: 1.5 }} />
          </span>
        )}
      </div>

      <div className="activity-list">
        {items.length === 0 ? (
          <div className="activity-empty">
            <Icon name="history" size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>
              {status === "offline"
                ? "Activity feed unavailable"
                : status === "loading"
                  ? "Connecting…"
                  : "No transactions yet"}
            </div>
            <div style={{ fontSize: 12, marginTop: 4, maxWidth: 280 }}>
              {status === "offline" ? (
                <>
                  Backend at <code>{BACKEND_URL}</code> didn’t respond.
                  {reason && (
                    <div style={{ marginTop: 4, opacity: 0.75 }}>{reason}</div>
                  )}
                  <button
                    type="button"
                    onClick={retry}
                    className="btn btn-ghost"
                    style={{ marginTop: 10, padding: "4px 10px", fontSize: 12 }}
                  >
                    <Icon name="refresh" size={11} /> Retry now
                  </button>
                </>
              ) : status === "loading" ? (
                "Reaching backend…"
              ) : (
                "Claim, buy, or deposit rent to see it appear here."
              )}
            </div>
          </div>
        ) : items.slice(0, 10).map((t, i) => {
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
