import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useInView, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";
import { usePrivyEmbeddedSignIn } from "../context/PrivyBridge";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import LiveRentCounter from "../components/LiveRentCounter";
import { BACKEND_URL, NETWORK_CHAIN_ID } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// Landing — Positivus-styled marketing page for RealChain.
//
// Adapted from the Positivus Figma template (CC BY 4.0):
//   https://www.figma.com/community/file/1230604708032389430
// Coded reference: https://github.com/zakariamouhid/positivus-from-figma
//
// Every counter, label, and status indicator is sourced from a real provider:
//   - Network label & status: NETWORK_CHAIN_ID + Web3Context.nodeOnline
//   - API status:               GET /api/health
//   - Live counters:            on-chain factory.getPropertiesCount()
//                               + GET /api/transactions/stats
//   - Stats section:            GET /api/transactions/stats
//   - Recent activity preview:  GET /api/transactions?limit=5
//   - Subscribe form:           native mailto: handoff (no fake handler)
//   - User upsert:              POST /api/users/connect on wallet connect
// ─────────────────────────────────────────────────────────────────────────────

const NETWORK_LABEL = {
  31337:    "Hardhat local",
  11155111: "Ethereum Sepolia",
  84532:    "Base Sepolia",
};

export default function Landing() {
  const { account, connect, connecting, roleHint, nodeOnline, chainId, isCorrectNetwork, getReadFactory } = useWeb3();
  const { user: authUser, dashboardForRole } = useAuth();
  // Tier 3 / 6.1 — embedded wallet onboarding. `enabled` is false (and the
  // button hidden) unless VITE_PRIVY_APP_ID is set in .env.
  const privy = usePrivyEmbeddedSignIn();
  const [openStep, setOpenStep] = useState(0);
  const [backendOnline, setBackendOnline] = useState(null);
  const [stats, setStats] = useState(null);
  const [propertyCount, setPropertyCount] = useState(null);
  const [recent, setRecent] = useState([]);

  // ── Backend health, stats and recent activity ──────────────────────────────
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
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/transactions?limit=5`);
        if (!r.ok) return;
        const data = await r.json();
        if (!alive) return;
        const list = Array.isArray(data) ? data : (data.transactions || data.items || []);
        setRecent(list);
      } catch { /* non-fatal */ }
    })();
    return () => { alive = false; };
  }, []);

  // ── On-chain property count for the live counters strip ────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const factory = getReadFactory();
        const c = Number(await factory.getPropertiesCount());
        if (alive) setPropertyCount(c);
      } catch (_) {
        if (alive) setPropertyCount(null);
      }
    })();
    return () => { alive = false; };
  }, [getReadFactory]);

  // ── Persist the connected wallet to the backend ────────────────────────────
  useEffect(() => {
    if (!account) return;
    fetch(`${BACKEND_URL}/api/users/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: account, role: (roleHint || "unknown").toLowerCase() }),
    }).catch(() => { /* backend may be offline */ });
  }, [account, roleHint]);

  const networkName = NETWORK_LABEL[NETWORK_CHAIN_ID] || `Chain ${NETWORK_CHAIN_ID}`;
  const networkOk = nodeOnline === true && (account ? isCorrectNetwork : true);

  // Counters strip is computed entirely from real sources.
  const counters = useMemo(() => [
    {
      label: "Properties on-chain",
      value: propertyCount == null ? "—" : String(propertyCount),
      icon: "building",
      source: "factory.getPropertiesCount()",
    },
    {
      label: "Transactions logged",
      value: stats?.totalTransactions == null ? "—" : String(stats.totalTransactions),
      icon: "history",
      source: "/api/transactions/stats",
    },
    {
      label: "Gasless via UGF",
      value: stats?.ugfTransactions == null ? "—" : String(stats.ugfTransactions),
      icon: "bolt",
      source: "/api/transactions/stats",
    },
    {
      label: "Rent claimed (USDC)",
      value: stats?.totalClaimed == null
        ? "—"
        : `$${Number(stats.totalClaimed).toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
      icon: "coins",
      source: "/api/transactions/stats",
    },
  ], [propertyCount, stats]);

  return (
    <div className="container reveal">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <HeroSection
        account={account}
        authUser={authUser}
        connect={connect}
        connecting={connecting}
        dashboardForRole={dashboardForRole}
        networkName={networkName}
        privy={privy}
      />

      {/* ── Trust / status strip — every value is dynamic ────────────────── */}
      <div className="trust-strip">
        <span className="item">
          <span className="status-dot" style={networkOk ? null : { background: "var(--red-500)" }} />
          <strong>{networkName}</strong>
          {nodeOnline === false ? " · offline" : account && !isCorrectNetwork ? " · wrong network" : ""}
        </span>
        <span className="item">
          <Icon name="globe" size={14} />
          <strong>API</strong>
          {backendOnline === null ? " checking…" : backendOnline ? " online" : " offline"}
        </span>
        {account ? (
          <span className="item">
            <Icon name="wallet" size={14} />
            <strong>Wallet</strong> {roleHint || "connected"}
          </span>
        ) : (
          <span className="item">
            <Icon name="wallet" size={14} />
            <strong>Wallet</strong> not connected
          </span>
        )}
      </div>

      {/* ── Live counters strip (replaces the previous "logos" row) ──────── */}
      <div className="lp-logos">
        {counters.map((c) => (
          <div className="lp-counter" key={c.label} title={`Source: ${c.source}`}>
            <span className="lp-counter-label">
              <Icon name={c.icon} size={14} /> {c.label}
            </span>
            <span className="lp-counter-value">{c.value}</span>
          </div>
        ))}
      </div>

      {/* ── Spotlight: zero-ETH claim, in plain English ──────────────────── */}
      <SpotlightSection />

      {/* ── Smart Agent showcase ─────────────────────────────────────────── */}
      <SmartAgentSection />

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
          <ServiceCard tone="grey"  titleA="Fractional"  titleB="ownership"        href="/marketplace" illustration={<IlluTokens />} />
          <ServiceCard tone="green" titleA="USDC rent"   titleB="distributions"    href="/dividends"   illustration={<IlluRent />} />
          <ServiceCard tone="dark"  titleA="Zero-ETH"    titleB="gasless claims"   href="/dividends"   illustration={<IlluUgf />} />
          <ServiceCard tone="grey"  titleA="Secondary"   titleB="marketplace"      href="/portfolio"   illustration={<IlluMarket />} />
          <ServiceCard tone="green" titleA="Owner"       titleB="control room"     href="/owner"       illustration={<IlluOwner />} />
          <ServiceCard tone="dark"  titleA="Activity"    titleB="and analytics"    href="/portfolio"   illustration={<IlluAnalytics />} />
        </div>
      </section>

      {/* ── Tech stack breakdown ─────────────────────────────────────────── */}
      <TechStackSection />

      {/* ── Comparison: RealChain vs the alternatives ────────────────────── */}
      <ComparisonSection />

      {/* ── CTA banner ───────────────────────────────────────────────────── */}
      <section className="section">
        <div className="lp-cta">
          <div className="lp-cta-text">
            <h3 className="lp-cta-title">
              Let's open your zero-ETH portfolio
            </h3>
            <p className="lp-cta-sub">
              Connect MetaMask, switch to {networkName}, and claim your first
              rent in under a minute. No native gas required.
            </p>
            <div className="flex gap-3 flex-wrap" style={{ marginTop: "var(--space-6)" }}>
              <button className="btn btn-primary btn-lg" onClick={connect} disabled={connecting || !!account}>
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

      {/* ── Project architecture ─────────────────────────────────────────── */}
      <ArchitectureSection />

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

      {/* ── Features gallery ─────────────────────────────────────────────── */}
      <FeaturesGallerySection />

      {/* ── Recent activity preview — only renders when real rows exist ──── */}
      {recent.length > 0 && (
        <section className="section">
          <div className="lp-section-head">
            <h2 className="lp-section-title">Recent activity</h2>
            <p className="lp-section-sub">
              The five most recent transactions logged through the backend.
              Visit the marketplace for the full live feed.
            </p>
          </div>
          <div className="card card-elevated">
            <div className="table-wrap" style={{ border: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>From</th>
                    <th>Amount</th>
                    <th>Gas</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t, i) => (
                    <tr key={t.txHash || t._id || i}>
                      <td><span className="badge badge-muted">{t.type}</span></td>
                      <td className="font-mono text-sm">{t.from ? `${t.from.slice(0, 6)}…${t.from.slice(-4)}` : "—"}</td>
                      <td className="font-bold">${Number(t.amount || 0).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${t.gasMethod === "ugf" ? "badge-accent" : "badge-muted"}`}>
                          {t.gasMethod === "ugf" ? "gasless" : "ETH"}
                        </span>
                      </td>
                      <td className="text-muted text-sm">{t.createdAt ? new Date(t.createdAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Animated workflow ────────────────────────────────────────────── */}
      <AnimatedWorkflowSection />

      {/* ── Owner tokenization flow ─────────────────────────────────────── */}
      <OwnerFlowSection />

      {/* ── How it works ─────────────────────────────────────────────────── */}
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
            <h4>Status</h4>
            <div className="lp-footer-contact">
              <p><strong>Network:</strong> {networkName} (chain id {NETWORK_CHAIN_ID})</p>
              <p><strong>API:</strong> {BACKEND_URL} · {backendOnline === null ? "checking…" : backendOnline ? "online" : "offline"}</p>
            </div>
          </div>

          <div>
            <h4>Get in touch</h4>
            {/* Native mailto handoff — no fake submit handler. */}
            <form
              className="lp-footer-form"
              action="mailto:hello@realchain.local"
              method="post"
              encType="text/plain"
            >
              <input type="email" name="email" placeholder="your@email.com" aria-label="Your email" required />
              <button type="submit" className="btn btn-gold">Email us</button>
            </form>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} RealChain — UGF Hackathon submission.</span>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HeroSection — full-viewport, "living" hero per the redesign spec.
// Layered above the page in three planes:
//   1) Ambient orbs (slow lime / mint / cool drifts, blurred 80px)
//   2) Floating ETH + USDC coins with mouse parallax
//   3) Frosted text + illustration plates with staggered word reveal
//
// Reduced-motion: every long animation collapses to a static state. Parallax
// is also disabled — the cursor effect would be more distracting than useful.
// ─────────────────────────────────────────────────────────────────────────────

const HERO_TITLE_PARTS = [
  { text: "Tokenized" },
  { text: "real" },
  { text: "estate," },
  { text: "zero-ETH", chip: true },
  { text: "claim" },
];

function HeroSection({ account, authUser, connect, connecting, dashboardForRole, networkName, privy }) {
  const reduce = useReducedMotion();
  const stageRef = useRef(null);
  // Parallax offsets are kept in CSS variables on the stage element so the
  // floating coins can opt in via var(--hero-px-*). Avoids re-rendering React
  // on every mousemove — everything stays GPU-only.
  useEffect(() => {
    if (reduce) return undefined;
    const el = stageRef.current;
    if (!el) return undefined;
    let raf = 0;
    let pendingX = 0, pendingY = 0;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      pendingX = e.clientX - cx;
      pendingY = e.clientY - cy;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // ETH at 0.03, USDC at 0.02 per spec
        el.style.setProperty("--hero-px-eth-x", `${(pendingX * 0.03).toFixed(1)}px`);
        el.style.setProperty("--hero-px-eth-y", `${(pendingY * 0.03).toFixed(1)}px`);
        el.style.setProperty("--hero-px-usdc-x", `${(pendingX * 0.02).toFixed(1)}px`);
        el.style.setProperty("--hero-px-usdc-y", `${(pendingY * 0.02).toFixed(1)}px`);
      });
    };
    const onLeave = () => {
      el.style.setProperty("--hero-px-eth-x", "0px");
      el.style.setProperty("--hero-px-eth-y", "0px");
      el.style.setProperty("--hero-px-usdc-x", "0px");
      el.style.setProperty("--hero-px-usdc-y", "0px");
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce]);

  return (
    <section ref={stageRef} className="lp-hero-stage lp-hero-stage--living" aria-label="Hero">
      {/* Ambient orbs — atmospheric depth, soft drift */}
      <span className="lp-hero-orb lp-hero-orb--xl is-lime" aria-hidden="true" />
      <span className="lp-hero-orb lp-hero-orb--xl is-mint" aria-hidden="true" />
      <span className="lp-hero-orb lp-hero-orb--xl is-cool" aria-hidden="true" />
      <span className="lp-hero-orb lp-hero-orb--xl is-warm" aria-hidden="true" />
      <span className="lp-hero-grid" aria-hidden="true" />

      {/* Floating coins — distributed across the canvas. ETH coins have
          been removed by request: their Ξ glyph rendered as a 3-line shape
          that read like a hamburger menu icon. USDC coins remain to give
          the canvas the same depth without that ambiguity. */}
      <CoinUsdc size={64} pos="top-right"     duration={4}   delay={0}     />
      <CoinUsdc size={56} pos="mid-right"     duration={4}   delay={1.2}   />
      <CoinUsdc size={42} pos="bottom-mid"    duration={4}   delay={2.5}   background />
      <CoinUsdc size={38} pos="top-left"      duration={4}   delay={0.7}   background />
      <CoinUsdc size={44} pos="bottom-left"   duration={4}   delay={1.9}   background />

      <section className="lp-hero lp-hero--living">
        <div className="lp-hero-text lp-hero-text--living">
          <span className="lp-hero-eyebrow lp-hero-eyebrow--zero" data-pulse>
            <span className="lp-hero-eyebrow-dot" />
            zero-ETH claim
            <span className="lp-hero-eyebrow-sep">·</span>
            {networkName}
          </span>
          <h1 className="lp-hero-title lp-hero-title--staggered">
            {HERO_TITLE_PARTS.map((part, i) => (
              <motion.span
                key={`${part.text}-${i}`}
                initial={reduce ? false : { opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
                className={part.chip ? "hl-word" : "lp-hero-word"}
              >
                {part.chip ? <span className="hl">{part.text}</span> : part.text}
                {i < HERO_TITLE_PARTS.length - 1 ? " " : ""}
              </motion.span>
            ))}
          </h1>
          <motion.p
            className="lp-hero-sub"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          >
            Buy fractional ownership of real properties, earn USDC rent every
            epoch, and trade anytime. Gas is paid in Mock USD via the Universal
            Gas Framework — your wallet never needs ETH.
          </motion.p>
          <motion.div
            className="flex gap-3 flex-wrap lp-hero-cta-row"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {authUser ? (
              <Link to={dashboardForRole(authUser.role)} className="btn btn-primary btn-xl lp-cta-connect">
                Open dashboard <Icon name="arrowRight" size={16} />
              </Link>
            ) : (
              <Link to="/signup" className="btn btn-primary btn-xl lp-cta-connect">
                Create account <Icon name="arrowRight" size={16} />
              </Link>
            )}
            {authUser ? (
              <Link to="/marketplace" className="btn btn-secondary btn-xl">
                Marketplace
              </Link>
            ) : (
              <Link to="/login" className="btn btn-secondary btn-xl">
                Log in
              </Link>
            )}
            {!account && (
              <button className="btn btn-ghost btn-xl" onClick={connect} disabled={connecting}>
                {connecting ? "Connecting..." : "Connect wallet"}
              </button>
            )}
            {/* Tier 3 / 6.1 — Privy email/social sign-in. Renders only when
                VITE_PRIVY_APP_ID is configured; otherwise privy.enabled is
                false and this branch collapses to nothing. */}
            {!account && privy?.enabled && (
              <button
                type="button"
                className="btn btn-ghost btn-xl lp-cta-privy"
                onClick={privy.login}
                disabled={privy.loading}
              >
                {privy.loading ? "Opening…" : "Sign in with email"}
              </button>
            )}
            <a href="#how-it-works" className="btn btn-secondary btn-xl lp-cta-howitworks">
              How it works
              <span className="lp-cta-shimmer" aria-hidden="true" />
            </a>
          </motion.div>
          <LiveRentCounter className="lp-hero-counter" />
        </div>

        <motion.div
          className="lp-hero-illu lp-hero-illu--living"
          aria-hidden="true"
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <span className="lp-hero-illu-glow" />
          <div className="lp-hero-illu-float">
            <HeroIllustration />
            {/* Micro-animated accent: lightning bolt rotation */}
            <span className="lp-hero-bolt" aria-hidden="true">
              <Icon name="bolt" size={26} />
            </span>
            {/* Primary dollar coin with scale pulse */}
            <span className="lp-hero-dollar lp-hero-dollar--primary" aria-hidden="true">$</span>
            {/* Orbiting USDC settle coin around the primary */}
            <span className="lp-hero-orbit" aria-hidden="true">
              <span className="lp-hero-orbit-coin">$</span>
            </span>
          </div>
          <span className="lp-hero-illu-pill is-top">
            <Icon name="bolt" size={11} /> ERC-20Votes
          </span>
        </motion.div>
      </section>
    </section>
  );
}

function CoinUsdc({ size = 56, pos = "mid-right", duration = 4, delay = 0, background = false }) {
  // Outer wrapper: positions the coin and consumes the mouse-parallax CSS
  // variables. This element does NOT animate, so the parallax `translate`
  // never collides with the keyframe's `translateY`.
  // Inner element: runs the floatCoin keyframes on its own. Stacking the
  // two means the parallax shift composes cleanly with the float bob.
  return (
    <span
      className={`lp-coin-wrap pos-${pos} ${background ? "is-bg" : ""}`}
      aria-hidden="true"
    >
      <span
        className="lp-coin lp-coin-usdc"
        style={{
          "--coin-size": `${size}px`,
          "--coin-dur": `${duration}s`,
          "--coin-delay": `${delay}s`,
        }}
      >
        <span className="lp-coin-rim" />
        <span className="lp-coin-glyph">$</span>
      </span>
    </span>
  );
}

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
// Inline SVG illustrations — geometric shapes in the Positivus vocabulary
// (lime + black + grey). No raster assets, no external dependencies.
// ─────────────────────────────────────────────────────────────────────────────

function HeroIllustration() {
  return (
    <svg viewBox="0 0 600 460" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tokenized buildings">
      <rect x="0" y="0" width="600" height="460" fill="none" />
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
      {/* Dollar coin — clean canonical $ symbol on lime, with Positivus border */}
      <g className="lp-hero-dollar">
        <circle cx="465" cy="240" r="60" fill="#B9FF66" stroke="#191A23" strokeWidth="2.5" />
        {/* Inner ring for depth */}
        <circle cx="465" cy="240" r="50" fill="none" stroke="#191A23" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.45" />
        {/* The $ glyph drawn as paths — vertical stem plus stylised S curves */}
        <path
          d="M465 207 L465 273"
          stroke="#191A23"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M481 222 Q 481 213 472 213 L 458 213 Q 449 213 449 222 Q 449 231 458 231 L 472 231 Q 481 231 481 240 Q 481 249 472 249 L 458 249 Q 449 249 449 240"
          fill="none"
          stroke="#191A23"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Ethereum mark — canonical double-pyramid diamond, six faces */}
      <g className="lp-hero-eth">
        <circle cx="510" cy="340" r="40" fill="#191A23" stroke="#191A23" strokeWidth="2" />
        {/* Upper pyramid (apex at the top) — left face slightly muted, right face solid */}
        <polygon points="510,313 493,343 510,333"          fill="#B9FF66" opacity="0.65" />
        <polygon points="510,313 527,343 510,333"          fill="#B9FF66" />
        {/* Middle band — the iconic break at the diamond's waist, both sides */}
        <polygon points="493,343 510,333 510,353"          fill="#B9FF66" opacity="0.85" />
        <polygon points="527,343 510,333 510,353"          fill="#B9FF66" opacity="0.55" />
        {/* Lower pyramid (apex pointing down) — same left/right shading */}
        <polygon points="493,347 510,357 510,372"          fill="#B9FF66" opacity="0.65" />
        <polygon points="527,347 510,357 510,372"          fill="#B9FF66" />
      </g>
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

// ─────────────────────────────────────────────────────────────────────────────
// Framer Motion helpers
// ─────────────────────────────────────────────────────────────────────────────

// <Reveal> — generic scroll-triggered fade + slide-up. Honours
// prefers-reduced-motion automatically.
function Reveal({ children, delay = 0, y = 24, className = "", as = "div" }) {
  const reduce = useReducedMotion();
  const Component = motion[as] || motion.div;
  return (
    <Component
      className={className}
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}

// <Stagger> — wraps a list and staggers its children's entrance.
function Stagger({ children, delay = 0, stagger = 0.08, className = "" }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

const STAGGER_ITEM = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

// <FloatIcon> — wraps any icon/logo with an organic floating loop. Each
// instance picks its own duration/delay/amplitude so a row of icons never
// looks synchronized.
function FloatIcon({ children, duration = 3.4, delay = 0, amplitude = 6, rotate = 2, className = "" }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <span className={`lp-float ${className}`}>{children}</span>;
  }
  return (
    <motion.span
      className={`lp-float ${className}`}
      animate={{
        y: [0, -amplitude, 0, amplitude * 0.5, 0],
        rotate: [0, -rotate, 0, rotate, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tech stack breakdown
// ─────────────────────────────────────────────────────────────────────────────

const TECH_GROUPS = [
  {
    title: "Frontend",
    tone: "green",
    items: [
      { name: "React 18",          why: "Battle-tested component model and concurrent rendering for instant role-aware UI updates.", icon: <TechReact /> },
      { name: "Vite 8",            why: "Sub-second cold start and HMR keeps the wallet/contract iteration loop tight.",            icon: <TechVite /> },
      { name: "React Router 6",    why: "Declarative routing for the public landing plus the role-specific dApp shell.",            icon: <TechRouter /> },
      { name: "Framer Motion",     why: "Production-grade animation primitives that respect reduced-motion out of the box.",         icon: <TechFramer /> },
      { name: "Space Grotesk",     why: "Distinctive geometric type that holds up at hero weights and at body sizes alike.",         icon: <TechType /> },
    ],
  },
  {
    title: "Smart contracts",
    tone: "grey",
    items: [
      { name: "Solidity 0.8.28",   why: "Latest stable compiler with built-in overflow checks for safety-critical financial logic.",  icon: <TechSolidity /> },
      { name: "OpenZeppelin 5.6",  why: "Audited base contracts (ERC20Votes, AccessControl) so we don't roll our own primitives.",   icon: <TechOZ /> },
      { name: "Hardhat",           why: "Local chain, fixtures, console.log, and one of the deepest plugin ecosystems for EVM dev.", icon: <TechHardhat /> },
      { name: "Ethers.js 6",       why: "Typed, promise-first contract bindings with robust BigInt handling for token math.",        icon: <TechEthers /> },
    ],
  },
  {
    title: "Backend & data",
    tone: "dark",
    items: [
      { name: "Node 20 + Express", why: "Familiar JS runtime end-to-end; Express keeps the REST surface minimal and inspectable.",   icon: <TechNode /> },
      { name: "MongoDB + Mongoose",  why: "Document model fits transaction logs, holdings, and user profiles without schema migrations.", icon: <TechMongo /> },
      { name: "pino-http",         why: "Structured JSON logs that ship straight to any aggregator; pino-pretty for dev legibility.",  icon: <TechExpress /> },
      { name: "express-rate-limit", why: "Per-IP rate caps on every /api/* path with a stricter bucket on writes — production-safe defaults.", icon: <TechShield /> },
      { name: "On-chain indexer",  why: "Polls PropertyFactory + per-property events every 12s; replaces unverified client-posted analytics.", icon: <TechIndexer /> },
      { name: "SIWE-style auth",   why: "Single-use nonce + ethers.verifyMessage so write routes can require a real wallet signature.",   icon: <TechAuth /> },
    ],
  },
  {
    title: "Web3 & infrastructure",
    tone: "green",
    items: [
      { name: "Universal Gas Framework", why: "Lets investors pay gas in TYI_MOCK_USD instead of native ETH — the demo's centerpiece.", icon: <TechUgf /> },
      { name: "Base Sepolia",      why: "OP-stack L2 with cheap, fast finality and a generous testnet faucet for hackathon demos.",  icon: <TechBase /> },
      { name: "MetaMask",          why: "Default user wallet across browsers; ethers' BrowserProvider makes integration trivial.",   icon: <TechMetaMask /> },
      { name: "USDC (mock)",       why: "Six-decimal stablecoin pattern matches production accounting without real custody risk.",   icon: <TechUsdc /> },
    ],
  },
];

function TechStackSection() {
  return (
    <section className="section" id="tech-stack">
      <Reveal>
        <div className="lp-section-head">
          <h2 className="lp-section-title">Tech stack</h2>
          <p className="lp-section-sub">
            Every dependency earns its place. Here's what powers RealChain
            and why we picked it over the obvious alternatives.
          </p>
        </div>
      </Reveal>

      <Stagger className="lp-tech-grid">
        {TECH_GROUPS.map((group, gi) => (
          <motion.div key={group.title} className={`lp-tech-card is-${group.tone}`} variants={STAGGER_ITEM}>
            <h3 className="lp-tech-card-title">{group.title}</h3>
            <ul className="lp-tech-list">
              {group.items.map((item, ii) => (
                <li className="lp-tech-item" key={item.name}>
                  <FloatIcon
                    duration={3.2 + ((gi + ii) % 5) * 0.35}
                    delay={(ii * 0.18 + gi * 0.12) % 1.6}
                    amplitude={5 + ((gi + ii) % 3)}
                    rotate={2 + ((ii + gi) % 3)}
                    className="lp-tech-icon"
                  >
                    {item.icon}
                  </FloatIcon>
                  <div className="lp-tech-text">
                    <div className="lp-tech-name">{item.name}</div>
                    <div className="lp-tech-why">{item.why}</div>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Project architecture
// ─────────────────────────────────────────────────────────────────────────────

const ARCH_LAYERS = [
  {
    label: "Client",
    color: "green",
    items: [
      { node: "frontend/src/pages",      hint: "Landing, Marketplace, Property, Portfolio, Dividends, Owner, Investor, Watchlist, Analytics" },
      { node: "frontend/src/components", hint: "Icon, Logo, ActivityFeed, FaucetPanel, CostBanner, UGFBadge, Toast, Switch, AgentSuggestions, GasIndicator, HolderList, RentChart, YieldCalculator, LiveRentCounter" },
      { node: "frontend/src/context",    hint: "Web3Context · UGFContext · SmartAgentContext" },
      { node: "frontend/src/hooks",      hint: "useWatchlist · useSiweAuth" },
      { node: "frontend/src/config",     hint: "Network constants · ABIs · BACKEND_URL" },
    ],
  },
  {
    label: "API",
    color: "grey",
    items: [
      { node: "backend/server.js",        hint: "Express bootstrap, CORS, pino-http logging, rate limiter, Mongo connect" },
      { node: "backend/routes",           hint: "/api/auth · /api/properties · /api/transactions · /api/users · /api/faucet" },
      { node: "backend/middleware",       hint: "requireDb (Mongo gate) · siwe (signed-write enforcement)" },
      { node: "backend/jobs/indexer.js",  hint: "12s on-chain event scanner — populates transactions + holdings" },
      { node: "backend/models",           hint: "Property · Transaction · User · Holding · AuthNonce · IndexerCheckpoint" },
    ],
  },
  {
    label: "Chain",
    color: "dark",
    items: [
      { node: "PropertyFactory.sol",       hint: "Deploys the per-property contract trio and registers it" },
      { node: "PropertyToken.sol",         hint: "ERC20Votes share token with snapshot-safe balances" },
      { node: "RentalDistribution.sol",    hint: "Epoch-based pro-rata rent distribution (V1 default)" },
      { node: "RentalDistributionV2.sol",  hint: "O(1) accumulator-based distribution (research surface)" },
      { node: "Marketplace.sol",           hint: "Primary + secondary sales in USDC, owner-funded supply" },
      { node: "MockUSDC.sol",              hint: "6-decimal settlement token (mint is onlyOwner)" },
    ],
  },
];

function ArchitectureSection() {
  return (
    <section className="section" id="architecture">
      <Reveal>
        <div className="lp-section-head">
          <h2 className="lp-section-title">Architecture</h2>
          <p className="lp-section-sub">
            Three crisp layers — the React client talks to the Express API and
            to Base Sepolia in parallel. The chain is the source of truth; the
            backend caches, logs, and aggregates.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="lp-arch-card">
          {ARCH_LAYERS.map((layer, li) => (
            <Stagger key={layer.label} className={`lp-arch-layer is-${layer.color}`} delay={li * 0.08}>
              <motion.div className="lp-arch-layer-head" variants={STAGGER_ITEM}>
                <span className="lp-arch-tag">{layer.label}</span>
              </motion.div>
              <div className="lp-arch-nodes">
                {layer.items.map((it) => (
                  <motion.div className="lp-arch-node" key={it.node} variants={STAGGER_ITEM}>
                    <code className="lp-arch-node-name">{it.node}</code>
                    <span className="lp-arch-node-hint">{it.hint}</span>
                  </motion.div>
                ))}
              </div>
              {li < ARCH_LAYERS.length - 1 && (
                <div className="lp-arch-flow" aria-hidden="true">
                  <ArchArrow />
                </div>
              )}
            </Stagger>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function ArchArrow() {
  return (
    <svg viewBox="0 0 24 60" width="24" height="60" aria-hidden="true">
      <path d="M12 2 V52" stroke="#191A23" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 45 L12 56 L19 45" stroke="#191A23" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Features gallery
// ─────────────────────────────────────────────────────────────────────────────

const FEATURE_TABS = [
  {
    key: "investor",
    label: "Investor",
    items: [
      { title: "Marketplace browse",       href: "/marketplace", desc: "Read-only property catalog with on-chain valuations and live ERC-20 supply.", icon: "building" },
      { title: "One-tap claim-all",        href: "/investor",    desc: "Hero CTA on the investor dashboard claims pending rent across every holding.", icon: "bolt" },
      { title: "Per-property claim",       href: "/dividends",   desc: "Granular epoch history with individual claim buttons and status badges.",      icon: "coins" },
      { title: "Portfolio listings",       href: "/portfolio",   desc: "List and cancel sales on the secondary market without leaving the dApp.",      icon: "briefcase" },
      { title: "Watchlist",                href: "/watchlist",   desc: "Star any property card from the marketplace; the watchlist syncs across tabs via localStorage.", icon: "star" },
      { title: "Yield calculator",         href: "/property/0",  desc: "Live tokens / ownership / annualized yield / payback months from the price-per-token and your inputs.", icon: "trending" },
    ],
  },
  {
    key: "owner",
    label: "Owner",
    items: [
      { title: "Property mint",            href: "/owner",       desc: "Tokenize a new property in one form: name, location, valuation, price.",       icon: "plus" },
      { title: "Rent deposit",             href: "/owner",       desc: "Drop USDC into the rental contract; epochs are auto-snapshotted.",             icon: "send" },
      { title: "Owner KPIs",               href: "/owner",       desc: "Total deposited, epoch count, owner-held supply at a glance.",                 icon: "trending" },
      { title: "Recent epoch table",       href: "/owner",       desc: "Last five epochs per property with date, amount, and status.",                 icon: "history" },
    ],
  },
  {
    key: "agent",
    label: "Smart Agent",
    items: [
      { title: "Live gas pill",            href: "/marketplace", desc: "Lime/grey/red navbar pill with the current gwei reading; classified against a rolling 1h percentile.", icon: "trending" },
      { title: "Heuristic suggestions",    href: "/investor",    desc: "Worth-it checks per property + batch hints when several claims are open at once.", icon: "bolt" },
      { title: "AI Q&A box",               href: "/investor",    desc: "Free-text question routed through your chosen LLM provider, grounded in real holdings + gas state.", icon: "spark" },
      { title: "OpenAI provider",          href: "/investor",    desc: "Default model gpt-4o-mini; full Chat Completions support including system + user prompts.", icon: "spark" },
      { title: "Anthropic Claude",         href: "/investor",    desc: "Direct Messages API with the dangerous-direct-browser-access header so the SDK isn't required.", icon: "spark" },
      { title: "Google Gemini",            href: "/investor",    desc: "generateContent endpoint with systemInstruction, default model gemini-2.5-flash.", icon: "spark" },
      { title: "OpenRouter",               href: "/investor",    desc: "Route through any model OpenRouter supports; HTTP-Referer + X-Title set automatically.", icon: "spark" },
      { title: "Per-pref toggles",         href: "/marketplace", desc: "Optimizer and AI assistant are independent toggles in Settings; both off by default.", icon: "settings" },
    ],
  },
  {
    key: "shared",
    label: "Shared UX",
    items: [
      { title: "FractionalOwnershipBar",   href: "/portfolio",   desc: "Lime-on-black progress bar shared across Marketplace, Portfolio, Claim Rent, and Owner Control Room. 2dp rounding.", icon: "trending" },
      { title: "OnChainBadge",             href: "/activity",    desc: "Tx hash → explorer URL derived from chain id. Disabled state when no explorer is mapped (Hardhat).", icon: "external" },
      { title: "GasMethodBadge",           href: "/dividends",   desc: "Lime UGF / dark ETH pill rendered next to every state-changing CTA.", icon: "bolt" },
      { title: "ContractMethodBadge",      href: "/owner",       desc: "Surfaces the exact Contract.method(args) a button will fire — links to the contract on the explorer.", icon: "info" },
      { title: "HolderConcentrationStrip", href: "/analytics",   desc: "Stacked top-5 holder share bar; opacity-graded segments, fail-soft when indexer is empty.", icon: "users" },
      { title: "EpochCadenceIndicator",    href: "/dividends",   desc: "Median over the last 12 RentalDeposited events; renders 'Cadence unavailable' under that threshold.", icon: "history" },
      { title: "UGF gasless mode",         href: "/dividends",   desc: "Every state-changing call routes through UGF — settle gas in Mock USD.",       icon: "drop" },
      { title: "UGF on/off toggle",        href: "/dividends",   desc: "Settings popover lets judges flip the switch and see the failure mode live.",  icon: "settings" },
      { title: "Cost banner",              href: "/marketplace", desc: "Side-by-side ETH vs UGF cost comparison renders before each call.",            icon: "info" },
      { title: "Faucet helper",            href: "/marketplace", desc: "Three-tile panel mints test USDC and links the UGF Mock-USD faucet.",          icon: "faucet" },
      { title: "Live activity feed",       href: "/marketplace", desc: "Right-rail pane polls /api/transactions every 8s; all backend-driven.",        icon: "history" },
      { title: "Toast system",             href: "/marketplace", desc: "Polite, accessible non-blocking notifications via aria-live.",                  icon: "info" },
      { title: "Connect gate",             href: "/portfolio",   desc: "Full-page prompt for routes that need a wallet, with one-click reconnect.",     icon: "wallet" },
      { title: "Network detection",        href: "/marketplace", desc: "Wrong-network banner switches MetaMask to the configured chain id in one tap.", icon: "alert" },
      { title: "Live rent counter",        href: "/",            desc: "Hero pill ticks the protocol-wide rent claimed total upward, polled from the stats endpoint.", icon: "coins" },
      { title: "Recent activity table",    href: "/",            desc: "The five most recent backend-logged transactions surface on the landing page when data exists.", icon: "history" },
    ],
  },
  {
    key: "agents",
    label: "Multi-agent",
    items: [
      { title: "Hub-and-spoke orchestrator", href: "/marketplace", desc: "Single Orchestrator + AgentBus route every cross-screen message; agents never call each other directly.", icon: "layers" },
      { title: "MarketplaceAgent",          href: "/marketplace", desc: "Owns property catalog, holder badges, buy flow. Falls back to on-chain reads when the indexer is offline.", icon: "building" },
      { title: "PortfolioAgent",            href: "/portfolio",   desc: "Owns per-wallet holdings, fractional ownership %, projected next-deposit cadence.", icon: "briefcase" },
      { title: "ClaimRentAgent",            href: "/dividends",   desc: "Owns epoch-by-epoch claim flow. The only agent that submits claim transactions.", icon: "coins" },
      { title: "OwnerControlRoomAgent",     href: "/owner",       desc: "Owns deposit forms, deposit history, top-5 holder concentration metric.", icon: "star" },
      { title: "ActivityAgent",             href: "/activity",    desc: "Owns the activity feed in two modes — full page and right-rail. Polls every 8s, capped at 200 rows.", icon: "history" },
      { title: "AnalysisAgent",             href: "/analytics",   desc: "Owns platform KPIs, time-series chart, holder concentration, lifetime-rent leaderboard.", icon: "trending" },
      { title: "Strict route isolation",    href: "/marketplace", desc: "Each agent appears in exactly one registry entry and is the only mutator of state for its routes.", icon: "lock" },
      { title: "Auto activate / deactivate", href: "/marketplace", desc: "Orchestrator syncs React Router pathname; activates / deactivates agents on every navigation.", icon: "bolt" },
      { title: "Service injection",         href: "/marketplace", desc: "Web3 + UGF + SmartAgent injected once at startup; agents read services through this.ctx.services.", icon: "settings" },
      { title: "Typed event bus",           href: "/marketplace", desc: "TX_SUBMITTED / TX_CONFIRMED / TX_FAILED / HOLDINGS_CHANGED envelopes drive cross-screen reactions.", icon: "info" },
      { title: "REQUEST_NAVIGATE",          href: "/portfolio",   desc: "Portfolio's Claim All routes the user to Claim Rent via the orchestrator's navigate handler — no direct nav imports.", icon: "arrowRight" },
    ],
  },
  {
    key: "platform",
    label: "Platform",
    items: [
      { title: "On-chain indexer",         href: "/analytics",   desc: "12s polling job ingests PropertyCreated, Transfer, RentalDeposited, AllDividendsClaimed, TokensBought, ListingCreated, ListingCancelled.", icon: "layers" },
      { title: "Holder leaderboard",       href: "/property/0",  desc: "/api/properties/:id/holders served from the indexer with on-chain log-replay fallback. Indexed/on-chain badge shows source.", icon: "users" },
      { title: "Rent history chart",       href: "/property/0",  desc: "Inline SVG line + area chart per property — no charting dep, lime fill, hoverable tooltips.", icon: "trending" },
      { title: "Wallet-signed writes",     href: "/portfolio",   desc: "SIWE-style /api/auth/nonce + signature header. Server-side ethers.verifyMessage; nonce is single-use.", icon: "lock" },
      { title: "Rate-limited API",         href: "/marketplace", desc: "express-rate-limit on every /api/* path: 600 reads/min/IP, 60 writes/min/IP, plus per-wallet faucet cooldown.", icon: "shield" },
      { title: "Structured logs",          href: "/analytics",   desc: "pino-http on every request with health-check noise filtered out; JSON in production, pretty in dev.", icon: "info" },
      { title: "Analytics dashboard",      href: "/analytics",   desc: "KPI tiles, daily volume bar chart, UGF vs ETH gas split — all backed by /api/transactions/timeseries.", icon: "trending" },
      { title: "Graceful Mongo gate",      href: "/marketplace", desc: "When Mongo is offline GETs return [] and POSTs return 503 with a hint; the frontend never breaks.", icon: "info" },
      { title: "PWA shell + service worker", href: "/",         desc: "manifest.webmanifest + sw.js cache the app shell and last /api/properties response for offline browsing.", icon: "globe" },
    ],
  },
];

function FeaturesGallerySection() {
  const [active, setActive] = useState("investor");
  const activeGroup = FEATURE_TABS.find((g) => g.key === active) || FEATURE_TABS[0];

  return (
    <section className="section" id="features">
      <Reveal>
        <div className="lp-section-head">
          <h2 className="lp-section-title">Features</h2>
          <p className="lp-section-sub">
            Every screen shipped, grouped by audience. Tap a tab to see what
            ships for investors, owners, and the shared dApp shell.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="lp-feature-tabs" role="tablist" aria-label="Feature audiences">
          {FEATURE_TABS.map((g) => (
            <button
              key={g.key}
              role="tab"
              aria-selected={active === g.key}
              className={`lp-feature-tab ${active === g.key ? "is-active" : ""}`}
              onClick={() => setActive(g.key)}
            >
              {g.label}
              <span className="lp-feature-tab-count">{g.items.length}</span>
            </button>
          ))}
        </div>
      </Reveal>

      <Stagger className="lp-feature-grid">
        {activeGroup.items.map((item, i) => (
          <motion.div key={`${activeGroup.key}-${item.title}`} variants={STAGGER_ITEM}>
            <Link to={item.href} className="lp-feature-card">
              <FloatIcon
                duration={3.4 + (i % 4) * 0.4}
                delay={(i * 0.22) % 1.4}
                amplitude={5 + (i % 3)}
                rotate={2 + (i % 2)}
                className="lp-feature-icon"
              >
                <span className="lp-feature-icon-inner"><Icon name={item.icon} size={22} /></span>
              </FloatIcon>
              <div className="lp-feature-card-body">
                <h4 className="lp-feature-card-title">{item.title}</h4>
                <p className="lp-feature-card-desc">{item.desc}</p>
              </div>
              <span className="lp-feature-card-arrow" aria-hidden="true">
                <Icon name="arrowRight" size={14} />
              </span>
            </Link>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Animated workflow
// ─────────────────────────────────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  {
    label: "Wallet",
    title: "Connect MetaMask",
    desc: "MetaMask + ethers BrowserProvider hand the connected address to Web3Context. Role detection runs against on-chain ownership.",
    icon: "wallet",
  },
  {
    label: "Chain",
    title: "Read on-chain state",
    desc: "Read-only ethers provider hits PropertyFactory and per-property contracts. No MetaMask popup needed for browsing.",
    icon: "globe",
  },
  {
    label: "Action",
    title: "Click claim or buy",
    desc: "UI calls UGFContext.ugfExecute, which encodes the call and passes it to the UGF SDK or signer.sendTransaction fallback.",
    icon: "bolt",
  },
  {
    label: "UGF",
    title: "Pay gas in Mock USD",
    desc: "UGF quotes the route, settles gas in TYI_MOCK_USD, and submits the sponsored transaction. Investor's ETH balance never moves.",
    icon: "drop",
  },
  {
    label: "Settlement",
    title: "USDC lands on-chain",
    desc: "RentalDistribution releases the pro-rata share; Marketplace transfers the tokens. Receipt is awaited on the read provider.",
    icon: "coins",
  },
  {
    label: "Backend",
    title: "Log + aggregate",
    desc: "Frontend POSTs the receipt to /api/transactions. The activity feed and global stats refresh on the next poll.",
    icon: "history",
  },
];

function AnimatedWorkflowSection() {
  const reduce = useReducedMotion();
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: false, amount: 0.35 });

  // Auto-progressing spotlight. -1 means "no override"; whichever node is
  // hovered takes priority over the auto cycle.
  const [autoIdx, setAutoIdx] = useState(0);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const activeIdx = hoverIdx >= 0 ? hoverIdx : autoIdx;

  useEffect(() => {
    if (reduce || !inView) return undefined;
    const id = setInterval(() => {
      setAutoIdx((i) => (i + 1) % WORKFLOW_STEPS.length);
    }, 2200);
    return () => clearInterval(id);
  }, [reduce, inView]);

  return (
    <section className="section" id="workflow" ref={sectionRef}>
      <Reveal>
        <div className="lp-section-head">
          <h2 className="lp-section-title">End-to-end flow</h2>
          <p className="lp-section-sub">
            From "open the app" to "USDC in your wallet" — six steps with no
            ETH ever leaving the user's wallet. Hover any step to pause the
            tour, or watch the highlight cycle through on its own.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="lp-workflow">
          {/* Static base track */}
          <motion.div
            className="lp-workflow-line"
            initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden="true"
          />

          {/* Lime "data packet" that rides the connector. Pure transform
              animation, GPU-friendly. Hidden on small screens via CSS. */}
          {!reduce && (
            <motion.span
              className="lp-workflow-packet"
              aria-hidden="true"
              initial={{ x: "0%", opacity: 0 }}
              animate={inView ? { x: "100%", opacity: [0, 1, 1, 1, 0] } : { x: "0%", opacity: 0 }}
              transition={{
                duration: 4.4,
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "loop",
              }}
            />
          )}

          <Stagger className="lp-workflow-row" stagger={0.12}>
            {WORKFLOW_STEPS.map((step, i) => (
              <WorkflowNode
                key={step.title}
                step={step}
                idx={i}
                total={WORKFLOW_STEPS.length}
                isActive={activeIdx === i}
                onHover={setHoverIdx}
                inView={inView}
                reduce={reduce}
              />
            ))}
          </Stagger>

          {/* Status caption — narrates the current spotlight for both
              sighted and screen-reader users. */}
          <AnimatePresence mode="wait">
            <motion.div
              key={WORKFLOW_STEPS[activeIdx].title}
              className="lp-workflow-caption"
              initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              role="status"
              aria-live="polite"
            >
              <span className="lp-workflow-caption-step">
                Step {activeIdx + 1} / {WORKFLOW_STEPS.length}
              </span>
              <span className="lp-workflow-caption-title">
                {WORKFLOW_STEPS[activeIdx].title}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </Reveal>
    </section>
  );
}

function WorkflowNode({ step, idx, total, isActive, onHover, inView, reduce }) {
  const tilt = isActive ? -4 : 0;

  return (
    <motion.div
      className={`lp-workflow-node ${isActive ? "is-active" : ""}`}
      variants={STAGGER_ITEM}
      onMouseEnter={() => onHover(idx)}
      onMouseLeave={() => onHover(-1)}
      onFocus={() => onHover(idx)}
      onBlur={() => onHover(-1)}
      tabIndex={0}
      role="group"
      aria-label={`Step ${idx + 1} of ${total}: ${step.title}`}
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.span
        className="lp-workflow-bubble"
        animate={
          reduce
            ? { scale: 1, rotate: 0, y: 0 }
            : isActive
              ? { scale: 1.12, rotate: tilt, y: -6, boxShadow: "0 6px 0 0 #191A23" }
              : { scale: 1,    rotate: 0,    y: 0,  boxShadow: "0 3px 0 0 #191A23" }
        }
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="lp-workflow-step">
          <CountUp from={0} to={idx + 1} active={inView} />
        </span>
        <motion.span
          className="lp-workflow-bubble-icon"
          animate={reduce ? { scale: 1 } : isActive ? { scale: 1.18 } : { scale: 1 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <Icon name={step.icon} size={20} />
        </motion.span>

        {/* Pulsing halo while active. Pure transform+opacity. */}
        {!reduce && isActive && (
          <motion.span
            className="lp-workflow-halo"
            aria-hidden="true"
            initial={{ scale: 0.6, opacity: 0.5 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut", repeat: Infinity }}
          />
        )}
      </motion.span>

      <div className="lp-workflow-tag">{step.label}</div>
      <h4 className="lp-workflow-title">{step.title}</h4>
      <p className="lp-workflow-desc">{step.desc}</p>
    </motion.div>
  );
}

// Small count-up that runs once when its parent scrolls into view. Used for
// the 01 / 02 / 03 step badges so they tick up rather than appear instantly.
function CountUp({ from = 0, to, active }) {
  const [value, setValue] = useState(active ? to : from);
  useEffect(() => {
    if (!active) {
      setValue(from);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 480;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, from, to]);
  return <>{String(value).padStart(2, "0")}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tech stack icons — all lime/black/grey, sized to ~36px so they read as a
// single visual family with the rest of the page.
// ─────────────────────────────────────────────────────────────────────────────

const ICON_SIZE = 38;

function tw() { return ICON_SIZE; }
function th() { return ICON_SIZE; }

function TechReact() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="3" fill="#191A23" />
      <g fill="none" stroke="#191A23" strokeWidth="1.6">
        <ellipse cx="20" cy="20" rx="17" ry="6.8" />
        <ellipse cx="20" cy="20" rx="17" ry="6.8" transform="rotate(60 20 20)" />
        <ellipse cx="20" cy="20" rx="17" ry="6.8" transform="rotate(120 20 20)" />
      </g>
    </svg>
  );
}
function TechVite() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M3 8 L20 36 L37 8 Z" fill="#B9FF66" stroke="#191A23" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 14 Q20 22 16 30 Q24 24 28 14 Q22 18 14 14 Z" fill="#191A23" />
    </svg>
  );
}
function TechRouter() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="10" cy="10" r="4" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
      <circle cx="30" cy="10" r="4" fill="#191A23" />
      <circle cx="20" cy="30" r="4" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
      <path d="M10 14 L20 26 M30 14 L20 26" stroke="#191A23" strokeWidth="2" />
    </svg>
  );
}
function TechFramer() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M8 4 H32 V16 H20 L32 28 H20 V40 L8 28 V16 L20 16 L8 4 Z" fill="#B9FF66" stroke="#191A23" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function TechType() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="3" y="6" width="34" height="28" rx="4" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
      <text x="20" y="27" textAnchor="middle" fontFamily="Space Grotesk" fontWeight="700" fontSize="20" fill="#191A23">Aa</text>
    </svg>
  );
}
function TechSolidity() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <polygon points="20,3 32,12 20,21 8,12" fill="#191A23" />
      <polygon points="20,21 32,30 20,37 8,30" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
      <polygon points="14,16 26,16 20,21" fill="#B9FF66" />
      <polygon points="14,26 26,26 20,21" fill="#191A23" />
    </svg>
  );
}
function TechOZ() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 3 L34 9 V21 Q34 31 20 37 Q6 31 6 21 V9 Z" fill="#B9FF66" stroke="#191A23" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="20" cy="19" r="5" fill="none" stroke="#191A23" strokeWidth="2.2" />
      <rect x="16" y="19" width="8" height="9" fill="#191A23" rx="1.5" />
    </svg>
  );
}
function TechHardhat() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M3 28 Q20 12 37 28 Z" fill="#191A23" />
      <rect x="6" y="27" width="28" height="6" fill="#B9FF66" stroke="#191A23" strokeWidth="2" rx="2" />
      <circle cx="14" cy="22" r="1.5" fill="#B9FF66" />
      <circle cx="26" cy="22" r="1.5" fill="#B9FF66" />
    </svg>
  );
}
function TechEthers() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <polygon points="20,3 33,20 20,28 7,20" fill="#191A23" />
      <polygon points="20,30 33,22 20,37 7,22" fill="#191A23" opacity="0.7" />
    </svg>
  );
}
function TechNode() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <polygon points="20,3 35,11 35,29 20,37 5,29 5,11" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
      <text x="20" y="25" textAnchor="middle" fontFamily="Space Grotesk" fontWeight="700" fontSize="11" fill="#191A23">node</text>
    </svg>
  );
}
function TechMongo() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 3 Q26 14 26 22 Q26 30 20 37 Q14 30 14 22 Q14 14 20 3 Z" fill="#B9FF66" stroke="#191A23" strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 5 V37" stroke="#191A23" strokeWidth="1.8" />
    </svg>
  );
}
function TechExpress() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="3" y="3" width="34" height="34" rx="6" fill="#191A23" />
      <text x="20" y="26" textAnchor="middle" fontFamily="Space Grotesk" fontWeight="700" fontSize="14" fill="#B9FF66">{"</>"}</text>
    </svg>
  );
}
function TechUgf() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 4 L8 22 L20 22 L14 36 L32 18 L20 18 Z" fill="#B9FF66" stroke="#191A23" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function TechBase() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="16" fill="#191A23" />
      <path d="M20 8 A12 12 0 1 1 8.5 16 H22 V24 H8.5 A12 12 0 0 1 20 32 Z" fill="#B9FF66" />
    </svg>
  );
}
function TechMetaMask() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M5 8 L18 13 L20 18 L22 13 L35 8 L33 22 L36 30 L28 33 L23 30 L20 30 L17 30 L12 33 L4 30 L7 22 Z" fill="#B9FF66" stroke="#191A23" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="14" cy="20" r="2" fill="#191A23" />
      <circle cx="26" cy="20" r="2" fill="#191A23" />
    </svg>
  );
}
function TechUsdc() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="16" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
      <text x="20" y="25" textAnchor="middle" fontFamily="Space Grotesk" fontWeight="700" fontSize="13" fill="#191A23">USDC</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Spotlight — single big-feature deep-dive block
// ─────────────────────────────────────────────────────────────────────────────

const SPOTLIGHT_BULLETS = [
  "No ETH purchase required to start — the wallet stays at zero.",
  "Gas settles in TYI_MOCK_USD via the Universal Gas Framework.",
  "Claim, buy, deposit, and trade — every flow is gasless.",
  "Works on a brand-new MetaMask install with no on-ramp.",
];

function SpotlightSection() {
  return (
    <section className="section" id="spotlight">
      <Reveal>
        <div className="lp-spotlight">
          <div className="lp-spotlight-text">
            <h2 className="lp-spotlight-title">Zero-ETH claim, in plain English</h2>
            <p className="lp-spotlight-para">
              Claim your rent without ever buying or holding native ETH. The
              dApp routes every state-changing call through UGF, which prices
              the transaction in Mock USD and submits it on your behalf. Your
              ETH balance is irrelevant.
            </p>
            <ul className="lp-spotlight-list">
              {SPOTLIGHT_BULLETS.map((b, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="lp-spotlight-bullet" aria-hidden="true" />
                  {b}
                </motion.li>
              ))}
            </ul>
          </div>
          <div className="lp-spotlight-illu" aria-hidden="true">
            <SpotlightIllu />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function SpotlightIllu() {
  return (
    <svg viewBox="0 0 320 280" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="20" y="40" width="280" height="200" fill="#191A23" rx="20" />
      <rect x="40" y="60" width="240" height="40" fill="#B9FF66" rx="8" />
      <text x="60" y="86" fontFamily="Space Grotesk" fontWeight="700" fontSize="18" fill="#191A23">Claim 300 USDC</text>
      <rect x="40" y="120" width="160" height="14" fill="#B9FF66" opacity="0.4" rx="4" />
      <rect x="40" y="142" width="200" height="14" fill="#B9FF66" opacity="0.3" rx="4" />
      <rect x="40" y="180" width="240" height="40" fill="#B9FF66" stroke="#191A23" strokeWidth="2" rx="10" />
      <text x="160" y="206" textAnchor="middle" fontFamily="Space Grotesk" fontWeight="700" fontSize="16" fill="#191A23">
        Gas in Mock USD
      </text>
      <circle cx="280" cy="60" r="14" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
      <text x="280" y="65" textAnchor="middle" fontFamily="Space Grotesk" fontWeight="700" fontSize="14" fill="#191A23">$</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Comparison — RealChain vs the alternatives
// ─────────────────────────────────────────────────────────────────────────────

const COMPARE_COLS = [
  { key: "rc",     label: "RealChain",   tone: "green" },
  { key: "reit",   label: "REITs",       tone: "grey" },
  { key: "direct", label: "Direct buy",  tone: "grey" },
  { key: "crowd",  label: "Crowdfund",   tone: "grey" },
];

const COMPARE_ROWS = [
  { feature: "Fractional ownership",            rc: "yes", reit: "yes",  direct: "no",   crowd: "yes" },
  { feature: "Instant secondary trading",       rc: "yes", reit: "soft", direct: "no",   crowd: "no"  },
  { feature: "On-chain transparency",           rc: "yes", reit: "no",   direct: "no",   crowd: "no"  },
  { feature: "USDC dividends",                  rc: "yes", reit: "no",   direct: "no",   crowd: "no"  },
  { feature: "Gas paid in Mock USD (zero-ETH)", rc: "yes", reit: "n/a",  direct: "n/a",  crowd: "n/a" },
  { feature: "No broker required",              rc: "yes", reit: "no",   direct: "no",   crowd: "yes" },
  { feature: "Low minimum cheque",              rc: "yes", reit: "yes",  direct: "no",   crowd: "yes" },
  { feature: "Auditable claim history",         rc: "yes", reit: "soft", direct: "no",   crowd: "soft" },
];

function CompareCell({ value }) {
  if (value === "yes")  return <span className="cmp-cell is-yes" aria-label="Yes"><Icon name="check" size={14} /></span>;
  if (value === "no")   return <span className="cmp-cell is-no" aria-label="No"><Icon name="close" size={14} /></span>;
  if (value === "soft") return <span className="cmp-cell is-soft" aria-label="Partial"><Icon name="check" size={12} /></span>;
  return <span className="cmp-cell is-na" aria-label="Not applicable">—</span>;
}

function ComparisonSection() {
  return (
    <section className="section" id="compare">
      <Reveal>
        <div className="lp-section-head">
          <h2 className="lp-section-title">vs the alternatives</h2>
          <p className="lp-section-sub">
            Where RealChain sits next to traditional REITs, direct property
            ownership, and equity-crowdfunding platforms.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="lp-compare">
          <div className="lp-compare-head">
            <div className="lp-compare-feature">Feature</div>
            {COMPARE_COLS.map((c) => (
              <div key={c.key} className={`lp-compare-col-head is-${c.tone}`}>
                {c.key === "rc" && <span className="lp-compare-pin"><span className="status-dot" /></span>}
                {c.label}
              </div>
            ))}
          </div>
          <Stagger>
            {COMPARE_ROWS.map((row, i) => (
              <motion.div
                key={row.feature}
                className={`lp-compare-row ${i % 2 ? "is-zebra" : ""}`}
                variants={STAGGER_ITEM}
              >
                <div className="lp-compare-feature">{row.feature}</div>
                <div className="lp-compare-col is-rc"><CompareCell value={row.rc} /></div>
                <div className="lp-compare-col"><CompareCell value={row.reit} /></div>
                <div className="lp-compare-col"><CompareCell value={row.direct} /></div>
                <div className="lp-compare-col"><CompareCell value={row.crowd} /></div>
              </motion.div>
            ))}
          </Stagger>
        </div>
      </Reveal>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Owner tokenization flow — minimal numbered horizontal step strip
// ─────────────────────────────────────────────────────────────────────────────

const OWNER_STEPS = [
  { title: "Mint property",     desc: "Owner fills the create form: name, location, INR valuation, USDC price per token." },
  { title: "Approve marketplace", desc: "Marketplace gets allowance to sell from the owner's full token supply." },
  { title: "Investors buy",     desc: "Buyers arrive on the property page and purchase from primary or secondary listings." },
  { title: "Deposit rent",      desc: "Owner deposits rental income in USDC; an epoch is opened for claims." },
];

function OwnerFlowSection() {
  return (
    <section className="section" id="owner-flow">
      <Reveal>
        <div className="lp-section-head">
          <h2 className="lp-section-title">For owners</h2>
          <p className="lp-section-sub">
            How a property owner ships a listing in four steps. Companion view
            to the investor flow above.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="lp-owner-flow">
          {OWNER_STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              className="lp-owner-step"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="lp-owner-bubble">{String(i + 1).padStart(2, "0")}</div>
              <h4 className="lp-owner-title">{s.title}</h4>
              <p className="lp-owner-desc">{s.desc}</p>
              {i < OWNER_STEPS.length - 1 && <div className="lp-owner-line" aria-hidden="true" />}
            </motion.div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function TechShield() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 3 L34 9 V21 Q34 31 20 37 Q6 31 6 21 V9 Z" fill="#191A23" stroke="#191A23" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 19 L18 24 L26 14" stroke="#B9FF66" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TechIndexer() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="6" y="8" width="28" height="6" rx="2" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
      <rect x="6" y="17" width="28" height="6" rx="2" fill="#191A23" />
      <rect x="6" y="26" width="28" height="6" rx="2" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
      <circle cx="11" cy="11" r="1.5" fill="#191A23" />
      <circle cx="11" cy="20" r="1.5" fill="#B9FF66" />
      <circle cx="11" cy="29" r="1.5" fill="#191A23" />
    </svg>
  );
}
function TechAuth() {
  return (
    <svg width={tw()} height={th()} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="6" y="18" width="28" height="18" rx="3" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
      <path d="M12 18 V12 a8 8 0 0 1 16 0 V18" fill="none" stroke="#191A23" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="26" r="2.5" fill="#191A23" />
      <rect x="19" y="26" width="2" height="6" fill="#191A23" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart Agent showcase — the dedicated section for the gas optimizer + AI
// assistant. Two big cards side-by-side so the heuristic-vs-LLM split is
// legible at a glance, plus a row of provider chips with their own float
// loops (different durations, no sync).
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_FEATURES = {
  optimizer: [
    { icon: "trending", title: "Live gas reading",       body: "Polls the read provider every 20s and classifies the current fee against a rolling 1h percentile." },
    { icon: "bolt",     title: "Worth-it checks",        body: "Per-property heuristics flag dust pending vs claim cost using the same gas figure as the cost banner." },
    { icon: "layers",   title: "Batch suggestions",      body: "When two or more properties are claimable, the agent recommends Claim All on the dashboard hero." },
    { icon: "info",     title: "Status pill in navbar",  body: "Lime/grey/red gas pill mirrors the agent's classification — visible on every page." },
  ],
  assistant: [
    { icon: "spark",    title: "Bring your own key",     body: "OpenAI, Anthropic Claude, Google Gemini, OpenRouter — pick any one, paste the key, model is auto-defaulted." },
    { icon: "lock",     title: "Direct browser → LLM",   body: "Keys live in localStorage and travel only to the chosen provider. RealChain's backend never sees them." },
    { icon: "globe",    title: "Context aware",          body: "Each prompt includes wallet, gas state, computed heuristics and per-property pending — answers stay grounded." },
    { icon: "alert",    title: "Risk made visible",      body: "Settings popover surfaces an explicit warning that browser-side keys are not safe on shared machines." },
  ],
};

const AGENT_PROVIDER_CHIPS = [
  { label: "OpenAI",     icon: <ProvOpenAI /> },
  { label: "Anthropic",  icon: <ProvAnthropic /> },
  { label: "Gemini",     icon: <ProvGemini /> },
  { label: "OpenRouter", icon: <ProvOpenRouter /> },
];

function SmartAgentSection() {
  return (
    <section className="section" id="smart-agent">
      <Reveal>
        <div className="lp-section-head">
          <h2 className="lp-section-title">Smart Agent</h2>
          <p className="lp-section-sub">
            Two opt-in helpers in Settings. The gas optimizer runs on real
            on-chain data and is free. The AI assistant takes your own
            provider key and answers grounded in the same data.
          </p>
        </div>
      </Reveal>

      <Stagger className="lp-agent-grid">
        <motion.div className="lp-agent-card is-grey" variants={STAGGER_ITEM}>
          <div className="lp-agent-card-head">
            <span className="lp-agent-tag">
              <FloatIcon duration={3.4} amplitude={4} rotate={2}>
                <Icon name="trending" size={14} />
              </FloatIcon>
              Free · rule-based
            </span>
            <h3 className="lp-agent-card-title">Gas optimizer</h3>
          </div>
          <p className="lp-agent-card-lead">
            Heuristic engine that watches gas, weighs it against your pending
            rent, and surfaces concrete suggestions on the investor dashboard.
            No external service, no per-call cost.
          </p>
          <ul className="lp-agent-list">
            {AGENT_FEATURES.optimizer.map((f, i) => (
              <li key={f.title}>
                <FloatIcon
                  duration={3.4 + (i % 3) * 0.4}
                  delay={(i * 0.18) % 1.4}
                  amplitude={5 + (i % 2)}
                  rotate={2}
                  className="lp-agent-list-icon"
                >
                  <Icon name={f.icon} size={16} />
                </FloatIcon>
                <div>
                  <div className="lp-agent-list-title">{f.title}</div>
                  <div className="lp-agent-list-desc">{f.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div className="lp-agent-card is-dark" variants={STAGGER_ITEM}>
          <div className="lp-agent-card-head">
            <span className="lp-agent-tag is-on-dark">
              <FloatIcon duration={3.8} amplitude={5} rotate={3}>
                <Icon name="spark" size={14} />
              </FloatIcon>
              Optional · BYO key
            </span>
            <h3 className="lp-agent-card-title">AI assistant</h3>
          </div>
          <p className="lp-agent-card-lead">
            Free-text Q&amp;A on your dashboard, routed through whichever LLM
            provider you supply. The prompt is built from your real holdings
            and the live gas state so the answer is never generic.
          </p>
          <ul className="lp-agent-list is-on-dark">
            {AGENT_FEATURES.assistant.map((f, i) => (
              <li key={f.title}>
                <FloatIcon
                  duration={3.6 + (i % 4) * 0.35}
                  delay={(i * 0.22) % 1.5}
                  amplitude={5 + (i % 2)}
                  rotate={3}
                  className="lp-agent-list-icon"
                >
                  <Icon name={f.icon} size={16} />
                </FloatIcon>
                <div>
                  <div className="lp-agent-list-title">{f.title}</div>
                  <div className="lp-agent-list-desc">{f.body}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="lp-agent-providers" aria-label="Supported providers">
            {AGENT_PROVIDER_CHIPS.map((p, i) => (
              <FloatIcon
                key={p.label}
                duration={3.2 + (i % 4) * 0.4}
                delay={(i * 0.25) % 1.6}
                amplitude={6 + (i % 3)}
                rotate={2 + (i % 2)}
                className="lp-agent-provider"
              >
                {p.icon}
                <span>{p.label}</span>
              </FloatIcon>
            ))}
          </div>
        </motion.div>
      </Stagger>
    </section>
  );
}

// Provider logo glyphs — flat lime/black/grey to match the rest of the page.
function ProvOpenAI() {
  return (
    <svg width="20" height="20" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#191A23" />
      <path d="M14 14 L20 11 L26 14 V22 L20 25 L14 22 Z" fill="none" stroke="#B9FF66" strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 11 V18" stroke="#B9FF66" strokeWidth="2" />
      <path d="M14 14 L20 18 L26 14" stroke="#B9FF66" strokeWidth="2" fill="none" />
    </svg>
  );
}
function ProvAnthropic() {
  return (
    <svg width="20" height="20" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="2" y="2" width="36" height="36" rx="8" fill="#B9FF66" stroke="#191A23" strokeWidth="2" />
      <path d="M14 30 L20 12 L26 30" stroke="#191A23" strokeWidth="3" fill="none" strokeLinejoin="round" />
      <path d="M16 24 H24" stroke="#191A23" strokeWidth="3" />
    </svg>
  );
}
function ProvGemini() {
  return (
    <svg width="20" height="20" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#191A23" />
      <path d="M20 8 L23 17 L32 20 L23 23 L20 32 L17 23 L8 20 L17 17 Z" fill="#B9FF66" />
    </svg>
  );
}
function ProvOpenRouter() {
  return (
    <svg width="20" height="20" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="2" y="2" width="36" height="36" rx="8" fill="#191A23" />
      <circle cx="13" cy="20" r="3" fill="#B9FF66" />
      <circle cx="27" cy="13" r="3" fill="#B9FF66" />
      <circle cx="27" cy="27" r="3" fill="#B9FF66" />
      <path d="M16 20 L24 13 M16 20 L24 27" stroke="#B9FF66" strokeWidth="2" />
    </svg>
  );
}
