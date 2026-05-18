import React, { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import { useSmartAgent } from "../context/SmartAgentContext";

// ─────────────────────────────────────────────────────────────────────────────
// AgentSuggestions — block rendered on the investor dashboard. Always shows
// the heuristic list when smartGas is on; reveals an "Ask the agent" affordance
// when smartAi is on AND a key is configured. Both are opt-in.
//
// Props:
//   holdings — [{ id, name, pending (bigint, 6dp USDC), balance (bigint, 18dp PROP) }]
// ─────────────────────────────────────────────────────────────────────────────

export default function AgentSuggestions({ holdings = [] }) {
  const { smartGas, smartAi, llmReady, gasNowGwei, gasState, analyzeHoldings, askAgent } = useSmartAgent();

  const suggestions = useMemo(() => {
    if (!smartGas) return [];
    return analyzeHoldings(holdings);
  }, [smartGas, holdings, analyzeHoldings]);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer]     = useState("");
  const [error, setError]       = useState(null);
  const [busy, setBusy]         = useState(false);

  // Reset the LLM box when the user toggles the AI feature off.
  useEffect(() => {
    if (!smartAi) { setAnswer(""); setError(null); }
  }, [smartAi]);

  if (!smartGas && !smartAi) return null;

  async function handleAsk(e) {
    e?.preventDefault?.();
    if (!llmReady || busy) return;
    setBusy(true); setError(null); setAnswer("");
    try {
      const text = await askAgent({ question: question.trim(), holdings, suggestions });
      setAnswer(text);
    } catch (err) {
      setError(err?.message || "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agent-block">
      <div className="agent-head">
        <span className="agent-tag">
          <Icon name="bolt" size={11} /> Smart Agent
        </span>
        {gasNowGwei != null && smartGas && (
          <span className="agent-meta">
            Live gas {gasNowGwei.toFixed(2)} gwei · {gasState}
          </span>
        )}
      </div>

      {smartGas && (
        suggestions.length === 0 ? (
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
        )
      )}

      {smartAi && (
        <form className="agent-ask" onSubmit={handleAsk}>
          <label className="form-label" htmlFor="agent-question">Ask the agent</label>
          <div className="agent-ask-row">
            <input
              id="agent-question"
              className="form-input"
              type="text"
              placeholder={llmReady
                ? "e.g. Should I claim now or wait?"
                : "Add an API key in Settings to enable this."}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={!llmReady || busy}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!llmReady || busy || (!question.trim() && !answer)}
              aria-label="Ask the agent"
            >
              {busy ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Thinking…</> : <>Ask</>}
            </button>
          </div>

          {!llmReady && (
            <div className="agent-hint">
              <Icon name="info" size={11} /> AI is enabled but no key is set. Open Settings → AI assistant.
            </div>
          )}

          {error && (
            <div className="banner banner-danger" style={{ marginTop: 10 }}>
              <Icon name="alert" size={13} /> {error}
            </div>
          )}

          {answer && (
            <div className="agent-answer">
              <div className="agent-answer-head">
                <Icon name="bolt" size={12} /> Agent reply
              </div>
              <div className="agent-answer-body">{answer}</div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
