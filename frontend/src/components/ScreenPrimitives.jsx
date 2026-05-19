import React from "react";
import Icon from "./Icon";
import { CONTRACT_ADDRESSES, NETWORK_CHAIN_ID } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// ScreenPrimitives — shared building blocks for the six in-scope screens.
//
// Every primitive here exists to make blockchain + tokenization concepts
// visible without bolting React state onto each consumer. They render from
// props, fail soft, and adopt Positivus tokens (lime / black / white) by
// default. Glassmorphism never appears here — the rule from the spec is that
// dense data surfaces stay opaque.
// ─────────────────────────────────────────────────────────────────────────────

// ── Block-explorer URL derivation ────────────────────────────────────────────
const EXPLORERS = {
  31337:    null,
  11155111: "https://sepolia.etherscan.io",
  84532:    "https://sepolia.basescan.org",
};

export function explorerUrlForTx(txHash, chainId = NETWORK_CHAIN_ID) {
  if (!txHash) return null;
  const base = EXPLORERS[chainId];
  return base ? `${base}/tx/${txHash}` : null;
}

export function explorerUrlForAddress(addr, chainId = NETWORK_CHAIN_ID) {
  if (!addr) return null;
  const base = EXPLORERS[chainId];
  return base ? `${base}/address/${addr}` : null;
}

// ── On-chain badge — link a tx to the explorer ─────────────────────────────
export function OnChainBadge({ txHash, label = "On-chain", chainId }) {
  const href = explorerUrlForTx(txHash, chainId);
  if (!href) {
    return (
      <span className="sp-onchain-badge sp-onchain-disabled" aria-label="Explorer link unavailable">
        <Icon name="info" size={10} /> No explorer
      </span>
    );
  }
  return (
    <a className="sp-onchain-badge" href={href} target="_blank" rel="noreferrer">
      <Icon name="external" size={10} /> {label}
    </a>
  );
}

// ── Gas method badge — "Gas paid in Mock USD via UGF" / "Gas paid in ETH" ──
export function GasMethodBadge({ method = "ugf", compact = false }) {
  const isUgf = method === "ugf";
  const text = isUgf ? "Gas paid in Mock USD via UGF" : "Gas paid in ETH";
  return (
    <span
      className={`sp-gas-badge ${isUgf ? "is-ugf" : "is-eth"} ${compact ? "is-compact" : ""}`}
      title={text}
    >
      <Icon name={isUgf ? "bolt" : "alert"} size={10} />
      {compact ? (isUgf ? "UGF" : "ETH") : text}
    </span>
  );
}

// ── Contract method badge — surface the call being submitted ────────────────
// Lets a user see exactly which `Contract.method(args)` a button will fire.
// Optional `address` enables a deep link to the contract.
export function ContractMethodBadge({ contractName, methodName, address, chainId }) {
  const label = `${contractName}.${methodName}`;
  const href = explorerUrlForAddress(address, chainId);
  const inner = (
    <>
      <Icon name="code" size={10} />
      <span className="sp-contract-method-label">{label}</span>
    </>
  );
  if (href) {
    return (
      <a className="sp-contract-method" href={href} target="_blank" rel="noreferrer" title={`View ${contractName} on explorer`}>
        {inner}
      </a>
    );
  }
  return <span className="sp-contract-method" title={label}>{inner}</span>;
}

// ── Fractional ownership progress bar ──────────────────────────────────────
// Shows holding / totalSupply as a lime fill against a black track. Numbers
// render with the 2dp rounding the requirements call for.
export function FractionalOwnershipBar({
  holding = 0,
  totalSupply = 0,
  label = "Fractional ownership",
  showValues = true,
}) {
  const pct = totalSupply > 0 ? Math.min(100, Math.max(0, (Number(holding) / Number(totalSupply)) * 100)) : 0;
  const display = pct.toFixed(2);
  return (
    <div className="sp-fractional" role="img" aria-label={`${label}: ${display}%`}>
      <div className="sp-fractional-head">
        <span className="sp-fractional-label">{label}</span>
        {showValues && (
          <span className="sp-fractional-value">
            {display}%
            <span className="sp-fractional-divider">/</span>
            <span className="sp-fractional-supply">{Number(totalSupply).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </span>
        )}
      </div>
      <div className="sp-fractional-track">
        <div className="sp-fractional-fill" style={{ width: `${display}%` }} />
      </div>
    </div>
  );
}

// ── Holder count chip — small, lazy-fed (count or null) ────────────────────
export function HolderCountChip({ count, loading = false }) {
  if (loading) return <span className="sp-holder-chip is-loading">…</span>;
  if (count == null) return <span className="sp-holder-chip is-unknown" title="Holder count unavailable">— holders</span>;
  return (
    <span className="sp-holder-chip" title={`${count} distinct holders`}>
      <Icon name="users" size={10} /> {count} {count === 1 ? "holder" : "holders"}
    </span>
  );
}

// ── Holder concentration strip — visualize top-N share ─────────────────────
// Pass an array of percentage points (one per top holder). Renders as a
// stacked horizontal bar so concentration is visible at a glance.
export function HolderConcentrationStrip({ shares = [], total = null, label = "Top-5 share" }) {
  const top = (shares || []).slice(0, 5);
  const sum = top.reduce((s, n) => s + Number(n || 0), 0);
  const others = total != null ? Math.max(0, Number(total) - sum) : Math.max(0, 100 - sum);
  const display = sum.toFixed(1);

  return (
    <div className="sp-holder-strip" role="img" aria-label={`${label}: ${display}%`}>
      <div className="sp-holder-strip-head">
        <span className="sp-holder-strip-label">{label}</span>
        <span className="sp-holder-strip-value">{display}%</span>
      </div>
      <div className="sp-holder-strip-track">
        {top.map((s, i) => (
          <div
            key={i}
            className="sp-holder-strip-seg"
            style={{ width: `${Math.max(0, Number(s || 0))}%`, opacity: 1 - i * 0.14 }}
            title={`#${i + 1}: ${Number(s || 0).toFixed(1)}%`}
          />
        ))}
        {others > 0 && (
          <div className="sp-holder-strip-others" style={{ width: `${others}%` }} title={`Others: ${others.toFixed(1)}%`} />
        )}
      </div>
    </div>
  );
}

// ── Epoch cadence indicator — projected next deposit date ──────────────────
export function EpochCadenceIndicator({ cadenceDays, lastDepositAt, projectedNextDate }) {
  if (cadenceDays == null) {
    return (
      <div className="sp-cadence" title="Need at least 2 deposits to estimate cadence">
        <Icon name="info" size={11} /> Cadence unavailable
      </div>
    );
  }
  let nextLabel = projectedNextDate;
  if (!nextLabel && lastDepositAt) {
    const last = new Date(lastDepositAt);
    if (!Number.isNaN(last.getTime())) {
      const next = new Date(last.getTime() + cadenceDays * 86_400_000);
      nextLabel = next.toISOString().slice(0, 10);
    }
  }
  return (
    <div className="sp-cadence" title="Median of recent rent deposits">
      <Icon name="history" size={11} />
      <span className="sp-cadence-text">
        Every <strong>{cadenceDays}d</strong>
        {nextLabel && <> · next <strong>{nextLabel}</strong></>}
      </span>
    </div>
  );
}

// ── KPI tile with hover-reveal source citation ─────────────────────────────
// Hovering or focusing the card surfaces the contract / event the value comes
// from. Satisfies R6 §6 and the cross-cutting "show your sources" rule.
export function KpiTile({ icon = "info", label, value, sourceText, tone = "default" }) {
  return (
    <div className={`sp-kpi-tile sp-tone-${tone}`} tabIndex={0}>
      <div className="sp-kpi-head">
        <span className="sp-kpi-label">
          <Icon name={icon} size={11} /> {label}
        </span>
      </div>
      <div className="sp-kpi-value">{value ?? "—"}</div>
      {sourceText && (
        <div className="sp-kpi-source" role="note">
          <Icon name="info" size={10} /> {sourceText}
        </div>
      )}
    </div>
  );
}

// ── Live indexer indicator — informs users the data is fresh ───────────────
export function IndexerStatus({ offline = false, lastUpdatedMs = null }) {
  const seconds = lastUpdatedMs ? Math.floor((Date.now() - lastUpdatedMs) / 1000) : null;
  if (offline) {
    return (
      <span className="sp-indexer-status is-offline" role="status">
        <Icon name="alert" size={10} /> Indexer offline — showing on-chain data
      </span>
    );
  }
  return (
    <span className="sp-indexer-status is-live" role="status">
      <span className="sp-indexer-dot" />
      Live indexer{seconds != null ? ` · ${seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`} ago` : ""}
    </span>
  );
}

// ── Wallet short — 6+4 hex format used across screens ──────────────────────
export function WalletShort({ address, link = true, chainId }) {
  if (!address || typeof address !== "string") return <span className="sp-wallet-short is-empty">—</span>;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  if (!link) return <code className="sp-wallet-short">{short}</code>;
  const href = explorerUrlForAddress(address, chainId);
  if (!href) return <code className="sp-wallet-short">{short}</code>;
  return (
    <a className="sp-wallet-short is-link" href={href} target="_blank" rel="noreferrer" title={address}>
      <code>{short}</code>
    </a>
  );
}

// ── Default export keeps imports terse ────────────────────────────────────
export default {
  OnChainBadge,
  GasMethodBadge,
  ContractMethodBadge,
  FractionalOwnershipBar,
  HolderCountChip,
  HolderConcentrationStrip,
  EpochCadenceIndicator,
  KpiTile,
  IndexerStatus,
  WalletShort,
  explorerUrlForTx,
  explorerUrlForAddress,
};
