import React, { useMemo, useState, useEffect } from "react";
import Icon from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// YieldCalculator — interactive investment widget with token slider.
//
// Inputs:  token count slider · expected annual rent (auto-populated from epochs)
// Reads:   pricePerToken (BigInt, 6-decimal USDC), totalSupply (BigInt, 18-decimal PROP)
// Outputs: investment cost · ownership % · annual rent share · yield % · payback months
// ─────────────────────────────────────────────────────────────────────────────

export default function YieldCalculator({ pricePerToken, totalSupply, epochs = [], className = "" }) {
  const priceUsd     = pricePerToken ? Number(pricePerToken) / 1e6 : 0;
  const supplyTokens = totalSupply  ? Number(totalSupply) / 1e18  : 0;
  const maxTokens    = Math.max(1, Math.floor(supplyTokens));

  const [tokens, setTokens]       = useState(5);
  const [annualRent, setAnnualRent] = useState("");

  // Auto-estimate annual rent from epoch history when available.
  useEffect(() => {
    if (!Array.isArray(epochs) || epochs.length < 2) return;
    // Get total rent and time span to extrapolate to a year.
    const sorted = [...epochs].sort((a, b) => Number(a.ts) - Number(b.ts));
    const totalUsd = sorted.reduce((s, e) => s + Number(e.total) / 1e6, 0);
    const spanSec  = Number(sorted[sorted.length - 1].ts) - Number(sorted[0].ts);
    if (spanSec > 0 && totalUsd > 0) {
      const annualized = (totalUsd / spanSec) * 365 * 86400;
      setAnnualRent(annualized.toFixed(0));
    }
  }, [epochs]);

  const result = useMemo(() => {
    const tok  = Number(tokens);
    const rent = parseFloat(annualRent);
    if (!Number.isFinite(tok) || tok <= 0 || !priceUsd) return null;

    const investment = tok * priceUsd;
    const ownership  = supplyTokens > 0 ? tok / supplyTokens : 0;

    if (!Number.isFinite(rent) || rent <= 0 || !ownership) {
      return { tokens: tok, investment, ownership, rentShare: null, yieldPct: null, paybackMonths: null };
    }
    const rentShare = rent * ownership;
    const yieldPct  = (rentShare / investment) * 100;
    const paybackMonths = rentShare > 0 ? (investment / rentShare) * 12 : null;
    return { tokens: tok, investment, ownership, rentShare, yieldPct, paybackMonths };
  }, [tokens, annualRent, priceUsd, supplyTokens]);

  return (
    <div className={`yield-calc ${className}`}>
      <div className="yield-calc-head">
        <Icon name="trending" size={14} />
        <span>Investment calculator</span>
      </div>

      {/* Token slider */}
      <div style={{ marginBottom: 20 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <label className="form-label" style={{ margin: 0 }}>How many tokens?</label>
          <span style={{
            fontWeight: 800, fontSize: 22, color: "var(--positivus-black)",
            fontFeatureSettings: "'tnum' on",
          }}>
            {tokens} <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.5 }}>PROP</span>
          </span>
        </div>
        <input
          type="range"
          min="1"
          max={maxTokens}
          value={tokens}
          onChange={(e) => setTokens(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#b9ff66" }}
          aria-label="Number of tokens to buy"
        />
        <div className="flex items-center justify-between text-xs text-muted" style={{ marginTop: 4 }}>
          <span>1 PROP</span>
          <span>{maxTokens} PROP</span>
        </div>
      </div>

      {/* Investment cost preview */}
      {result && (
        <div style={{
          padding: "12px 16px", marginBottom: 16,
          background: "var(--bg-elevated, #f7f7f5)",
          border: "1px solid var(--border, #e5e5e3)",
          borderRadius: "var(--radius-md, 10px)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10,
        }}>
          <div>
            <div className="text-xs text-muted">Investment cost</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--positivus-black)" }}>
              ${result.investment.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="text-xs text-muted">Ownership</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--positivus-black)" }}>
              {(result.ownership * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      {/* Annual rent input */}
      <div className="yield-calc-row">
        <label className="form-group" style={{ flex: 1 }}>
          <span className="form-label">
            Expected annual rent (whole property)
            {epochs && epochs.length >= 2 && (
              <span className="badge badge-success" style={{ marginLeft: 8, fontSize: 9 }}>Auto-estimated</span>
            )}
          </span>
          <span className="form-input-prefix">
            <span className="prefix">$</span>
            <input
              className="form-input"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 12000"
              value={annualRent}
              onChange={(e) => setAnnualRent(e.target.value)}
            />
          </span>
        </label>
      </div>

      {result && (
        <div className="yield-calc-grid">
          <YieldStat label="Tokens"            value={result.tokens.toFixed(0)}  unit="PROP" />
          <YieldStat label="Ownership"         value={(result.ownership * 100).toFixed(2)} unit="%" />
          <YieldStat
            label="Annual rent share"
            value={result.rentShare == null ? "—" : `$${result.rentShare.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
            unit=""
            highlight
          />
          <YieldStat
            label="Annualized yield"
            value={result.yieldPct == null ? "—" : `${result.yieldPct.toFixed(2)}%`}
            unit=""
            highlight
          />
          <YieldStat
            label="Payback"
            value={result.paybackMonths == null ? "—" : result.paybackMonths.toFixed(1)}
            unit="months"
          />
        </div>
      )}

      <p className="yield-calc-note">
        <Icon name="info" size={11} /> Estimates only. Real returns depend on
        actual rent deposits, vacancies, and property expenses.
      </p>
    </div>
  );
}

function YieldStat({ label, value, unit, highlight = false }) {
  return (
    <div className={`yield-stat ${highlight ? "is-hi" : ""}`}>
      <div className="yield-stat-label">{label}</div>
      <div className="yield-stat-value tabular">
        {value} {unit && <span className="yield-stat-unit">{unit}</span>}
      </div>
    </div>
  );
}
