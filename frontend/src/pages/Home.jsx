import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import Icon from "../components/Icon";
import { LogoMark } from "../components/Logo";
import ActivityFeed from "../components/ActivityFeed";
import FaucetPanel from "../components/FaucetPanel";
import useWatchlist from "../hooks/useWatchlist";

// ─────────────────────────────────────────────────────────────────────────────
// Home — RealChain marketplace.
// Cold-start no longer renders a landing page here; that lives in Landing.jsx
// at the "/" route. This page hydrates the public on-chain catalog and now
// supports client-side search/filters and a star-to-watchlist affordance.
// ─────────────────────────────────────────────────────────────────────────────

const SORTS = [
  { key: "id_asc",     label: "Newest first" },
  { key: "price_asc",  label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
  { key: "value_desc", label: "Valuation ↓" },
];

export default function Home() {
  const { account, connect, getReadFactory, getReadPropertyContracts, fmtInr, fmtProp, nodeOnline, usdcBalance, roleHint } = useWeb3();
  const [props, setProps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [showFaucet, setShowFaucet] = useState(false);
  const navigate = useNavigate();
  const watch = useWatchlist();

  // Filter state
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("id_asc");
  const [maxPrice, setMaxPrice] = useState("");
  const [onlyWatched, setOnlyWatched] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true); setErr(null);
    try {
      const factory = getReadFactory();
      const count = Number(await factory.getPropertiesCount());
      const list = [];
      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        let totalSupply = null;
        let pricePerToken = null;
        try {
          const { token, market } = getReadPropertyContracts({
            propertyToken: p.propertyToken,
            rentalDistribution: p.rentalDistribution,
            marketplace: p.marketplace,
          });
          [totalSupply, pricePerToken] = await Promise.all([
            token.totalSupply(),
            market.pricePerToken(),
          ]);
        } catch { /* keep nulls — render dashes */ }
        list.push({ id: i, ...p, totalSupply, pricePerToken });
      }
      setProps(list);
    } catch (e) {
      console.error(e);
      setErr("Could not reach the network. Make sure the chain is online.");
    } finally {
      setLoading(false);
    }
  }

  // Apply filters / sort.
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let out = props;
    if (ql) {
      out = out.filter((p) =>
        (p.name || "").toLowerCase().includes(ql) ||
        (p.location || "").toLowerCase().includes(ql)
      );
    }
    if (maxPrice) {
      const cap = parseFloat(maxPrice) * 1e6;
      if (Number.isFinite(cap)) {
        out = out.filter((p) => p.pricePerToken == null || Number(p.pricePerToken) <= cap);
      }
    }
    if (onlyWatched) {
      out = out.filter((p) => watch.has(p.id));
    }
    out = [...out];
    switch (sort) {
      case "price_asc":  out.sort((a, b) => Number(a.pricePerToken || 0n) - Number(b.pricePerToken || 0n)); break;
      case "price_desc": out.sort((a, b) => Number(b.pricePerToken || 0n) - Number(a.pricePerToken || 0n)); break;
      case "value_desc": out.sort((a, b) => Number(b.valueInr || 0n) - Number(a.valueInr || 0n)); break;
      default: out.sort((a, b) => a.id - b.id);
    }
    return out;
  }, [props, q, sort, maxPrice, onlyWatched, watch]);

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
            <Link to="/watchlist" className="btn btn-secondary btn-sm">
              <Icon name="star" size={12} /> Watchlist {watch.count > 0 && <span className="badge badge-accent" style={{ padding: "0 8px" }}>{watch.count}</span>}
            </Link>
            <Link to="/analytics" className="btn btn-secondary btn-sm">
              <Icon name="trending" size={12} /> Analytics
            </Link>
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

          {/* Filter bar */}
          <div className="filter-bar" role="search">
            <div className="filter-search">
              <Icon name="search" size={14} />
              <input
                type="search"
                placeholder="Search by name or location…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search properties"
              />
            </div>
            <div className="filter-cluster">
              <label className="filter-field">
                <span>Max price</span>
                <span className="form-input-prefix" style={{ minWidth: 120 }}>
                  <span className="prefix">$</span>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="any"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </span>
              </label>
              <label className="filter-field">
                <span>Sort</span>
                <select className="form-input" value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              <button
                type="button"
                className={`btn btn-sm ${onlyWatched ? "btn-gold" : "btn-secondary"}`}
                onClick={() => setOnlyWatched((v) => !v)}
              >
                <Icon name="star" size={12} /> Watched only
              </button>
              {(q || maxPrice || onlyWatched || sort !== "id_asc") && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setQ(""); setMaxPrice(""); setOnlyWatched(false); setSort("id_asc"); }}
                >
                  <Icon name="close" size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">
              <Icon name="building" size={14} /> Available properties
              <span className="text-sm text-muted" style={{ marginLeft: "auto", fontWeight: 400 }}>
                {loading ? "" : `${filtered.length} of ${props.length}`}
              </span>
            </h2>
            {loading ? (
              <div className="property-grid">
                {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 360 }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <span className="emoji"><Icon name="search" size={28} /></span>
                <h3>{props.length === 0 ? "No properties yet" : "No matches"}</h3>
                <p>
                  {props.length === 0
                    ? "Run the deploy and seed scripts, or have a property owner mint one to get started."
                    : "Try clearing filters or broadening the search."}
                </p>
              </div>
            ) : (
              <div className="property-grid">
                {filtered.map((p) => (
                  <PropertyCard
                    key={p.id}
                    property={p}
                    fmtInr={fmtInr}
                    fmtProp={fmtProp}
                    onView={() => navigate(`/property/${p.id}`)}
                    starred={watch.has(p.id)}
                    onToggleStar={() => watch.toggle(p.id)}
                  />
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

function PropertyCard({ property, onView, fmtInr, fmtProp, starred, onToggleStar }) {
  const isCoastal = (property.location || "").toLowerCase().includes("goa")
    || (property.location || "").toLowerCase().includes("beach");
  const isMetro   = (property.location || "").toLowerCase().includes("mumbai")
    || (property.location || "").toLowerCase().includes("delhi")
    || (property.location || "").toLowerCase().includes("bangalore");

  const supplyLabel = property.totalSupply != null
    ? `${fmtProp(property.totalSupply)} PROP`
    : "—";
  const priceLabel = property.pricePerToken != null
    ? `$${(Number(property.pricePerToken) / 1e6).toFixed(2)} / token`
    : "Price loading…";

  return (
    <article className="card property-card" onClick={onView} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onView()}>
      <div className="card-body">
        <div className="property-cover">
          <div className="property-tag-row">
            <span className="badge badge-success"><span className="status-dot" /> Live</span>
            <button
              type="button"
              className={`star-btn ${starred ? "is-on" : ""}`}
              onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
              aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}
              aria-pressed={starred}
            >
              <Icon name="star" size={14} />
            </button>
          </div>
          <div className="property-cover-glyph" aria-hidden="true">
            {isCoastal ? "🌊" : isMetro ? "🏙" : <LogoMark size={56} />}
          </div>
        </div>

        <h3 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>{property.name}</h3>
        <div className="text-sm text-muted" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="pin" size={12} /> {property.location}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18, marginBottom: 14 }}>
          <div style={{ background: "var(--positivus-white)", border: "1px solid var(--positivus-black)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
            <div className="stat-label" style={{ fontSize: 11, marginBottom: 2 }}>Valuation</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--positivus-black)" }}>{fmtInr(property.valueInr)}</div>
          </div>
          <div style={{ background: "var(--positivus-white)", border: "1px solid var(--positivus-black)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
            <div className="stat-label" style={{ fontSize: 11, marginBottom: 2 }}>Supply</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--positivus-black)" }}>{supplyLabel}</div>
          </div>
        </div>
        <div className="text-sm text-muted" style={{ marginBottom: 14 }}>
          <Icon name="dollar" size={12} /> {priceLabel}
        </div>

        <button className="btn btn-primary btn-full">
          View property <Icon name="arrowRight" size={13} />
        </button>
      </div>
    </article>
  );
}
