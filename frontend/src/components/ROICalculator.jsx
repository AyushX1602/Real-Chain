import React, { useState, useMemo } from "react";
import Icon from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// ROICalculator — interactive investment projector.
// Takes the property's pricePerToken + average rent per epoch, and shows the
// investor "if you invest $X → you earn $Y/year (Z% APY)".
// ─────────────────────────────────────────────────────────────────────────────

export default function ROICalculator({
  pricePerToken = 0,
  totalSupply = 100,
  avgRentPerEpoch = 0,
  epochsPerYear = 12,
}) {
  const [investment, setInvestment] = useState(100);
  const safePrice = Math.max(pricePerToken, 0.01);

  const projection = useMemo(() => {
    const tokensBought = investment / safePrice;
    const ownershipPct = (tokensBought / totalSupply) * 100;
    const yearlyRent = avgRentPerEpoch * epochsPerYear * (ownershipPct / 100);
    const apy = investment > 0 ? (yearlyRent / investment) * 100 : 0;
    return { tokensBought, ownershipPct, yearlyRent, apy };
  }, [investment, safePrice, totalSupply, avgRentPerEpoch, epochsPerYear]);

  return (
    <div className="card card-elevated" style={{ overflow: "visible" }}>
      <div className="card-body" style={{ padding: "20px 24px" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
          <span style={{
            width: 28, height: 28, display: "inline-flex", alignItems: "center",
            justifyContent: "center", borderRadius: 8,
            background: "var(--accent-soft)", color: "var(--accent)",
          }}>
            <Icon name="trending" size={14} />
          </span>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>ROI Calculator</h3>
        </div>

        {/* Investment slider */}
        <label className="text-xs text-muted" style={{ display: "block", marginBottom: 6 }}>
          Investment amount (USDC)
        </label>
        <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
          <input
            type="range"
            min={10}
            max={10000}
            step={10}
            value={investment}
            onChange={(e) => setInvestment(Number(e.target.value))}
            style={{ flex: 1, accentColor: "#B9FF66" }}
          />
          <div style={{
            minWidth: 80, padding: "6px 12px", borderRadius: 8,
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            fontWeight: 700, fontSize: 15, textAlign: "center",
          }}>
            ${investment.toLocaleString()}
          </div>
        </div>

        {/* Results grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
          padding: 14, borderRadius: "var(--radius-md)",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
        }}>
          <div>
            <div className="text-xs text-muted">Tokens you get</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>
              {projection.tokensBought.toFixed(2)} <span className="text-xs text-muted">PROP</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Ownership</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>
              {projection.ownershipPct.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Est. yearly rent</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2, color: "#22c55e" }}>
              ${projection.yearlyRent.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Projected APY</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2, color: "var(--amber-400)" }}>
              {projection.apy.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="text-xs text-muted" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="info" size={11} />
          Based on avg rent ${avgRentPerEpoch.toFixed(2)}/epoch × {epochsPerYear} epochs/year. Not financial advice.
        </div>
      </div>
    </div>
  );
}
