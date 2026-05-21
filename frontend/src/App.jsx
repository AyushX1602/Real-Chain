import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useWeb3 } from "./context/Web3Context";
import { useUGF } from "./context/UGFContext";
import { useSmartAgent } from "./context/SmartAgentContext";
import { useTheme } from "./context/ThemeContext";
import Icon from "./components/Icon";
import Logo from "./components/Logo";
import Switch from "./components/Switch";
import GasIndicator from "./components/GasIndicator";
import NotificationBell from "./components/NotificationBell";
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
import DemoWalkthrough from "./pages/DemoWalkthrough";
import About from "./pages/About";

// ─────────────────────────────────────────────────────────────────────────────
// Navbar — Positivus-style: white bar, black text, lime accent, rounded buttons.
// Wallet connect now also pings POST /api/users/connect so the backend has a
// row even before the user ever logs a transaction.
// ─────────────────────────────────────────────────────────────────────────────

function Navbar() {
  const { user: authUser, isAuthenticated, logout, dashboardForRole } = useAuth();
  const {
    account, usdcBalance, connecting, connect, error, fmtAddr,
    isCorrectNetwork, roleHint, switchToExpectedNetwork, switchAccount, disconnect,
  } = useWeb3();
  const navigate = useNavigate();
  const [walletOpen, setWalletOpen] = useState(false);
  const walletWrapRef = useRef(null);

  // Close wallet dropdown on outside click
  useEffect(() => {
    if (!walletOpen) return undefined;
    function onDown(e) {
      if (walletWrapRef.current && !walletWrapRef.current.contains(e.target)) setWalletOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [walletOpen]);
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
  const authRoleLabel = authUser?.role === "tenant" ? "Rent payer" : "Owner";

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
            {!isOwnerNav && (account || isAuthenticated) && (
              <>
                <NavLink to="/portfolio" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                  Portfolio
                </NavLink>
                <NavLink to="/dividends" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                  Claim rent
                </NavLink>
              </>
            )}
            <NavLink to="/demo" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              Demo
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              About
            </NavLink>
          </div>

          <div className="navbar-actions">
            {isAuthenticated ? (
              <>
                <span className={`role-badge ${authUser?.role === "owner" ? "is-owner" : "is-investor"}`} title={authUser?.email}>
                  <Icon name={authUser?.role === "owner" ? "building" : "receipt"} size={11} /> {authRoleLabel}
                </span>
                <button className="icon-btn" onClick={() => { logout(); disconnect(); navigate("/"); }} aria-label="Log out">
                  <Icon name="logout" size={16} />
                </button>
              </>
            ) : account && roleHint && roleHint !== "Unknown" ? (
              <span className={`role-badge ${roleHint === "Owner" ? "is-owner" : "is-investor"}`}>
                <Icon name={roleHint === "Owner" ? "star" : "users"} size={11} /> {roleHint}
              </span>
            ) : !account && !isAuthenticated ? (
              <div className="auth-nav-actions">
                <NavLink to="/login" className="btn btn-ghost btn-sm">Log in</NavLink>
                <NavLink to="/signup" className="btn btn-secondary btn-sm">Sign up</NavLink>
              </div>
            ) : null}
            {!isCorrectNetwork && account && (
              <button className="btn btn-secondary btn-sm" onClick={handleSwitch} disabled={switching}>
                <Icon name="alert" size={12} /> {switching ? "Switching…" : "Wrong network"}
              </button>
            )}

            {/* ── Wallet button / dropdown ───────────────────────────── */}
            {account ? (
              <div ref={walletWrapRef} style={{ position: "relative" }}>
                <button
                  className="btn-wallet connected"
                  onClick={() => setWalletOpen((o) => !o)}
                  aria-label={`Wallet: ${fmtAddr(account)}`}
                  aria-expanded={walletOpen}
                >
                  <span className="wallet-dot" />
                  {fmtAddr(account)}
                  <Icon name="chevronDown" size={11} style={{ marginLeft: 4, opacity: 0.7 }} />
                </button>

                {walletOpen && (
                  <div className="wallet-dropdown" role="menu">
                    {/* Balance row */}
                    <div className="wallet-dropdown-balance">
                      <span className="wallet-dropdown-label">Balance</span>
                      <span className="wallet-dropdown-usdc">${usdcBalance} USDC</span>
                    </div>
                    {/* Full address */}
                    <div className="wallet-dropdown-addr" title={account}>
                      {account}
                    </div>
                    <hr className="wallet-dropdown-divider" />
                    {/* Switch account */}
                    <button
                      className="wallet-dropdown-btn"
                      role="menuitem"
                      onClick={async () => {
                        setWalletOpen(false);
                        await switchAccount();
                      }}
                    >
                      <Icon name="users" size={13} /> Switch account
                    </button>
                    {/* Disconnect */}
                    <button
                      className="wallet-dropdown-btn wallet-dropdown-btn--danger"
                      role="menuitem"
                      onClick={() => { setWalletOpen(false); disconnect(); }}
                    >
                      <Icon name="logout" size={13} /> Disconnect
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="btn-wallet"
                onClick={connect}
                disabled={connecting}
                aria-label="Connect wallet"
              >
                {connecting
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Connecting…</>
                  : <><Icon name="wallet" size={14} /> Connect wallet</>}
              </button>
            )}
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

// Auth guard. Anything wrapped here demands either an authenticated session
// (email/password) OR a connected wallet. Unauthenticated visitors are
// bounced to /login and the original location is preserved on `location.state`
// so the AuthPage can return them after success.
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const { account } = useWeb3();
  if (!isAuthenticated && !account) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function OwnerRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  const { account, roleHint } = useWeb3();
  if (!isAuthenticated && !account) return <Navigate to="/login" replace />;
  if (isAuthenticated && user?.role === "tenant") return <Navigate to="/tenant" replace />;
  return children;
}

function TenantRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  const { account } = useWeb3();
  if (!isAuthenticated && !account) return <Navigate to="/login" replace />;
  if (isAuthenticated && user?.role === "owner") return <Navigate to="/owner" replace />;
  return children;
}

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-content">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/demo"  element={<DemoWalkthrough />} />
          <Route path="/about" element={<About />} />
          <Route path="/marketplace"   element={<Home />} />
          <Route path="/admin"         element={<OwnerRoute><OwnerDashboard /></OwnerRoute>} />
          <Route path="/owner"         element={<OwnerRoute><OwnerDashboard /></OwnerRoute>} />
          <Route path="/investor"      element={<ProtectedRoute><InvestorDashboard /></ProtectedRoute>} />
          <Route path="/tenant"        element={<TenantRoute><TenantDashboard /></TenantRoute>} />
          <Route path="/property/:id"  element={<Property />} />
          <Route path="/portfolio"     element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
          <Route path="/dividends"     element={<ProtectedRoute><Dividends /></ProtectedRoute>} />
          <Route path="/watchlist"     element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
          <Route path="/analytics"     element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/activity"      element={<ProtectedRoute><Activity /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
