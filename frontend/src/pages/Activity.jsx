import React, { useMemo } from "react";
import { useAgent, useAgentState, AGENT_IDS } from "../agents";
import Icon from "../components/Icon";
import {
  GasMethodBadge,
  OnChainBadge,
  IndexerStatus,
  WalletShort,
} from "../components/ScreenPrimitives";

// ─────────────────────────────────────────────────────────────────────────────
// Activity — full-screen variant, owned by ActivityAgent.
// Renders the agent's state. NEVER fetches directly. NEVER mutates other agents.
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS = ["all", "claim", "buy", "deposit"];
const GAS = ["all", "ugf", "eth"];

export default function Activity() {
  const agent = useAgent(AGENT_IDS.ACTIVITY);
  const state = useAgentState(AGENT_IDS.ACTIVITY);

  const rows = state?.rows ?? [];
  const filters = state?.filters ?? { action: "all", gasMethod: "all", wallet: "" };

  const onScroll = useMemo(() => (e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      agent?.loadMore?.();
    }
  }, [agent]);

  if (!state) return <main className="container py-8"><div className="muted">Booting agent…</div></main>;

  return (
    <main className="container py-8">
      <header className="surface-glass" style={{ padding: 24, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Activity</h1>
        <p className="muted" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          Live on-chain transactions.
          <IndexerStatus offline={state.offline} />
        </p>
        <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {ACTIONS.map((a) => (
            <button
              key={a}
              className={`chip ${filters.action === a ? "chip-active" : ""}`}
              onClick={() => agent.setFilter({ action: a })}
            >{a}</button>
          ))}
          <span className="divider" />
          {GAS.map((g) => (
            <button
              key={g}
              className={`chip ${filters.gasMethod === g ? "chip-active" : ""}`}
              onClick={() => agent.setFilter({ gasMethod: g })}
            >gas: {g}</button>
          ))}
          <input
            type="text"
            className="form-input"
            placeholder="0x… wallet filter"
            value={filters.wallet}
            onChange={(e) => agent.setFilter({ wallet: e.target.value })}
            style={{ width: 320 }}
          />
        </div>
        {state.filterError && <div className="text-danger" style={{ marginTop: 6, fontSize: 12 }}>{state.filterError}</div>}
      </header>

      {state.error && (
        <div className="alert alert-warn" role="alert">
          <Icon name="alert" size={14} /> {state.error}
        </div>
      )}

      <section className="card" style={{ padding: 0 }}>
        <div onScroll={onScroll} style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {rows.length === 0 && !state.loading && (
            <div className="empty" style={{ padding: 36 }}>
              <Icon name="info" size={20} />
              <p>No matching activity</p>
              <button className="btn btn-secondary btn-sm" onClick={() => agent.clearFilters()}>Clear filters</button>
            </div>
          )}
          {rows.map((r) => (
            <div key={r._id || r.txHash} className="activity-row">
              <GasMethodBadge method={r.gasMethod === "ugf" ? "ugf" : "eth"} compact />
              <WalletShort address={r.from} />
              <span>{verb(r.action)}</span>
              <span style={{ fontFeatureSettings: "'tnum' on", fontWeight: 700 }}>
                {Number(r.amount || 0).toFixed(6)} USDC
              </span>
              <OnChainBadge txHash={r.txHash} label="Tx" />
            </div>
          ))}
          {state.loading && <div className="muted" style={{ padding: 16 }}>Loading…</div>}
        </div>
      </section>
    </main>
  );
}

function verb(a) {
  if (a === "claim") return "claimed";
  if (a === "buy") return "bought";
  if (a === "deposit") return "deposited";
  return a || "";
}
