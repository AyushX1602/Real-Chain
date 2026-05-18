import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import { BACKEND_URL } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// Landing — Positivus-styled marketing page for RealChain.
//
// Adapted from the Positivus Figma template (CC BY 4.0):
//   https://www.figma.com/community/file/1230604708032389430
// Coded reference: https://github.com/zakariamouhid/positivus-from-figma
//
// Sections: hero · trust strip · services · CTA · how-it-works · stats · footer
// All backend endpoints are wired:
//   - GET /api/health         — backend status pill in the trust strip
//   - GET /api/transactions/stats — global stats banner
//   - POST /api/users/connect — when user clicks "Connect wallet"
// ─────────────────────────────────────────────────────────────────────────────

export default function Landing() {
  const { account, connect, connecting, roleHint } = useWeb3();
  const [openStep, setOpenStep] = useState(0);
  const [backendOnline, setBackendOnline] = useState(null);
  const [stats, setStats] = useState(null);

  // Keep the public landing in sync with the backend's reality.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/health`);
        if (!alive) return;
        setBackendOnline(r.ok);
      } catch {
        if (alive) setBackendOnline(false);
      }
    })();
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/transactions/stats`);
        if (!r.ok) return;
        const data = await r.json();
        if (alive) setStats(data);
      } catch { /* feed offline — non-fatal */ }
    })();
    return () => { alive = false; };
  }, []);

  // Persist the wallet on first connect so the backend has a record.
  async function handleConnect() {
    await connect();
  }

  useEffect(() => {
    if (!account) return;
    fetch(`${BACKEND_URL}/api/users/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: account, role: roleHint || "unknown" }),
    }).catch(() => { /* silent — backend may be offline */ });
  }, [account, roleHint]);

  return (
    <div className="container reveal">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero-text">
          <h1 className="lp-hero-title">
            Tokenized real estate, <span className="hl">zero-ETH</span> claim
          </h1>
          <p className="lp-hero-sub">
            Buy fractional ownership of real properties, earn USDC rent every
            epoch, and trade anytime. Gas is paid in Mock USD via the Universal
            Gas Framework — your wallet never needs ETH.
          </p>
          <div className="flex gap-3 flex-wrap">
            {account ? (
              <Link to="/marketplace" className="btn btn-primary btn-xl">
                Open marketplace <Icon name="arrowRight" size={16} />
              </Link>
            ) : (
              <button className="btn btn-primary btn-xl" onClick={handleConnect} disabled={connecting}>
                {connecting ? "Connecting…" : "Book a connection"}
              </button>
            )}
            <a href="#how-it-works" className="btn btn-secondary btn-xl">How it works</a>
          </div>
        </div>
        <div className="lp-hero-illu" aria-hidden="true">
          <HeroIllustration />
        </div>
      </section>

      {/* ── Trust / status strip ─────────────────────────────────────────── */}
      <div className="trust-strip">
        <span className="item">
          <span className="status-dot" /> <strong>Base Sepolia</strong> testnet
        </span>
        <span className="item">
          <Icon name="shield" size={14} /> <strong>Audit-ready</strong> contracts
        </span>
        <span className="item">
          <Icon name="bolt" size={14} /> <strong>Gasless</strong> via UGF
        </span>
        <span className="item">
          <Icon name="globe" size={14} />
          <strong>API</strong> {backendOnline === null ? "checking…" : backendOnline ? "online" : "offline"}
        </span>
      </div>

      {/* ── Logos (mock partners) ────────────────────────────────────────── */}
      <div className="lp-logos">
        <div className="lp-logo"><Logo size={24} showWordmark={false} /> Base</div>
        <div className="lp-logo"><Icon name="bolt" size={20} /> UGF</div>
        <div className="lp-logo"><Icon name="layers" size={20} /> ERC-20</div>
        <div className="lp-logo"><Icon name="dollar" size={20} /> USDC</div>
        <div className="lp-logo"><Icon name="shield" size={20} /> OpenZeppelin</div>
        <div className="lp-logo"><Icon name="globe" size={20} /> MongoDB</div>
      </div>

      {/* ── Services / what we do ────────────────────────────────────────── */}
      <section className="section" style={{ marginTop: "var(--space-20)" }} id="services">
        <div className="lp-section-head">
          <h2 className="lp-section-title">Services</h2>
          <p className="lp-section-sub">
            Everything a property owner or fractional investor needs — minted,
            traded, and settled on-chain with gas paid in Mock USD.
          </p>
        </div>

        <div className="lp-service-grid">
          <ServiceCard
            tone="grey"
            titleA="Fractional"
            titleB="ownership"
            href="/marketplace"
            illustration={<IlluTokens />}
          />
          <ServiceCard
            tone="green"
            titleA="USDC rent"
            titleB="distributions"
            href="/dividends"
            illustration={<IlluRent />}
          />
          <ServiceCard
            tone="dark"
            titleA="Zero-ETH"
            titleB="gasless claims"
            href="/dividends"
            illustration={<IlluUgf />}
          />
          <ServiceCard
            tone="grey"
            titleA="Secondary"
            titleB="marketplace"
            href="/portfolio"
            illustration={<IlluMarket />}
          />
          <ServiceCard
            tone="green"
            titleA="Owner"
            titleB="control room"
            href="/owner"
            illustration={<IlluOwner />}
          />
          <ServiceCard
            tone="dark"
            titleA="Activity"
            titleB="and analytics"
            href="/portfolio"
            illustration={<IlluAnalytics />}
          />
        </div>
      </section>

      {/* ── CTA banner ───────────────────────────────────────────────────── */}
      <section className="section">
        <div className="lp-cta">
          <div className="lp-cta-text">
            <h3 className="lp-cta-title">
              Let's open your zero-ETH portfolio
            </h3>
            <p className="lp-cta-sub">
              Connect MetaMask, switch to Base Sepolia, and claim your first
              rent in under a minute. No native gas required.
            </p>
            <div className="flex gap-3 flex-wrap" style={{ marginTop: "var(--space-6)" }}>
              <button className="btn btn-primary btn-lg" onClick={handleConnect} disabled={connecting || !!account}>
                {account ? "Wallet connected" : connecting ? "Connecting…" : "Connect wallet"}
              </button>
              <Link to="/marketplace" className="btn btn-secondary btn-lg">Browse properties</Link>
            </div>
          </div>
          <div className="lp-cta-illu" aria-hidden="true">
            <CtaIllustration />
          </div>
        </div>
      </section>

      {/* ── Stats — pulled live from /api/transactions/stats ─────────────── */}
      {stats && (
        <section className="section">
          <div className="lp-section-head">
            <h2 className="lp-section-title">By the numbers</h2>
            <p className="lp-section-sub">
              Live aggregates from every transaction logged through the backend
              — refreshed each time the page loads.
            </p>
          </div>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label"><Icon name="history" size={12} /> Total transactions</div>
              <div className="stat-value">{stats.totalTransactions ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><Icon name="bolt" size={12} /> Gasless via UGF</div>
              <div className="stat-value">{stats.ugfTransactions ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><Icon name="coins" size={12} /> Rent claimed</div>
              <div className="stat-value">${(stats.totalClaimed ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><Icon name="trending" size={12} /> Tokens bought</div>
              <div className="stat-value">${(stats.totalInvested ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </section>
      )}

      {/* ── How it works (Process accordion) ─────────────────────────────── */}
      <section className="section" id="how-it-works">
        <div className="lp-section-head">
          <h2 className="lp-section-title">How it works</h2>
          <p className="lp-section-sub">
            Four steps from "connect wallet" to "rent in your account" — every
            on-chain action is wrapped by the Universal Gas Framework.
          </p>
        </div>

        <div className="lp-process">
          {STEPS.map((step, i) => (
            <ProcessStep
              key={i}
              num={`0${i + 1}`}
              title={step.title}
              body={step.body}
              isOpen={openStep === i}
              onToggle={() => setOpenStep(openStep === i ? -1 : i)}
            />
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="lp-footer" id="contact">
        <div className="lp-footer-top">
          <Logo size={32} className="logo" />
          <nav className="lp-footer-nav">
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/portfolio">Portfolio</Link>
            <Link to="/dividends">Claim rent</Link>
            <a href="#how-it-works">How it works</a>
          </nav>
        </div>

        <div className="lp-footer-grid">
          <div>
            <h4>Contact us</h4>
            <div className="lp-footer-contact">
              <p><strong>Network:</strong> Base Sepolia (chain id 84532)</p>
              <p><strong>API:</strong> {BACKEND_URL}</p>
              <p><strong>License:</strong> design CC BY 4.0 — Positivus by Olga</p>
            </div>
          </div>

          <div>
            <h4>Stay updated</h4>
            <form
              className="lp-footer-form"
              onSubmit={(e) => {
                e.preventDefault();
                /* placeholder — backend has no /api/subscribe yet */
              }}
            >
              <input type="email" placeholder="Email" aria-label="Email" />
              <button type="submit" className="btn btn-gold">Subscribe</button>
            </form>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} RealChain — UGF Hackathon submission.</span>
          <span>
            Design adapted from{" "}
            <a href="https://www.figma.com/community/file/1230604708032389430/positivus-landing-page-design" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
              Positivus by Olga
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: "Connect your wallet & pick your role",
    body: "Connect MetaMask and we detect whether you're a property owner or an investor based on on-chain holdings. The role decides which dashboard greets you next.",
  },
  {
    title: "Browse properties on the marketplace",
    body: "Each property mints a fixed supply of PROP tokens. Buy directly from the owner at the listing price, or pick up a peer listing on the secondary market.",
  },
  {
    title: "Earn USDC rent each epoch",
    body: "When the property owner deposits rent, our RentalDistribution contract snapshots balances and lets every token holder claim a pro-rata USDC share at any time.",
  },
  {
    title: "Pay gas in Mock USD via UGF",
    body: "Every state-changing call routes through the Universal Gas Framework. Your wallet pays gas in TYI_MOCK_USD instead of native ETH — onboarding works even with a fresh wallet.",
  },
];

function ServiceCard({ tone, titleA, titleB, href, illustration }) {
  return (
    <Link to={href} className={`lp-service is-${tone}`}>
      <div className="lp-service-head">
        <h3 className="lp-service-title">
          <span className="pill">{titleA}</span>
          <br />
          {titleB}
        </h3>
        <span className="lp-service-link">
          <span className="arrow"><Icon name="arrowRight" size={16} /></span>
          Learn more
        </span>
      </div>
      <div className="lp-service-illu">{illustration}</div>
    </Link>
  );
}

function ProcessStep({ num, title, body, isOpen, onToggle }) {
  return (
    <div className={`lp-step ${isOpen ? "is-open" : ""}`}>
      <button className="lp-step-head" onClick={onToggle} aria-expanded={isOpen}>
        <span className="lp-step-num">{num}</span>
        <span className="lp-step-title">{title}</span>
        <span className="lp-step-toggle" aria-hidden="true">
          <Icon name={isOpen ? "minus" : "plus"} size={20} />
        </span>
      </button>
      <div className="lp-step-body">{body}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline SVG illustrations — simple geometric shapes in Positivus's vocabulary
// (lime + black + grey) so we don't depend on the original PNG asset pack.
// ─────────────────────────────────────────────────────────────────────────────

function HeroIllustration() {
  return (
    <svg viewBox="0 0 600 460" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tokenized buildings">
      {/* sky / backdrop */}
      <rect x="0" y="0" width="600" height="460" fill="none" />
      {/* Big lime building */}
      <rect x="80" y="120" width="180" height="280" fill="#B9FF66" stroke="#191A23" strokeWidth="2" rx="14" />
      <g fill="#191A23">
        <rect x="100" y="150" width="30" height="30" rx="4" />
        <rect x="150" y="150" width="30" height="30" rx="4" />
        <rect x="200" y="150" width="30" height="30" rx="4" />
        <rect x="100" y="200" width="30" height="30" rx="4" />
        <rect x="150" y="200" width="30" height="30" rx="4" />
        <rect x="200" y="200" width="30" height="30" rx="4" />
        <rect x="100" y="250" width="30" height="30" rx="4" />
        <rect x="150" y="250" width="30" height="30" rx="4" />
        <rect x="200" y="250" width="30" height="30" rx="4" />
        <rect x="100" y="300" width="30" height="30" rx="4" />
        <rect x="150" y="300" width="30" height="30" rx="4" />
        <rect x="200" y="300" width="30" height="30" rx="4" />
        <rect x="148" y="350" width="34" height="50" rx="4" />
      </g>
      {/* Tall black tower */}
      <rect x="290" y="60" width="130" height="340" fill="#191A23" rx="14" />
      <g fill="#B9FF66">
        <rect x="310" y="85" width="20" height="30" rx="3" />
        <rect x="345" y="85" width="20" height="30" rx="3" />
        <rect x="380" y="85" width="20" height="30" rx="3" />
        <rect x="310" y="130" width="20" height="30" rx="3" />
        <rect x="345" y="130" width="20" height="30" rx="3" />
        <rect x="380" y="130" width="20" height="30" rx="3" />
        <rect x="310" y="175" width="20" height="30" rx="3" />
        <rect x="345" y="175" width="20" height="30" rx="3" />
        <rect x="380" y="175" width="20" height="30" rx="3" />
        <rect x="310" y="220" width="20" height="30" rx="3" />
        <rect x="345" y="220" width="20" height="30" rx="3" />
        <rect x="380" y="220" width="20" height="30" rx="3" />
        <rect x="310" y="265" width="20" height="30" rx="3" />
        <rect x="345" y="265" width="20" height="30" rx="3" />
        <rect x="380" y="265" width="20" height="30" rx="3" />
      </g>
      {/* Token coins */}
      <g>
        <circle cx="465" cy="240" r="60" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
        <text x="465" y="252" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="36" fill="#191A23">$</text>
      </g>
      <g>
        <circle cx="510" cy="340" r="36" fill="#191A23" />
        <text x="510" y="350" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="22" fill="#B9FF66">P</text>
      </g>
      {/* Ground */}
      <rect x="0" y="395" width="600" height="6" fill="#191A23" />
    </svg>
  );
}

function CtaIllustration() {
  return (
    <svg viewBox="0 0 280 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="20" y="60" width="160" height="140" fill="#B9FF66" stroke="#191A23" strokeWidth="2" rx="14" />
      <rect x="40" y="80" width="40" height="20" fill="#191A23" rx="4" />
      <rect x="40" y="110" width="120" height="10" fill="#191A23" rx="4" opacity="0.5" />
      <rect x="40" y="130" width="100" height="10" fill="#191A23" rx="4" opacity="0.5" />
      <rect x="40" y="160" width="60" height="24" fill="#191A23" rx="6" />
      <circle cx="220" cy="80" r="40" fill="#191A23" />
      <text x="220" y="90" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="24" fill="#B9FF66">UGF</text>
      <path d="M180 130 L210 110" stroke="#191A23" strokeWidth="3" strokeLinecap="round" />
      <path d="M210 110 L205 118 M210 110 L202 105" stroke="#191A23" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IlluTokens() {
  return (
    <svg viewBox="0 0 200 180" aria-hidden="true">
      <circle cx="60" cy="90" r="50" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
      <circle cx="120" cy="90" r="50" fill="#191A23" />
      <text x="60" y="100" textAnchor="middle" fontFamily="Space Grotesk" fontWeight="700" fontSize="28" fill="#191A23">P</text>
      <text x="120" y="100" textAnchor="middle" fontFamily="Space Grotesk" fontWeight="700" fontSize="28" fill="#B9FF66">$</text>
    </svg>
  );
}
function IlluRent() {
  return (
    <svg viewBox="0 0 200 180" aria-hidden="true">
      <rect x="40" y="40" width="120" height="100" fill="#191A23" rx="10" />
      <text x="100" y="105" textAnchor="middle" fontFamily="Space Grotesk" fontWeight="700" fontSize="48" fill="#B9FF66">$</text>
      <path d="M100 145 L100 170" stroke="#191A23" strokeWidth="4" />
      <circle cx="100" cy="172" r="6" fill="#191A23" />
    </svg>
  );
}
function IlluUgf() {
  return (
    <svg viewBox="0 0 200 180" aria-hidden="true">
      <path d="M100 30 L60 100 L100 100 L80 150 L140 80 L100 80 Z" fill="#B9FF66" stroke="#191A23" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function IlluMarket() {
  return (
    <svg viewBox="0 0 200 180" aria-hidden="true">
      <rect x="20" y="60" width="50" height="90" fill="#191A23" rx="6" />
      <rect x="80" y="40" width="50" height="110" fill="#B9FF66" stroke="#191A23" strokeWidth="2" rx="6" />
      <rect x="140" y="80" width="50" height="70" fill="#191A23" rx="6" />
      <path d="M30 50 L100 30 L170 70" stroke="#191A23" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
function IlluOwner() {
  return (
    <svg viewBox="0 0 200 180" aria-hidden="true">
      <rect x="40" y="60" width="120" height="100" fill="#B9FF66" stroke="#191A23" strokeWidth="2" rx="10" />
      <polygon points="40,60 100,20 160,60" fill="#191A23" />
      <rect x="85" y="100" width="30" height="60" fill="#191A23" rx="4" />
      <rect x="55" y="80" width="20" height="20" fill="#191A23" rx="3" />
      <rect x="125" y="80" width="20" height="20" fill="#191A23" rx="3" />
    </svg>
  );
}
function IlluAnalytics() {
  return (
    <svg viewBox="0 0 200 180" aria-hidden="true">
      <rect x="20" y="40" width="160" height="100" fill="#B9FF66" stroke="#191A23" strokeWidth="2" rx="8" />
      <polyline points="40,110 70,80 95,95 130,55 160,70" fill="none" stroke="#191A23" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="40" cy="110" r="4" fill="#191A23" />
      <circle cx="70" cy="80" r="4" fill="#191A23" />
      <circle cx="95" cy="95" r="4" fill="#191A23" />
      <circle cx="130" cy="55" r="4" fill="#191A23" />
      <circle cx="160" cy="70" r="4" fill="#191A23" />
    </svg>
  );
}
