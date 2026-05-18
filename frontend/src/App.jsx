import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useWeb3 } from "./context/Web3Context";
import { useUGF } from "./context/UGFContext";
import { useSmartAgent, AGENT_PROVIDERS } from "./context/SmartAgentContext";
import Icon from "./components/Icon";
import Logo from "./components/Logo";
import Switch from "./components/Switch";
import GasIndicator from "./components/GasIndicator";
import { BACKEND_URL } from "./config/contracts";

import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Property from "./pages/Property";
import Portfolio from "./pages/Portfolio";
import Dividends from "./pages/Dividends";
import OwnerDashboard from "./pages/OwnerDashboard";
import InvestorDashboard from "./pages/InvestorDashboard";
import Watchlist from "./pages/Watchlist";
import Analytics from "./pages/Analytics";

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
            <GasIndicator />
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
  const {
    smartGas, setSmartGas,
    smartAi, setSmartAi,
    aiProvider, setAiProvider,
    aiKey, setAiKey,
    aiModel, setAiModel,
    llmReady,
  } = useSmartAgent();
  const [showKey, setShowKey] = useState(false);

  const provider = AGENT_PROVIDERS.find((p) => p.id === aiProvider) || AGENT_PROVIDERS[0];

  return (
    <div
      role="dialog"
      aria-label="Settings"
      className="settings-popover"
    >
      <div className="settings-section-head">Demo controls</div>

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

      {/* Smart gas optimizer */}
      <div className="settings-row">
        <div className="settings-row-text">
          <div className="settings-row-title">
            <Icon name="trending" size={12} /> Smart gas optimizer
          </div>
          <div className="settings-row-desc">
            Live gas pill in the navbar plus rule-based timing and batch suggestions on your dashboard.
          </div>
        </div>
        <Switch checked={smartGas} onChange={setSmartGas} id="smart-gas-toggle" />
      </div>

      {/* AI assistant */}
      <div className="settings-row">
        <div className="settings-row-text">
          <div className="settings-row-title">
            <Icon name="spark" size={12} /> AI assistant
          </div>
          <div className="settings-row-desc">
            Adds a free-text question box on the dashboard. Brings your own API key — calls go directly from your browser to the provider.
          </div>
        </div>
        <Switch checked={smartAi} onChange={setSmartAi} id="smart-ai-toggle" />
      </div>

      {/* AI provider config — only when the assistant is on */}
      {smartAi && (
        <div className="settings-card">
          <label className="form-group" style={{ marginBottom: 12 }}>
            <span className="form-label">Provider</span>
            <select className="form-input" value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
              {AGENT_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>

          <label className="form-group" style={{ marginBottom: 12 }}>
            <span className="form-label">API key</span>
            <span className="form-input-prefix" style={{ paddingLeft: 14 }}>
              <span className="prefix"><Icon name="lock" size={12} /></span>
              <input
                className="form-input"
                type={showKey ? "text" : "password"}
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                placeholder={`${provider.keyPrefix}…`}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Hide key" : "Reveal key"}
                style={{ padding: "4px 10px" }}
              >
                <Icon name={showKey ? "eyeOff" : "eye"} size={12} />
              </button>
            </span>
          </label>

          <label className="form-group" style={{ marginBottom: 8 }}>
            <span className="form-label">Model (optional)</span>
            <input
              className="form-input"
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder={provider.defaultModel}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className="settings-meta">
            <span className={`badge ${llmReady ? "badge-success" : "badge-muted"}`}>
              <Icon name={llmReady ? "check" : "info"} size={11} />
              {llmReady ? "Ready" : "Add a key"}
            </span>
            <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="settings-link">
              Get a {provider.label} key <Icon name="external" size={11} />
            </a>
          </div>

          <div className="settings-warn">
            <Icon name="alert" size={12} />
            <span>
              Keys live in this browser's localStorage and are sent directly to {provider.label}. Don't paste production keys on a shared machine.
            </span>
          </div>
        </div>
      )}

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
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
