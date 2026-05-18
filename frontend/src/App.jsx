import React, { useState } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useWeb3 } from "./context/Web3Context";
import { useUGF } from "./context/UGFContext";
import { useToast } from "./components/Toast";
import Icon from "./components/Icon";
import Logo from "./components/Logo";
import Switch from "./components/Switch";
import Home from "./pages/Home";
import Property from "./pages/Property";
import Portfolio from "./pages/Portfolio";
import Dividends from "./pages/Dividends";
import OwnerDashboard from "./pages/OwnerDashboard";
import InvestorDashboard from "./pages/InvestorDashboard";

// ─────────────────────────────────────────────────────────────────────────────
// Navbar — role-aware navigation, UGF settings popover, wallet chip.
// Hides primary nav on mobile (<880px) — see index.css responsive rules.
// ─────────────────────────────────────────────────────────────────────────────

function Navbar() {
  const {
    account, usdcBalance, connecting, connect, error, fmtAddr,
    isCorrectNetwork, roleHint, switchToExpectedNetwork,
  } = useWeb3();
  const { isUGFEnabled, setUGFEnabled } = useUGF();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function handleSwitch() {
    setSwitching(true);
    try { await switchToExpectedNetwork(); } finally { setSwitching(false); }
  }

  const dashboardHref = roleHint === "Owner" ? "/owner" : "/investor";

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          {/* Logo */}
          <NavLink to="/" aria-label="RealChain home">
            <Logo size={32} />
          </NavLink>

          {/* Primary nav */}
          <div className="navbar-nav" role="navigation" aria-label="Primary">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <Icon name="home" size={14} /> Marketplace
            </NavLink>
            {account && (
              <NavLink to={dashboardHref} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                <Icon name="grid" size={14} /> Dashboard
              </NavLink>
            )}
            <NavLink to="/portfolio" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <Icon name="briefcase" size={14} /> Portfolio
            </NavLink>
            <NavLink to="/dividends" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <Icon name="coins" size={14} /> Claim Rent
            </NavLink>
          </div>

          {/* Actions */}
          <div className="navbar-actions">
            {account && (
              <span className="usdc-chip" title="Mock USDC balance">
                <span className="dot" />
                ${usdcBalance} <span style={{ opacity: 0.7 }}>USDC</span>
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

            {/* Settings */}
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
                <Icon name="settings" size={16} />
              </button>
              {settingsOpen && <SettingsPopover isUGFEnabled={isUGFEnabled} setUGFEnabled={setUGFEnabled} onClose={() => setSettingsOpen(false)} />}
            </div>

            {/* Wallet */}
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
        minWidth: 280,
        background: "rgba(20, 20, 31, 0.96)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "var(--shadow-lg)",
        padding: 16,
        zIndex: "var(--z-modal)",
      }}
      onMouseDown={(e) => e.preventDefault() /* keep focus */}
    >
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--fg-muted)", textTransform: "uppercase", marginBottom: 12 }}>
        Demo controls
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: 12,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="bolt" size={12} className="text-accent" />
            UGF gasless mode
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.5 }}>
            {isUGFEnabled ? "Gas paid in Mock USD" : "Gas paid in ETH (will fail with 0 ETH)"}
          </div>
        </div>
        <Switch checked={isUGFEnabled} onChange={setUGFEnabled} id="ugf-toggle" />
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
        <Icon name="info" size={12} />
        <span>Toggle off to demonstrate the failure mode without UGF on a wallet with no ETH.</span>
      </div>

      <button className="btn btn-ghost btn-sm full-width" style={{ marginTop: 12 }} onClick={onClose}>Close</button>
    </div>
  );
}

function ErrorBanner({ error }) {
  return (
    <div role="alert" style={{
      background: "rgba(239,68,68,0.10)",
      borderBottom: "1px solid rgba(239,68,68,0.32)",
      padding: "10px 24px",
      fontSize: 13,
      color: "var(--red-400)",
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
          <Route path="/" element={<Home />} />
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
