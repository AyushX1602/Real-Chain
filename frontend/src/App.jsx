import React, { useState, useEffect } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useWeb3 } from "./context/Web3Context";
import { useUGF } from "./context/UGFContext";
import Icon from "./components/Icon";
import Logo from "./components/Logo";
import Switch from "./components/Switch";
import { BACKEND_URL } from "./config/contracts";

import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Property from "./pages/Property";
import Portfolio from "./pages/Portfolio";
import Dividends from "./pages/Dividends";
import OwnerDashboard from "./pages/OwnerDashboard";
import InvestorDashboard from "./pages/InvestorDashboard";

// ─────────────────────────────────────────────────────────────────────────────
// Navbar — Positivus-style: white bar, black text, lime accent, rounded buttons.
// Wallet connect now also pings POST /api/users/connect so the backend has a
// row even before the user ever logs a transaction.
// ─────────────────────────────────────────────────────────────────────────────

function Navbar() {
  const {
    account, usdcBalance, connecting, connect, error, fmtAddr,
    isCorrectNetwork, roleHint, switchToExpectedNetwork,
  } = useWeb3();
  const { isUGFEnabled, setUGFEnabled } = useUGF();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Persist the connected wallet to the backend (best-effort, non-blocking).
  useEffect(() => {
    if (!account) return;
    fetch(`${BACKEND_URL}/api/users/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: account, role: (roleHint || "unknown").toLowerCase() }),
    }).catch(() => { /* backend may be offline */ });
  }, [account, roleHint]);

  async function handleSwitch() {
    setSwitching(true);
    try { await switchToExpectedNetwork(); } finally { setSwitching(false); }
  }

  const dashboardHref = roleHint === "Owner" ? "/owner" : "/investor";

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <NavLink to="/" aria-label="RealChain home">
            <Logo size={36} />
          </NavLink>

          <div className="navbar-nav" role="navigation" aria-label="Primary">
            <NavLink to="/marketplace" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              Marketplace
            </NavLink>
            {account && (
              <NavLink to={dashboardHref} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                Dashboard
              </NavLink>
            )}
            <NavLink to="/portfolio" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              Portfolio
            </NavLink>
            <NavLink to="/dividends" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              Claim rent
            </NavLink>
          </div>

          <div className="navbar-actions">
            {account && (
              <span className="usdc-chip" title="Mock USDC balance">
                <span className="dot" />
                ${usdcBalance} USDC
              </span>
            )}
            {account && roleHint && roleHint !== "Unknown" && (
              <span className={`role-badge ${roleHint === "Owner" ? "is-owner" : "is-investor"}`}>
                <Icon name={roleHint === "Owner" ? "star" : "users"} size={11} /> {roleHint}
              </span>
            )}
            {!isCorrectNetwork && account && (
              <button className="btn btn-secondary btn-sm" onClick={handleSwitch} disabled={switching}>
                <Icon name="alert" size={12} /> {switching ? "Switching…" : "Wrong network"}
              </button>
            )}

            <div style={{ position: "relative" }}>
              <button
                className="icon-btn"
                aria-label="Settings"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((s) => !s)}
                onBlur={(e) => {
                  if (!e.currentTarget.parentNode.contains(e.relatedTarget)) {
                    setTimeout(() => setSettingsOpen(false), 120);
                  }
                }}
              >
                <Icon name="settings" size={18} />
              </button>
              {settingsOpen && <SettingsPopover isUGFEnabled={isUGFEnabled} setUGFEnabled={setUGFEnabled} onClose={() => setSettingsOpen(false)} />}
            </div>

            <button
              className={`btn-wallet ${account ? "connected" : ""}`}
              onClick={connect}
              disabled={connecting}
              aria-label={account ? `Connected as ${fmtAddr(account)}` : "Connect wallet"}
            >
              {connecting ? (
                <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Connecting…</>
              ) : account ? (
                <><span className="wallet-dot" />{fmtAddr(account)}</>
              ) : (
                <><Icon name="wallet" size={14} /> Connect wallet</>
              )}
            </button>
          </div>
        </div>
      </nav>

      {error && <ErrorBanner error={error} />}
    </>
  );
}

function SettingsPopover({ isUGFEnabled, setUGFEnabled, onClose }) {
  return (
    <div
      role="dialog"
      aria-label="UGF settings"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        minWidth: 300,
        background: "var(--positivus-white)",
        border: "1px solid var(--positivus-black)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-offset-sm)",
        padding: 20,
        zIndex: "var(--z-modal)",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: "var(--positivus-black)", textTransform: "uppercase", marginBottom: 14 }}>
        Demo controls
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: 14,
        background: "var(--positivus-grey)",
        border: "1px solid var(--positivus-black)",
        borderRadius: "var(--radius-md)",
        gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="bolt" size={12} /> UGF gasless mode
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.4 }}>
            {isUGFEnabled ? "Gas paid in Mock USD" : "Gas paid in ETH (will fail with 0 ETH)"}
          </div>
        </div>
        <Switch checked={isUGFEnabled} onChange={setUGFEnabled} id="ugf-toggle" />
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
        <Icon name="info" size={12} />
        <span>Toggle off to demonstrate the failure mode without UGF on a wallet with no ETH.</span>
      </div>

      <button className="btn btn-ghost btn-sm full-width" style={{ marginTop: 14 }} onClick={onClose}>Close</button>
    </div>
  );
}

function ErrorBanner({ error }) {
  return (
    <div role="alert" style={{
      background: "var(--danger-soft)",
      borderBottom: "1px solid var(--red-500)",
      padding: "12px 24px",
      fontSize: 14,
      color: "var(--red-500)",
      display: "flex", alignItems: "center", gap: 12, justifyContent: "center",
    }}>
      <Icon name="alert" size={14} />
      <span>{error}</span>
      {error.toLowerCase().includes("metamask") && (
        <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline" }}>
          Install MetaMask →
        </a>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-content">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/marketplace" element={<Home />} />
          <Route path="/owner" element={<OwnerDashboard />} />
          <Route path="/investor" element={<InvestorDashboard />} />
          <Route path="/property/:id" element={<Property />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/dividends" element={<Dividends />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
