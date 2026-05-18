import React from "react";
import Icon from "./Icon";
import { useSmartAgent } from "../context/SmartAgentContext";

// ─────────────────────────────────────────────────────────────────────────────
// GasIndicator — small navbar pill that surfaces live gas state when the
// Smart-Gas optimizer toggle is on. Hidden otherwise to keep the navbar lean.
// State is derived inside SmartAgentContext from a rolling 1-hour history.
// ─────────────────────────────────────────────────────────────────────────────

const TONE = {
  low:     { cls: "is-low",  label: "Low",     icon: "check" },
  normal:  { cls: "is-mid",  label: "Normal",  icon: "info" },
  high:    { cls: "is-high", label: "High",    icon: "alert" },
  unknown: { cls: "is-mid",  label: "Loading", icon: "info" },
};

export default function GasIndicator() {
  const { smartGas, gasNowGwei, gasState } = useSmartAgent();
  if (!smartGas) return null;

  const tone = TONE[gasState] || TONE.unknown;
  const gwei = gasNowGwei == null ? "—" : `${gasNowGwei.toFixed(1)} gwei`;

  return (
    <span className={`gas-pill ${tone.cls}`} title="Live gas — Smart Agent" aria-live="polite">
      <Icon name={tone.icon} size={11} />
      <span className="gas-pill-label">Gas {tone.label}</span>
      <span className="gas-pill-value font-mono">{gwei}</span>
    </span>
  );
}
