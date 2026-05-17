import React from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { useWeb3 } from "./context/Web3Context";
import Home from "./pages/Home";
import Property from "./pages/Property";
import Portfolio from "./pages/Portfolio";
import Dividends from "./pages/Dividends";

function Navbar() {
  const {
    account,
    usdcBalance,
    connecting,
    connect,
    error,
    fmtAddr,
    isCorrectNetwork,
    roleHint,
    switchToExpectedNetwork,
    switchAccount,
  } = useWeb3();
  const [switchingNetwork, setSwitchingNetwork] = React.useState(false);
  const [switchingAccount, setSwitchingAccount] = React.useState(false);

  async function handleSwitchNetwork() {
    setSwitchingNetwork(true);
    try {
      await switchToExpectedNetwork();
    } finally {
      setSwitchingNetwork(false);
    }
  }

  async function handleSwitchAccount() {
    setSwitchingAccount(true);
    try {
      await switchAccount();
    } finally {
      setSwitchingAccount(false);
    }
  }

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <NavLink to="/" className="navbar-logo">
            <div className="navbar-logo-icon">🏛</div>
            <span className="navbar-logo-text">RealChain</span>
          </NavLink>

          <div className="navbar-nav">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              Properties
            </NavLink>
            <NavLink to="/portfolio" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              Portfolio
            </NavLink>
            <NavLink to="/dividends" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              Dividends
            </NavLink>
          </div>

          <div className="navbar-actions">
            {account && (
              <span className="tag" style={{ fontFamily: "monospace" }}>
                💵 ${usdcBalance} USDC
              </span>
            )}
            {account && roleHint && (
              <span className={`badge ${roleHint === "Owner" ? "badge-gold" : roleHint === "Investor" ? "badge-success" : "badge-muted"}`}>
                Role: {roleHint}
              </span>
            )}
            {!isCorrectNetwork && account && (
              <span className="badge badge-danger" style={{ padding: "6px 12px" }}>
                ⚠ Wrong Network
              </span>
            )}
            {!isCorrectNetwork && account && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSwitchNetwork}
                disabled={switchingNetwork}
              >
                {switchingNetwork ? "Switching…" : "Switch Network"}
              </button>
            )}
            {account && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSwitchAccount}
                disabled={switchingAccount || connecting}
              >
                {switchingAccount ? "Opening MetaMask…" : "Switch Account"}
              </button>
            )}
            <button
              className={`btn-wallet ${account ? "connected" : ""}`}
              onClick={connect}
              disabled={connecting}
            >
              {connecting ? (
                <><div className="spinner" style={{ width: 14, height: 14 }} /> Connecting…</>
              ) : account ? (
                <><div className="wallet-dot" />{fmtAddr(account)}</>
              ) : (
                "Connect Wallet"
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Error banner — shown when connect() fails (MetaMask not installed, user rejected, etc.) */}
      {error && (
        <div style={{
          background: "rgba(239,68,68,0.12)",
          borderBottom: "1px solid rgba(239,68,68,0.3)",
          padding: "10px 24px",
          fontSize: 14,
          color: "#fca5a5",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <span>⚠</span>
          <span>{error}</span>
          {error.toLowerCase().includes("metamask") && (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit", fontWeight: 700, marginLeft: 4 }}
            >
              Install MetaMask →
            </a>
          )}
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/property/:id" element={<Property />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/dividends" element={<Dividends />} />
        </Routes>
      </main>
    </div>
  );
}
