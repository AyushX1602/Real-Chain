import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import Icon from "../components/Icon";
import { LogoMark } from "../components/Logo";
import useWatchlist from "../hooks/useWatchlist";

// ─────────────────────────────────────────────────────────────────────────────
// Watchlist — properties the user has starred from the marketplace. Reads ids
// from localStorage via useWatchlist, then fetches the live property data
// from the on-chain factory so every metric stays current.
// ─────────────────────────────────────────────────────────────────────────────

export default function Watchlist() {
  const { getReadFactory, getReadPropertyContracts, fmtInr, fmtProp } = useWeb3();
  const { ids, has, toggle, count } = useWatchlist();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    (async () => {
      try {
        const factory = getReadFactory();
        const total = Number(await factory.getPropertiesCount());
        const valid = ids.filter((n) => n >= 0 && n < total);
        const out = await Promise.all(valid.map(async (id) => {
          const p = await factory.properties(id);
          let totalSupply = null;
          try {
            const { token } = getReadPropertyContracts({
              propertyToken: p.propertyToken,
              rentalDistribution: p.rentalDistribution,
              marketplace: p.marketplace,
            });
            totalSupply = await token.totalSupply();
          } catch { /* keep null */ }
          return { id, ...p, totalSupply };
        }));
        if (alive) setItems(out);
      } catch (e) {
        if (alive) setError(e?.message || "Could not load watchlist");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [ids, getReadFactory, getReadPropertyContracts]);

  return (
    <div className="container reveal">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>My <span className="accent">watchlist</span></h1>
            <p>Starred properties from the marketplace. Stored on this device — sync to your account is on the roadmap.</p>
          </div>
          <div className="flex gap-3 items-center">
            <span className="badge badge-muted">{count} {count === 1 ? "property" : "properties"}</span>
            <Link to="/marketplace" className="btn btn-secondary btn-sm">
              <Icon name="search" size={12} /> Browse marketplace
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="property-grid">
          {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 360 }} />)}
        </div>
      ) : error ? (
        <div className="banner banner-danger"><Icon name="alert" size={14} /> {error}</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <span className="emoji"><Icon name="star" size={28} /></span>
          <h3>Your watchlist is empty</h3>
          <p>Tap the star on any marketplace card to keep it here for later.</p>
          <button className="btn btn-primary mt-6" onClick={() => navigate("/marketplace")}>
            Browse marketplace <Icon name="arrowRight" size={13} />
          </button>
        </div>
      ) : (
        <div className="property-grid">
          {items.map((p) => (
            <article key={p.id} className="card property-card" onClick={() => navigate(`/property/${p.id}`)} role="button" tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate(`/property/${p.id}`)}>
              <div className="card-body">
                <div className="property-cover">
                  <div className="property-tag-row">
                    <span className="badge badge-success"><span className="status-dot" /> Live</span>
                    <button
                      type="button"
                      className={`star-btn ${has(p.id) ? "is-on" : ""}`}
                      onClick={(e) => { e.stopPropagation(); toggle(p.id); }}
                      aria-label={has(p.id) ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      <Icon name="star" size={14} />
                    </button>
                  </div>
                  <div className="property-cover-glyph" aria-hidden="true"><LogoMark size={56} /></div>
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>{p.name}</h3>
                <div className="text-sm text-muted" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon name="pin" size={12} /> {p.location}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18, marginBottom: 18 }}>
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
                    <div className="stat-label" style={{ fontSize: 11, marginBottom: 2 }}>Valuation</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{fmtInr(p.valueInr)}</div>
                  </div>
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
                    <div className="stat-label" style={{ fontSize: 11, marginBottom: 2 }}>Supply</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
                      {p.totalSupply != null ? `${fmtProp(p.totalSupply)} PROP` : "—"}
                    </div>
                  </div>
                </div>
                <button className="btn btn-primary btn-full">View property <Icon name="arrowRight" size={13} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
