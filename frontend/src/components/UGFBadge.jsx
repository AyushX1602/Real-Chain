import React from "react";
import Icon from "./Icon";
import { useUGF } from "../context/UGFContext";

// ─────────────────────────────────────────────────────────────────────────────
// UGFBadge — single source of truth for the "Gas paid in Mock USD" pill.
// Flips to "Gas paid in ETH" warning state when the UGF toggle is OFF.
// ─────────────────────────────────────────────────────────────────────────────

export default function UGFBadge({ size = "sm", className = "" }) {
  const { isUGFEnabled } = useUGF();
  if (isUGFEnabled) {
    return (
      <span className={`ugf-badge ${className}`} role="status">
        <span className="gem"><Icon name="drop" size={11} /></span>
        Gas paid in Mock USD — no ETH needed
      </span>
    );
  }
  return (
    <span className={`eth-badge ${className}`} role="alert">
      <Icon name="alert" size={14} />
      Gas paid in ETH (UGF off)
    </span>
  );
}
