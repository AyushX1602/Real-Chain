import React, { useMemo, useState } from "react";
import Icon from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// YieldCalculator — pure-math investment widget for a property page.
//
// Inputs:  investment USDC · expected annual rent USDC (across whole property)
// Reads:   pricePerToken (BigInt, 6-decimal USDC), totalSupply (BigInt, 18-decimal PROP)
// Outputs: tokens you can buy · your annual rent share · annualized yield % · payback months
// ─────────────────────────────────────────────────────────────────────────────

export default function YieldCalculator({ pricePerToken, totalSupply, className = "" }) {
  const priceUsd     = pricePerToken ? Number(pricePerToken) / 1e6 : 0;
  const supplyTokens = totalSupply  ? Number(totalSupply) / 1e18  : 0;

  const [investment, setInvestment] = useState(priceUsd ? String(priceUsd * 5) : "100");
  const [annualRent, setAnnualRent] = useState("");

  const result = useMemo(() => {
    const inv = parseFloat(investment);
    const rent = parseFloat(annualRent);
    if (!Number.isFinite(inv) || inv <= 0 || !priceUsd) return null;
    const tokens = inv / priceUsd;
    const ownership = supplyTokens > 0 ? tokens / supplyTokens : 0;
    if (!Number.isFinite(rent) || rent <= 0 || !ownership) {
      return { tokens, ownership, rentShare: null, yieldPct: null, paybackMonths: null };
    }
    const rentShare = rent * ownership;
    const yieldPct = (rentShare / inv) * 100;
    const paybackMonths = rentShare > 0 ? (inv / rentShare) * 12 : null;
    return { tokens, ownership, rentShare, yieldPct, paybackMonths };
  }, [investment, annualRent, priceUsd, supplyTokens]);

  return (
    <div className={`yield-calc ${className}`}>
      <div className="yield-calc-head">
        <Icon name="trending" size={14} />
        <span>Yield calculator</span>
      </div>

      <div className="yield-calc-row">
        <label className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <span className="form-label">Investment</span>
          <span className="form-input-prefix">
            <span className="prefix">$</span>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={investment}
              onChange={(e) => setInvestment(e.target.value)}
            />
          </span>
        </label>

        <label className="form-group" style={{ flex: 1, minWidth: 180 }}>
          <span className="form-label">Expected annual rent (whole property)</span>
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
          <YieldStat label="Tokens"            value={result.tokens.toFixed(2)}  unit="PROP" />
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
