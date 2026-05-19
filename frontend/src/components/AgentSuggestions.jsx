import React, { useMemo } from "react";
import Icon from "./Icon";
import { useSmartAgent } from "../context/SmartAgentContext";

// ─────────────────────────────────────────────────────────────────────────────
// AgentSuggestions — heuristic gas + holdings analysis.
// 100% free, no API key required. Pure rule-based suggestions.
// ─────────────────────────────────────────────────────────────────────────────

export default function AgentSuggestions({ holdings = [] }) {
  const { smartGas, gasNowGwei, gasState, analyzeHoldings } = useSmartAgent();

  const suggestions = useMemo(() => {
    if (!smartGas) return [];
    return analyzeHoldings(holdings);
  }, [smartGas, holdings, analyzeHoldings]);

  if (!smartGas) return null;

  return (
    <div className="agent-block">
      <div className="agent-head">
        <span className="agent-tag">
          <Icon name="bolt" size={11} /> Smart Agent
        </span>
        {gasNowGwei != null && (
          <span className="agent-meta">
            Live gas {gasNowGwei.toFixed(2)} gwei · {gasState}
          </span>
        )}
      </div>

      {suggestions.length === 0 ? (
        <div className="agent-empty">
          <Icon name="check" size={14} /> Nothing pressing. Holdings look healthy and gas is in a normal range.
        </div>
      ) : (
        <ul className="agent-list">
          {suggestions.map((s) => (
            <li key={s.id} className={`agent-item is-${s.kind}`}>
              <span className="agent-item-icon"><Icon name={s.icon} size={14} /></span>
              <div className="agent-item-body">
                <div className="agent-item-title">{s.title}</div>
                <div className="agent-item-desc">{s.body}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
