import React, { useEffect, useState, useRef, useCallback } from "react";
import Icon from "./Icon";
import { BACKEND_URL } from "../config/contracts";
import { useWeb3 } from "../context/Web3Context";

// ─────────────────────────────────────────────────────────────────────────────
// NotificationBell — real-time notification system.
// Polls /api/transactions every 12s for new events relevant to the connected
// wallet. Shows a red badge with unread count and a dropdown with recent items.
// Notifications persist in localStorage so dismiss state survives refresh.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "realchain-notif-seen";
const POLL_MS = 12_000;

function getSeenSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch { return new Set(); }
}
function persistSeen(set) {
  const arr = [...set].slice(-200); // keep last 200
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

export default function NotificationBell() {
  const { account } = useWeb3();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(getSeenSet);
  const wrapRef = useRef(null);

  const fetchNotifs = useCallback(async () => {
    if (!account) return;
    try {
      // Fetch recent txs that involve this wallet
      const r = await fetch(`${BACKEND_URL}/api/transactions?limit=20`);
      if (!r.ok) return;
      const data = await r.json();
      const txs = data.transactions || [];
      // Build notifications from txs
      const notifs = txs.map((tx) => {
        const id = tx._id || tx.txHash;
        let message = "";
        let icon = "info";
        const action = tx.action || tx.type;
        if (action === "deposit" && tx.from?.toLowerCase() !== account.toLowerCase()) {
          message = `New rent deposited: $${Number(tx.amount || 0).toFixed(2)} — claim available`;
          icon = "coins";
        } else if (action === "buy" && tx.from?.toLowerCase() === account.toLowerCase()) {
          message = `You bought tokens worth $${Number(tx.amount || 0).toFixed(2)}`;
          icon = "trending";
        } else if (action === "claim" && tx.from?.toLowerCase() === account.toLowerCase()) {
          message = `Rent claimed: $${Number(tx.amount || 0).toFixed(2)}`;
          icon = "bolt";
        } else if (action === "deposit") {
          message = `Rent epoch deposited: $${Number(tx.amount || 0).toFixed(2)}`;
          icon = "coins";
        } else if (action === "listing") {
          message = `New listing created by ${(tx.from || "").slice(0, 8)}…`;
          icon = "send";
        } else {
          message = `${action || "tx"}: $${Number(tx.amount || 0).toFixed(2)}`;
          icon = "history";
        }
        return {
          id,
          message,
          icon,
          time: tx.createdAt ? new Date(tx.createdAt) : new Date(),
          gasMethod: tx.gasMethod,
        };
      });
      setItems(notifs);
    } catch { /* backend offline */ }
  }, [account]);

  // Poll
  useEffect(() => {
    fetchNotifs();
    const timer = setInterval(fetchNotifs, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchNotifs]);

  // Listen for realchain:tx events for instant updates
  useEffect(() => {
    function onTx() { fetchNotifs(); }
    window.addEventListener("realchain:tx", onTx);
    return () => window.removeEventListener("realchain:tx", onTx);
  }, [fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const unread = items.filter((n) => !seen.has(n.id)).length;

  function markAllRead() {
    const next = new Set(seen);
    items.forEach((n) => next.add(n.id));
    setSeen(next);
    persistSeen(next);
  }

  function handleOpen() {
    setOpen((o) => !o);
  }

  function fmtTime(d) {
    if (!(d instanceof Date) || isNaN(d)) return "";
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }

  if (!account) return null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        className="icon-btn"
        onClick={handleOpen}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        style={{ position: "relative" }}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            width: 16, height: 16, borderRadius: "50%",
            background: "#ef4444", color: "#fff",
            fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            lineHeight: 1, border: "2px solid var(--bg-primary)",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" role="menu">
          <div className="notif-header">
            <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
            {unread > 0 && (
              <button className="btn btn-ghost btn-xs" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 ? (
              <div className="notif-empty">
                <Icon name="bell" size={16} />
                <span>No notifications yet</span>
              </div>
            ) : (
              items.slice(0, 15).map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${!seen.has(n.id) ? "is-unread" : ""}`}
                >
                  <span className="notif-icon">
                    <Icon name={n.icon} size={12} />
                  </span>
                  <div className="notif-body">
                    <span className="notif-msg">{n.message}</span>
                    <span className="notif-time">{fmtTime(n.time)}</span>
                  </div>
                  {n.gasMethod === "ugf" && (
                    <span className="badge badge-accent" style={{ fontSize: 9, padding: "1px 5px" }}>UGF</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
