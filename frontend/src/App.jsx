import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useWeb3 } from "./context/Web3Context";
import { useUGF } from "./context/UGFContext";
import { useSmartAgent } from "./context/SmartAgentContext";
import { useTheme } from "./context/ThemeContext";
import Icon from "./components/Icon";
import Logo from "./components/Logo";
import Switch from "./components/Switch";
import GasIndicator from "./components/GasIndicator";
import { BACKEND_URL } from "./config/contracts";

import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import Property from "./pages/Property";
import Portfolio from "./pages/Portfolio";
import Dividends from "./pages/Dividends";
import OwnerDashboard from "./pages/OwnerDashboard";
import InvestorDashboard from "./pages/InvestorDashboard";
import TenantDashboard from "./pages/TenantDashboard";
import Watchlist from "./pages/Watchlist";
import Analytics from "./pages/Analytics";
import Activity from "./pages/Activity";

// ─────────────────────────────────────────────────────────────────────────────
// Navbar — Positivus-style: white bar, black text, lime accent, rounded buttons.
// Wallet connect now also pings POST /api/users/connect so the backend has a
// row even before the user ever logs a transaction.
// ─────────────────────────────────────────────────────────────────────────────

function Navbar() {
  const { user: authUser, isAuthenticated, logout, dashboardForRole } = useAuth();
  const {
    account, usdcBalance, connecting, connect, error, fmtAddr,
    isCorrectNetwork, roleHint, switchToExpectedNetwork,
  } = useWeb3();
  const { isUGFEnabled, setUGFEnabled } = useUGF();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const settingsWrapRef = useRef(null);

  // Close the settings popover when the user clicks outside of it. Using a
  // document-level mousedown listener instead of the gear button's onBlur is
  // important — onBlur was firing when focus moved into form controls inside
  // the popover (selects, inputs), which closed the popover on first click.
  useEffect(() => {
    if (!settingsOpen) return undefined;
    function handleDocMouseDown(e) {
      if (settingsWrapRef.current && !settingsWrapRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    }
    function handleEsc(e) {
      if (e.key === "Escape") setSettingsOpen(false);
    }
    document.addEventListener("mousedown", handleDocMouseDown);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleDocMouseDown);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [settingsOpen]);

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

  const dashboardHref = isAuthenticated
    ? dashboardForRole(authUser?.role)
    : roleHint === "Owner" ? "/owner" : "/investor";
  const isOwnerSession = isAuthenticated && authUser?.role === "owner";
  const isOwnerNav = isOwnerSession || (!isAuthenticated && roleHint === "Owner");
  const authRoleLabel = authUser?.role === "tenant" ? "Rent payer" : "Admin";

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
            {(account || isAuthenticated) && (
              <NavLink to={dashboardHref} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                Dashboard
              </NavLink>
            )}
            {!isOwnerNav && (
              <>
                <NavLink to="/portfolio" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                  Portfolio
                </NavLink>
                <NavLink to="/dividends" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                  Claim rent
                </NavLink>
              </>
            )}
          </div>

          <div className="navbar-actions">
            {account && (
              <span className="usdc-chip" title="Mock USDC balance">
                <span className="dot" />
                ${usdcBalance} USDC
              </span>
            )}
            <GasIndicator />
            {account && roleHint && roleHint !== "Unknown" && (
              <span className={`role-badge ${roleHint === "Owner" ? "is-owner" : "is-investor"}`}>
                <Icon name={roleHint === "Owner" ? "star" : "users"} size={11} /> {roleHint}
              </span>
            )}
            {isAuthenticated ? (
              <>
                <span className={`role-badge ${authUser?.role === "owner" ? "is-owner" : "is-investor"}`} title={authUser?.email}>
                  <Icon name={authUser?.role === "owner" ? "building" : "receipt"} size={11} /> {authRoleLabel}
                </span>
                <button className="icon-btn" onClick={logout} aria-label="Log out">
                  <Icon name="logout" size={16} />
                </button>
              </>
            ) : (
              <div className="auth-nav-actions">
                <NavLink to="/login" className="btn btn-ghost btn-sm">Log in</NavLink>
                <NavLink to="/signup" className="btn btn-secondary btn-sm">Sign up</NavLink>
              </div>
            )}
            {!isCorrectNetwork && account && (
              <button className="btn btn-secondary btn-sm" onClick={handleSwitch} disabled={switching}>
                <Icon name="alert" size={12} /> {switching ? "Switching…" : "Wrong network"}
              </button>
            )}

            <div ref={settingsWrapRef} style={{ position: "relative" }}>
              <button
                className="icon-btn"
                aria-label="Settings"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((s) => !s)}
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
  const { smartGas, setSmartGas } = useSmartAgent();
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="dialog"
      aria-label="Settings"
      className="settings-popover"
    >
      <div className="settings-section-head">Appearance</div>

      {/* Theme toggle */}
      <div className="theme-toggle" role="radiogroup" aria-label="Theme">
        <button
          type="button"
          role="radio"
          aria-checked={theme === "light"}
          className={`theme-pill ${theme === "light" ? "is-active" : ""}`}
          onClick={() => setTheme("light")}
        >
          <Icon name="info" size={12} /> Light
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={theme === "dark"}
          className={`theme-pill ${theme === "dark" ? "is-active" : ""}`}
          onClick={() => setTheme("dark")}
        >
          <Icon name="bolt" size={12} /> Dark
        </button>
      </div>

      <div className="settings-section-head" style={{ marginTop: 18 }}>Demo controls</div>

      {/* UGF gasless toggle */}
      <div className="settings-row">
        <div className="settings-row-text">
          <div className="settings-row-title">
            <Icon name="bolt" size={12} /> UGF gasless mode
          </div>
          <div className="settings-row-desc">
            {isUGFEnabled ? "Gas paid in Mock USD" : "Gas paid in ETH (will fail with 0 ETH)"}
          </div>
        </div>
        <Switch checked={isUGFEnabled} onChange={setUGFEnabled} id="ugf-toggle" />
      </div>

      <div className="settings-section-head" style={{ marginTop: 18 }}>Smart Agent</div>

      {/* Smart gas optimizer — no API key needed */}
      <div className="settings-row">
        <div className="settings-row-text">
          <div className="settings-row-title">
            <Icon name="trending" size={12} /> Smart gas optimizer
          </div>
          <div className="settings-row-desc">
            Live gas readings and rule-based timing suggestions. No API key needed.
          </div>
        </div>
        <Switch checked={smartGas} onChange={setSmartGas} id="smart-gas-toggle" />
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
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/marketplace" element={<Home />} />
          <Route path="/admin" element={<OwnerDashboard />} />
          <Route path="/owner" element={<OwnerDashboard />} />
          <Route path="/investor" element={<InvestorDashboard />} />
          <Route path="/tenant" element={<TenantDashboard />} />
          <Route path="/property/:id" element={<Property />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/dividends" element={<Dividends />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
