import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import Icon from "../components/Icon";
import { LogoMark } from "../components/Logo";
import ActivityFeed from "../components/ActivityFeed";
import FaucetPanel from "../components/FaucetPanel";

// ─────────────────────────────────────────────────────────────────────────────
// Home — dual-mode landing.
//   Non-connected: hero pitch + 3 feature pills + CTA.
//   Connected:     marketplace grid + activity rail + role nav.
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

  // Cold-start: not connected → landing
  if (!account) return <Landing connect={connect} />;

  return (
    <div className="container reveal">
      {/* Welcome strip */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Tokenized <span className="accent">real estate</span> marketplace</h1>
            <p>Buy fractional ownership, earn USDC rent, and trade anytime — gas paid in Mock USD via UGF.</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <span className={`badge ${nodeOnline ? "badge-success" : "badge-danger"}`}>
              <span className="status-dot" /> {nodeOnline ? "Network online" : "Network offline"}
            </span>
            {roleHint && (
              <Link to={roleHint === "Owner" ? "/owner" : "/investor"} className="btn btn-secondary btn-sm">
                <Icon name={roleHint === "Owner" ? "star" : "users"} size={12} /> Open dashboard <Icon name="arrowRight" size={11} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Show faucet panel when wallet is bare or user clicked */}
      {(showFaucet || (Number(usdcBalance) === 0 && roleHint === "Investor")) && (
        <div style={{ marginBottom: 32 }}>
          <FaucetPanel onClose={() => setShowFaucet(false)} />
        </div>
      )}

      {/* Two-column layout */}
      <div className="layout-two-col">
        <div>
          {!showFaucet && Number(usdcBalance) === 0 && (
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
                {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 320 }} />)}
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

// ── Landing (cold-start) ─────────────────────────────────────────────────────

function Landing({ connect }) {
  return (
    <div className="container">
      <section className="hero-landing reveal">
        <div className="hero-eyebrow">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="bolt" size={11} />
            UGF Hackathon · Track 3
          </span>
          <span style={{ width: 4, height: 4, borderRadius: 99, background: "currentColor", opacity: 0.5 }} />
          <span>Base Sepolia</span>
        </div>

        <h1 className="hero-headline">
          Claim your rent.<br />
          <span className="accent">Never touch ETH.</span>
        </h1>

        <p className="hero-sub">
          RealChain turns property rent into one-tap USDC dividends. The Universal Gas
          Framework settles your transaction fees in Mock USD — so you can claim, buy,
          and trade with zero ETH in your wallet.
        </p>

        <div className="hero-cta-row">
          <button className="btn btn-primary btn-xl" onClick={connect}>
            <Icon name="wallet" size={16} /> Connect wallet
          </button>
          <a href="#features" className="btn btn-secondary btn-xl">
            How it works <Icon name="arrowDown" size={14} />
          </a>
        </div>

        <div className="trust-strip">
          <span className="item"><Icon name="shield" size={12} /> <strong>Audit-ready</strong> contracts</span>
          <span className="item"><Icon name="bolt" size={12} /> <strong>Gasless</strong> transactions</span>
          <span className="item"><Icon name="globe" size={12} /> <strong>Open</strong> source</span>
        </div>

        <div className="hero-features" id="features">
          <FeatureCard
            icon="bolt"
            title="Zero-ETH claim"
            body="Investors with empty ETH balances click one button and rent USDC lands in their wallet. UGF wraps every state-changing call."
          />
          <FeatureCard
            icon="layers"
            title="Fractional ownership"
            body="Each property mints 100 PROP tokens. Buy in, hold for rent, or list on the secondary market — all on-chain, all transparent."
          />
          <FeatureCard
            icon="coins"
            title="USDC rent flow"
            body="Owners deposit rent in USDC; smart contracts split it pro-rata to every token holder. Claim anytime, gas-free."
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, body }) {
  return (
    <div className="hero-feature">
      <div className="icon-wrap"><Icon name={icon} size={20} /></div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

// ── Property card ────────────────────────────────────────────────────────────

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

        <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>{property.name}</h3>
        <div className="text-xs text-muted" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="pin" size={12} /> {property.location}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18, marginBottom: 18 }}>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
            <div className="stat-label" style={{ fontSize: 11, marginBottom: 2 }}>Valuation</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--amber-400)" }}>{fmtInr(property.valueInr)}</div>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
            <div className="stat-label" style={{ fontSize: 11, marginBottom: 2 }}>Supply</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--violet-300)" }}>100 PROP</div>
          </div>
        </div>

        <button className="btn btn-primary btn-full">
          View property <Icon name="arrowRight" size={13} />
        </button>
      </div>
    </article>
  );
}
