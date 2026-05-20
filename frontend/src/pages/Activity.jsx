import React, { useEffect, useState, useCallback } from "react";
import Icon from "../components/Icon";
import {
  GasMethodBadge,
  OnChainBadge,
  IndexerStatus,
  WalletShort,
} from "../components/ScreenPrimitives";
import { BACKEND_URL } from "../config/contracts";
import TransactionReceipt from "../components/TransactionReceipt";

// ─────────────────────────────────────────────────────────────────────────────
// Activity — full tx log pulled from /api/transactions with filters.
// Replaced the old agent-bus approach with direct fetch for reliability.
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS = ["all", "claim", "buy", "deposit", "listing", "cancel"];
const GAS = ["all", "ugf", "eth"];

function downloadCsv(rows) {
  const header = "Date,Action,Wallet,Amount (USDC),Gas Method,Tx Hash\n";
  const body = rows.map((r) => {
    const date = r.createdAt ? new Date(r.createdAt).toISOString() : "";
    const action = r.action || r.type || "";
    const wallet = r.from || "";
    const amount = Number(r.amount || 0).toFixed(6);
    const gas = r.gasMethod || "eth";
    const tx = r.txHash || "";
    return `${date},${action},${wallet},${amount},${gas},${tx}`;
  }).join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `realchain-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Activity() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [filters, setFilters] = useState({ action: "all", gasMethod: "all", wallet: "" });
  const [lastUpdatedMs, setLastUpdatedMs] = useState(null);
  const [receiptTx, setReceiptTx] = useState(null);

  const fetchRows = useCallback(async (cursor = null, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (filters.action !== "all") params.set("action", filters.action);
      if (filters.gasMethod !== "all") params.set("gasMethod", filters.gasMethod);
      if (filters.wallet) params.set("wallet", filters.wallet);
      if (cursor) params.set("cursor", cursor);

      const r = await fetch(`${BACKEND_URL}/api/transactions?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const txs = data.transactions || [];

      setRows((prev) => append ? [...prev, ...txs] : txs);
      setNextCursor(data.nextCursor || null);
      setLastUpdatedMs(Date.now());
      setError(null);
    } catch (e) {
      setError(e?.message || "Backend unreachable");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch on mount and when filters change
  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Live refresh on any tx event
  useEffect(() => {
    function onTx() { fetchRows(); }
    window.addEventListener("realchain:tx", onTx);
    return () => window.removeEventListener("realchain:tx", onTx);
  }, [fetchRows]);

  function setFilter(patch) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setNextCursor(null);
  }

  function clearFilters() {
    setFilters({ action: "all", gasMethod: "all", wallet: "" });
    setNextCursor(null);
  }

  function loadMore() {
    if (nextCursor && !loading) fetchRows(nextCursor, true);
  }

  function handleScroll(e) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      loadMore();
    }
  }

  return (
    <div className="container reveal">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Activity <span className="accent">log</span></h1>
            <p>Live on-chain transactions from the indexer.</p>
          </div>
          <div className="flex gap-2 items-center">
            <IndexerStatus offline={Boolean(error)} lastUpdatedMs={lastUpdatedMs} />
            {rows.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => downloadCsv(rows)}>
                <Icon name="download" size={12} /> Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="banner banner-warn" style={{ marginBottom: 24 }}>
          <Icon name="alert" size={14} /> {error} — start the backend at {BACKEND_URL} to see data.
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {ACTIONS.map((a) => (
          <button
            key={a}
            className={`btn btn-sm ${filters.action === a ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter({ action: a })}
            style={{ textTransform: "capitalize" }}
          >{a}</button>
        ))}
        <span style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
        {GAS.map((g) => (
          <button
            key={g}
            className={`btn btn-sm ${filters.gasMethod === g ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter({ gasMethod: g })}
          >gas: {g}</button>
        ))}
        <input
          type="text"
          className="form-input"
          placeholder="0x… wallet filter"
          value={filters.wallet}
          onChange={(e) => setFilter({ wallet: e.target.value })}
          style={{ width: 260, fontSize: 12, padding: "6px 10px" }}
        />
      </div>

      {/* Transaction list */}
      <div className="card card-elevated" style={{ padding: 0 }}>
        <div onScroll={handleScroll} style={{ maxHeight: "65vh", overflowY: "auto" }}>
          {rows.length === 0 && !loading && (
            <div className="empty-state" style={{ padding: 36 }}>
              <Icon name="info" size={20} />
              <h3>No matching activity</h3>
              <button className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear filters</button>
            </div>
          )}
          {rows.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Gas</th>
                    <th>Wallet</th>
                    <th>Action</th>
                    <th>Amount</th>
                    <th>Time</th>
                    <th>Tx</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id || r.txHash} onClick={() => setReceiptTx(r)} style={{ cursor: "pointer" }}>
                      <td><GasMethodBadge method={r.gasMethod === "ugf" ? "ugf" : "eth"} compact /></td>
                      <td><WalletShort address={r.from} /></td>
                      <td style={{ textTransform: "capitalize", fontWeight: 600 }}>{r.action || r.type}</td>
                      <td style={{ fontFeatureSettings: "'tnum' on", fontWeight: 700 }}>
                        ${Number(r.amount || 0).toFixed(2)}
                      </td>
                      <td className="text-muted text-sm">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td><OnChainBadge txHash={r.txHash} label="Tx" /></td>
                      <td>
                        <button className="icon-btn" title="Download receipt" onClick={(e) => { e.stopPropagation(); setReceiptTx(r); }}>
                          <Icon name="receipt" size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {loading && <div className="text-muted" style={{ padding: 16, textAlign: "center" }}>Loading…</div>}
          {nextCursor && !loading && (
            <div style={{ textAlign: "center", padding: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={loadMore}>Load more</button>
            </div>
          )}
        </div>
      </div>
      {/* Receipt overlay */}
      {receiptTx && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        }} onClick={() => setReceiptTx(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <TransactionReceipt tx={receiptTx} onClose={() => setReceiptTx(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
