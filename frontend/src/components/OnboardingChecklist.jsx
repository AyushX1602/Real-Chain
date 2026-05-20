import React from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { useWeb3 } from "../context/Web3Context";

// ─────────────────────────────────────────────────────────────────────────────
// OnboardingChecklist — guided progress for first-time investors.
// Shows 4 steps: Connect wallet → Fund with USDC → Buy tokens → Claim rent.
// Each step auto-completes based on real state (wallet, balance, holdings).
// Dismissible via localStorage.
// ─────────────────────────────────────────────────────────────────────────────

const DISMISS_KEY = "realchain-onboarding-dismissed";

export default function OnboardingChecklist({ hasHoldings = false, hasClaimed = false }) {
  const { account, usdcBalance } = useWeb3();
  const [dismissed, setDismissed] = React.useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  if (dismissed) return null;

  const steps = [
    {
      label: "Connect wallet",
      done: Boolean(account),
      icon: "wallet",
      hint: "Click the Connect button in the navbar.",
    },
    {
      label: "Fund with USDC",
      done: Number(usdcBalance || 0) > 0,
      icon: "dollar",
      hint: "Use the faucet to get free test USDC.",
    },
    {
      label: "Buy property tokens",
      done: hasHoldings,
      icon: "building",
      hint: <Link to="/marketplace" style={{ color: "var(--accent)" }}>Browse marketplace →</Link>,
    },
    {
      label: "Claim your first rent",
      done: hasClaimed,
      icon: "bolt",
      hint: "Wait for an epoch, then claim on this page.",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  function handleDismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  }

  return (
    <div className="card card-elevated" style={{ marginBottom: 24, border: "2px solid var(--accent)", borderRadius: "var(--radius-lg)" }}>
      <div className="card-body" style={{ padding: "20px 24px" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <div className="flex items-center gap-2">
            <Icon name="check" size={16} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              {allDone ? "You're all set! 🎉" : "Getting started"}
            </span>
            <span className="badge badge-accent" style={{ fontSize: 11 }}>{completedCount}/{steps.length}</span>
          </div>
          <button className="btn btn-ghost btn-xs" onClick={handleDismiss} aria-label="Dismiss checklist">
            <Icon name="close" size={12} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, borderRadius: 2, background: "var(--bg-elevated)", marginBottom: 16 }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: "linear-gradient(90deg, #B9FF66, #8BC34A)",
            width: `${(completedCount / steps.length) * 100}%`,
            transition: "width 0.5s ease",
          }} />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "8px 12px", borderRadius: 8,
                background: step.done ? "rgba(185,255,102,0.08)" : "var(--bg-elevated)",
                border: `1px solid ${step.done ? "rgba(185,255,102,0.3)" : "var(--border)"}`,
                opacity: step.done ? 0.7 : 1,
              }}
            >
              <span style={{
                width: 24, height: 24, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: step.done ? "#B9FF66" : "var(--bg-card)",
                border: step.done ? "none" : "2px solid var(--border)",
                color: step.done ? "#191A23" : "var(--fg-muted)",
                fontSize: 12, fontWeight: 800, flexShrink: 0,
              }}>
                {step.done ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <span style={{
                  fontWeight: 600, fontSize: 13,
                  textDecoration: step.done ? "line-through" : "none",
                  color: step.done ? "var(--fg-muted)" : "var(--text-primary)",
                }}>{step.label}</span>
                {!step.done && (
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>{step.hint}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
