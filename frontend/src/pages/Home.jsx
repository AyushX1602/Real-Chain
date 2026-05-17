import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";

export default function Home() {
  const { getReadFactory, account, connect, fmtUsdc, fmtInr, nodeOnline } = useWeb3();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadProperties(); }, []);

  async function loadProperties() {
    setLoading(true);
    setLoadError(null);
    try {
      const factory = getReadFactory();
      const count   = Number(await factory.getPropertiesCount());
      const props = [];
      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        props.push({ id: i, ...p });
      }
      setProperties(props);
    } catch (e) {
      console.error("loadProperties:", e);
      setLoadError(e.message?.includes("could not detect network")
        ? "Cannot reach the local Hardhat node. Make sure it is running on port 8545."
        : "Failed to load properties. Check that contracts are deployed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="page-header" style={{ marginTop: 32 }}>
        <h1>🏙 Real Estate Marketplace</h1>
        <p>Buy fractional ownership in premium properties. Earn rental income. Trade anytime.</p>
      </div>

      {/* Stats banner */}
      <div className="stats-row" style={{ marginBottom: 40 }}>
        <div className="stat-card">
          <div className="stat-label">Properties Listed</div>
          <div className="stat-value accent">{properties.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Token Supply / Property</div>
          <div className="stat-value gold">100 PROP</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Settlement Token</div>
          <div className="stat-value success">USDC</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Node Status</div>
          <div className={`stat-value ${nodeOnline === true ? "success" : nodeOnline === false ? "" : "text-muted"}`}
               style={{ fontSize: 18 }}>
            {nodeOnline === null ? "Checking…" : nodeOnline ? "● Online" : "● Offline"}
          </div>
        </div>
      </div>

      {/* Node offline warning */}
      {nodeOnline === false && (
        <div className="banner banner-danger" style={{ marginBottom: 24 }}>
          <span>⚠️</span>
          <div>
            <strong>Hardhat node not detected.</strong> Start it first:
            <br /><code style={{ fontSize: 13, opacity: 0.9 }}>npx hardhat node</code>
            &nbsp;then&nbsp;
            <code style={{ fontSize: 13, opacity: 0.9 }}>npx hardhat run scripts/deploy.js --network hardhat</code>
          </div>
        </div>
      )}

      {/* Wallet connect prompt */}
      {!account && nodeOnline && (
        <div className="banner banner-info" style={{ marginBottom: 24 }}>
          <span>🔌</span>
          <span>
            Connect MetaMask to buy tokens and claim dividends.{" "}
            <button onClick={connect} style={{ background: "none", border: "none", color: "inherit", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
              Connect now →
            </button>
          </span>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Available Properties</h2>

        {loadError ? (
          <div className="banner banner-danger">
            <span>❌</span>
            <span>{loadError}</span>
          </div>
        ) : loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: 36, height: 36, margin: "0 auto 16px" }} />
            <p>Loading properties from blockchain…</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🏗</div>
            <h3>No properties deployed yet</h3>
            <p>Run <code>npx hardhat run scripts/deploy.js --network hardhat</code> to create the initial properties.</p>
          </div>
        ) : (
          <div className="property-grid">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} onView={() => navigate(`/property/${p.id}`)} fmtInr={fmtInr} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyCard({ property, onView, fmtInr }) {
  const locationEmoji =
    property.location?.toLowerCase().includes("goa")    ? "🌊" :
    property.location?.toLowerCase().includes("mumbai") ? "🌆" : "🏠";

  return (
    <div className="card property-card" onClick={onView}>
      <div className="card-body">
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <span className="property-badge">● Live</span>
          <span className="badge badge-accent">ERC-20</span>
        </div>

        <div style={{
          fontSize: 52, textAlign: "center", margin: "12px 0",
          filter: "drop-shadow(0 4px 12px rgba(124,110,250,0.3))"
        }}>
          {locationEmoji}
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, textAlign: "center" }}>
          {property.name}
        </h3>
        <p className="text-muted text-sm" style={{ textAlign: "center", marginBottom: 20 }}>
          📍 {property.location}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
            <div className="stat-label" style={{ marginBottom: 4 }}>Valuation</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--gold)" }}>
              {fmtInr(property.valueInr)}
            </div>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
            <div className="stat-label" style={{ marginBottom: 4 }}>Supply</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>100 PROP</div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div className="flex justify-between text-sm text-muted" style={{ marginBottom: 6 }}>
            <span>Tokens available</span>
            <span>100 / 100</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: "100%" }} />
          </div>
        </div>

        <button className="btn btn-primary btn-full">View Property →</button>
      </div>
    </div>
  );
}
