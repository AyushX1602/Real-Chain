import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import Icon from "../components/Icon";
import { LogoMark } from "../components/Logo";
import ActivityFeed from "../components/ActivityFeed";
import FaucetPanel from "../components/FaucetPanel";

// ─────────────────────────────────────────────────────────────────────────────
// Home — RealChain marketplace.
// Cold-start no longer renders a landing page here; that lives in Landing.jsx
// at the "/" route. This page assumes the user has either connected their
// wallet or is browsing the public on-chain catalog read-only.
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const { account, connect, getReadFactory, fmtInr, nodeOnline, usdcBalance, roleHint } = useWeb3();
  const [props, setProps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [showFaucet, setShowFaucet] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true); setErr(null);
    try {
      const factory = getReadFactory();
      const count = Number(await factory.getPropertiesCount());
      const list = [];
      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        list.push({ id: i, ...p });
      }
      setProps(list);
    } catch (e) {
      console.error(e);
      setErr("Could not reach the network. Make sure the chain is online.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container reveal">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Tokenized <span className="accent">real estate</span> marketplace</h1>
            <p>Buy fractional ownership, earn USDC rent, and trade anytime — gas paid in Mock USD via UGF.</p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <span className={`badge ${nodeOnline ? "badge-success" : "badge-danger"}`}>
              <span className="status-dot" /> {nodeOnline ? "Network online" : "Network offline"}
            </span>
            {!account && (
              <button className="btn btn-primary btn-sm" onClick={connect}>
                <Icon name="wallet" size={12} /> Connect wallet
              </button>
            )}
            {account && roleHint && (
              <Link to={roleHint === "Owner" ? "/owner" : "/investor"} className="btn btn-secondary btn-sm">
                <Icon name={roleHint === "Owner" ? "star" : "users"} size={12} /> Open dashboard <Icon name="arrowRight" size={11} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {(showFaucet || (account && Number(usdcBalance) === 0 && roleHint === "Investor")) && (
        <div style={{ marginBottom: 32 }}>
          <FaucetPanel onClose={() => setShowFaucet(false)} />
        </div>
      )}

      <div className="layout-two-col">
        <div>
          {!showFaucet && account && Number(usdcBalance) === 0 && (
            <div className="banner banner-info" style={{ marginBottom: 24 }}>
              <Icon name="info" size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Your wallet is empty. Need test funds?{" "}
                <button
                  onClick={() => setShowFaucet(true)}
                  style={{ background: "none", border: "none", color: "inherit", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>
                  Open the faucet helper →
                </button>
              </span>
            </div>
          )}

          {err && (
            <div className="banner banner-danger" style={{ marginBottom: 24 }}>
              <Icon name="alert" size={16} /> {err}
            </div>
          )}

          <div className="section">
            <h2 className="section-title"><Icon name="building" size={14} /> Available properties</h2>
            {loading ? (
              <div className="property-grid">
                {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 360 }} />)}
              </div>
            ) : props.length === 0 ? (
              <div className="empty-state">
                <span className="emoji"><Icon name="building" size={28} /></span>
                <h3>No properties yet</h3>
                <p>Run the deploy and seed scripts, or have a property owner mint one to get started.</p>
              </div>
            ) : (
              <div className="property-grid">
                {props.map((p) => (
                  <PropertyCard key={p.id} property={p} fmtInr={fmtInr}
                    onView={() => navigate(`/property/${p.id}`)} />
                ))}
              </div>
            )}
          </div>
        </div>

        <ActivityFeed />
      </div>
    </div>
  );
}

function PropertyCard({ property, onView, fmtInr }) {
  const isCoastal = (property.location || "").toLowerCase().includes("goa")
    || (property.location || "").toLowerCase().includes("beach");
  const isMetro   = (property.location || "").toLowerCase().includes("mumbai")
    || (property.location || "").toLowerCase().includes("delhi")
    || (property.location || "").toLowerCase().includes("bangalore");

  return (
    <article className="card property-card" onClick={onView} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onView()}>
      <div className="card-body">
        <div className="property-cover">
          <div className="property-tag-row">
            <span className="badge badge-success"><span className="status-dot" /> Live</span>
            <span className="badge badge-accent"><Icon name="layers" size={11} /> ERC-20</span>
          </div>
          <div className="property-cover-glyph" aria-hidden="true">
            {isCoastal ? "🌊" : isMetro ? "🏙" : <LogoMark size={56} />}
          </div>
        </div>

        <h3 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>{property.name}</h3>
        <div className="text-sm text-muted" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="pin" size={12} /> {property.location}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18, marginBottom: 18 }}>
          <div style={{ background: "var(--positivus-white)", border: "1px solid var(--positivus-black)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
            <div className="stat-label" style={{ fontSize: 11, marginBottom: 2 }}>Valuation</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--positivus-black)" }}>{fmtInr(property.valueInr)}</div>
          </div>
          <div style={{ background: "var(--positivus-white)", border: "1px solid var(--positivus-black)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
            <div className="stat-label" style={{ fontSize: 11, marginBottom: 2 }}>Supply</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--positivus-black)" }}>100 PROP</div>
          </div>
        </div>

        <button className="btn btn-primary btn-full">
          View property <Icon name="arrowRight" size={13} />
        </button>
      </div>
    </article>
  );
}
