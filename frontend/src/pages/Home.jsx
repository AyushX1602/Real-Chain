import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import Icon from "../components/Icon";
import ActivityFeed from "../components/ActivityFeed";
import FaucetPanel from "../components/FaucetPanel";
import useWatchlist from "../hooks/useWatchlist";
import {
  FractionalOwnershipBar,
  HolderCountChip,
  IndexerStatus,
  ContractMethodBadge,
} from "../components/ScreenPrimitives";
import { BACKEND_URL } from "../config/contracts";
import { propertyImage } from "../utils/propertyImage";
import LiveStatsBanner from "../components/LiveStatsBanner";

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
  const [indexerOffline, setIndexerOffline] = useState(false);
  const [lastUpdatedMs, setLastUpdatedMs] = useState(null);
  const [holderCounts, setHolderCounts] = useState({}); // id → number | null
  const [showFaucet, setShowFaucet] = useState(false);
  const navigate = useNavigate();
  const watch = useWatchlist();

  // Filter state
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("id_asc");
  const [maxPrice, setMaxPrice] = useState("");
  const [onlyWatched, setOnlyWatched] = useState(false);

  useEffect(() => { load(); }, []);

  // Live refresh — any tx logged through UGFContext.logTx fires a window
  // event. We reset holder counts so every visible card re-fetches against
  // the new chain state, then re-pull the catalog.
  useEffect(() => {
    function handler() {
      setHolderCounts({});
      load();
    }
    window.addEventListener("realchain:tx", handler);
    return () => window.removeEventListener("realchain:tx", handler);
    // load() is stable enough — it captures setProps via closure; no deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic refresh — keeps the catalog fresh even when the current user
  // didn't make the transaction. 30s matches the indexer's refresh budget
  // without hammering the backend.
  useEffect(() => {
    const interval = setInterval(() => load(), 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy holder-count fetch — fired by IntersectionObserver on each card.
  // The backend now responds with { count, holders }; we still tolerate the
  // legacy bare-array shape so an older indexer build keeps working.
  // Cached forever per session so scrolling back doesn't re-hit the indexer.
  async function fetchHolderCount(id) {
    if (holderCounts[id] !== undefined) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/properties/${id}/holders`, {
        signal: AbortSignal.timeout?.(5_000),
      });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      const count = (typeof data?.count === "number") ? data.count
        : Array.isArray(data?.holders) ? data.holders.length
        : Array.isArray(data) ? data.length
        : null;
      setHolderCounts((prev) => ({ ...prev, [id]: count }));
    } catch {
      setHolderCounts((prev) => ({ ...prev, [id]: null }));
    }
  }
  async function load() {
    setLoading(true); setErr(null);
    // Try the indexer first — it has tokensRemaining + cadence baked in.
    try {
      const r = await fetch(`${BACKEND_URL}/api/properties`, { signal: AbortSignal.timeout?.(10_000) });
      if (r.ok) {
        const data = await r.json();
        const list = Array.isArray(data) ? data : (data?.properties || []);
        if (list.length > 0) {
          // ── Chain-count guard: if the factory has more properties than the
          // indexer knows about (e.g. admin just minted), skip the stale
          // indexer response and read directly from chain instead.
          try {
            const factory = getReadFactory();
            const chainCount = Number(await factory.getPropertiesCount());
            if (chainCount > list.length) throw new Error("indexer_behind");
          } catch (chainErr) {
            if (chainErr?.message === "indexer_behind") throw chainErr;
            // chain unreachable — use indexer as-is
          }
          // Indexer is in sync with chain — shape and return.
          const num = (v) => {
            const n = typeof v === "bigint" ? Number(v) : Number(v);
            return Number.isFinite(n) ? n : 0;
          };
          setProps(list.map((p) => ({
            id: p.id ?? p._id ?? p.propertyId,
            name: p.name,
            location: p.location,
            valueInr: num(p.valueInr ?? p.totalValue),
            owner: p.owner,
            propertyToken: p.propertyToken || p.tokenAddress,
            rentalDistribution: p.rentalDistribution || p.rentalAddress,
            marketplace: p.marketplace || p.marketplaceAddress,
            totalSupply: p.totalSupply,
            tokensRemaining: p.tokensRemaining,
            pricePerToken: p.pricePerToken,
            imageUrl: p.imageUrl ?? null,
          })));
          setIndexerOffline(false);
          setLastUpdatedMs(Date.now());
          setLoading(false);
          return;
        }
      }
      // Fall through to chain when indexer returns nothing useful.
      throw new Error("indexer empty");
    } catch {
      setIndexerOffline(true);
    }

    try {
      const factory = getReadFactory();
      const count = Number(await factory.getPropertiesCount());
      const list = [];
      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        let totalSupply = null;
        let pricePerToken = null;
        let tokensRemaining = null;
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
          // Owner's balance = tokens remaining for primary sale
          try {
            const ownerBal = await token.balanceOf(p.owner);
            tokensRemaining = ownerBal;
          } catch { /* ignore */ }
        } catch { /* keep nulls — render dashes */ }
        list.push({ id: i, ...p, totalSupply, pricePerToken, tokensRemaining });
      }
      setProps(list);
      setLastUpdatedMs(Date.now());
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

      {/* Live platform stats — full-width above the two-column layout */}
      <LiveStatsBanner />

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
              <span className="text-sm text-muted" style={{ marginLeft: "auto", fontWeight: 400, display: "inline-flex", alignItems: "center", gap: 10 }}>
                <IndexerStatus offline={indexerOffline} lastUpdatedMs={lastUpdatedMs} />
                {!loading && <span>{filtered.length} of {props.length}</span>}
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
                    holderCount={holderCounts[p.id]}
                    onVisible={() => fetchHolderCount(p.id)}
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

function PropertyCard({ property, onView, fmtInr, fmtProp, starred, onToggleStar, holderCount, onVisible }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !onVisible || typeof IntersectionObserver !== "function") return undefined;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          onVisible();
          obs.disconnect();
          break;
        }
      }
    }, { threshold: [0, 0.5, 1] });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onVisible]);

  // Deterministic Unsplash photo for this property — same id ⇒ same image.
  const coverUrl = propertyImage(property, { w: 800, h: 400 });

  // Coerce supply / price into Numbers no matter whether the source was the
  // indexer (numbers, no decimals) or on-chain (BigInts in raw units).
  const totalSupplyNum = (() => {
    const ts = property.totalSupply;
    if (ts == null) return null;
    if (typeof ts === "number") return ts;
    try { return Number(ts) / 1e18; } catch { return null; }
  })();
  const tokensRemainingNum = (() => {
    const tr = property.tokensRemaining;
    if (tr == null) return null;
    if (typeof tr === "number") return tr;
    try { return Number(tr) / 1e18; } catch { return null; }
  })();
  const tokensSold = totalSupplyNum != null && tokensRemainingNum != null
    ? Math.max(0, totalSupplyNum - tokensRemainingNum)
    : null;
  const supplyLabel = property.totalSupply != null
    ? `${typeof property.totalSupply === "number" ? property.totalSupply.toLocaleString() : fmtProp(property.totalSupply)} PROP`
    : "—";
  const rawPrice = property.pricePerToken != null
    ? (typeof property.pricePerToken === "number" ? property.pricePerToken : Number(property.pricePerToken) / 1e6)
    : null;
  const priceLabel = rawPrice == null ? "Price loading…"
    : rawPrice === 0 ? "Free (owner transfer)"
    : `$${rawPrice.toFixed(2)} / token`;

  // Performance score: A=3, B=2, C=1, D=0
  const perfScore = (property.epochCount > 0 ? 1 : 0) + (holderCount > 0 ? 1 : 0) + (rawPrice > 0 ? 1 : 0);
  const perfGrade = ["D", "C", "B", "A"][perfScore];
  const perfColor = { A: "#22c55e", B: "#B9FF66", C: "#f59e0b", D: "#ef4444" }[perfGrade];

  // Sold out = owner has 0 remaining tokens for primary sale
  const isSoldOut = tokensRemainingNum != null && tokensRemainingNum <= 0;

  return (
    <article ref={ref} className="card property-card" onClick={onView} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onView()}>
      <div className="card-body">
        <div
          className="property-cover has-photo"
          style={{ backgroundImage: `url(${coverUrl})` }}
        >
          <div className="property-cover-scrim" aria-hidden="true" />
          <div className="property-tag-row">
            {isSoldOut
              ? <span className="badge" style={{ background: "#ef4444", color: "#fff", fontWeight: 800, fontSize: 11, letterSpacing: "0.06em" }}>SOLD OUT</span>
              : <span className="badge badge-success"><span className="status-dot" /> Live</span>}
            <span className="badge" style={{ background: perfColor, color: "#191A23", fontWeight: 800, fontSize: 11 }}>{perfGrade}</span>
            <HolderCountChip count={holderCount} loading={holderCount === undefined} />
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
        </div>

        <h3 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>{property.name}</h3>
        <div className="text-sm text-muted" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="pin" size={12} /> {property.location}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18, marginBottom: 14 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
            <div className="stat-label" style={{ fontSize: 11, marginBottom: 2 }}>Valuation</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{fmtInr(property.valueInr)}</div>
          </div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
            <div className="stat-label" style={{ fontSize: 11, marginBottom: 2 }}>Supply</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{supplyLabel}</div>
          </div>
        </div>

        {/* Fractional-ownership progress: tokens sold / total supply */}
        {totalSupplyNum != null && tokensSold != null && (
          <div style={{ marginBottom: 12 }}>
            <FractionalOwnershipBar
              holding={tokensSold}
              totalSupply={totalSupplyNum}
              label="Tokens sold"
            />
          </div>
        )}

        <div className="text-sm text-muted" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="dollar" size={12} /> {priceLabel}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <ContractMethodBadge contractName="Marketplace" methodName="buyFromOwner" address={property.marketplace} />
        </div>

        <button className="btn btn-primary btn-full" style={isSoldOut ? { opacity: 0.7 } : undefined}>
          {isSoldOut ? <>Sold out · View secondary market <Icon name="arrowRight" size={13} /></> : <>View property <Icon name="arrowRight" size={13} /></>}
        </button>
      </div>
    </article>
  );
}
