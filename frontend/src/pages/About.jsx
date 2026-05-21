import React from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";

// ─────────────────────────────────────────────────────────────────────────────
// About — project overview page.
// Covers: what RealChain is, the problem it solves, how it works, the tech
// stack, and the team. All content is static — no backend calls needed.
// ─────────────────────────────────────────────────────────────────────────────

const TECH = [
  { label: "React 18 + Vite",       desc: "Fast SPA with HMR and optimised production builds." },
  { label: "ethers v6",             desc: "Wallet connection, contract reads/writes, and ABI encoding." },
  { label: "Solidity 0.8",          desc: "ERC-20Votes property tokens, RentalDistribution, Marketplace." },
  { label: "Hardhat",               desc: "Local chain, deploy scripts, and automated tests." },
  { label: "Universal Gas Framework", desc: "Gasless transactions — investors pay gas in TYI_MOCK_USD, not ETH." },
  { label: "Express + MongoDB",     desc: "Off-chain indexer, transaction history, user profiles, analytics." },
  { label: "Base Sepolia",          desc: "EVM-compatible L2 testnet — fast, cheap, and ERC-20 compatible." },
  { label: "Framer Motion",         desc: "Scroll-triggered reveals and staggered entrance animations." },
];

const FEATURES = [
  { icon: "building", title: "Fractional ownership",    desc: "Any property can be tokenised into a fixed supply of PROP tokens. Buy as little as 1 token." },
  { icon: "coins",    title: "USDC rent distributions", desc: "Owners deposit rent into the RentalDistribution contract. Every token holder claims a pro-rata share." },
  { icon: "bolt",     title: "Zero-ETH gasless claims", desc: "The Universal Gas Framework wraps every transaction. Gas is settled in Mock USD — no ETH required." },
  { icon: "trending", title: "Secondary marketplace",   desc: "Token holders can list and trade their fractional stakes peer-to-peer at any time." },
  { icon: "users",    title: "Role-based dashboards",   desc: "Owners get a control room for deposits and property management. Investors get a portfolio and claim view." },
  { icon: "history",  title: "On-chain indexer",        desc: "A background job ingests every chain event into MongoDB so analytics and holder lists are O(1)." },
  { icon: "spark",    title: "Smart Agent",             desc: "Heuristic gas optimizer + optional local LLM assistant grounded in your real holdings and live gas state." },
  { icon: "lock",     title: "SIWE authentication",     desc: "Email/password session for the app shell, wallet signature for on-chain writes. Both are optional independently." },
];

const TEAM = [
  "Ayush",
  "Team Spirit",
];

export default function About() {
  return (
    <div className="container reveal" style={{ maxWidth: 900, paddingTop: "var(--space-12)" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "var(--space-12)", textAlign: "center" }}>
        <span className="badge badge-accent" style={{ marginBottom: 16, display: "inline-block" }}>
          <Icon name="building" size={12} /> RealChain
        </span>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 16 }}>
          Tokenized real estate,<br />
          <span style={{ background: "var(--accent-lime, #B9FF66)", padding: "0 12px", borderRadius: 10, display: "inline-block" }}>
            zero-ETH claim
          </span>
        </h1>
        <p style={{ fontSize: 18, color: "var(--text-secondary, #4A5A42)", maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>
          RealChain is a Web3 platform that lets anyone buy fractional ownership
          of real properties, earn USDC rent every epoch, and trade their stake
          — all without ever needing native ETH for gas.
        </p>
      </div>

      {/* ── The problem ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>
          <Icon name="info" size={18} style={{ verticalAlign: -3, marginRight: 8 }} />
          The problem
        </h2>
        <div className="card card-elevated">
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <h3 style={{ fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>Traditional real estate</h3>
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {["High entry barrier — full property price required", "Illiquid — can't sell a fraction", "Rent collection is manual and slow", "No transparency on ownership distribution"].map(t => (
                  <li key={t} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--red-500, #DC2626)", flexShrink: 0 }}>✗</span> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 style={{ fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>RealChain</h3>
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {["Buy from $0.01 — any fraction of any property", "Trade tokens on the secondary market instantly", "Automated USDC rent distribution every epoch", "Full on-chain transparency — every holder visible"].map(t => (
                  <li key={t} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--accent-lime, #B9FF66)", flexShrink: 0 }}>✓</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 20 }}>
          <Icon name="bolt" size={18} style={{ verticalAlign: -3, marginRight: 8 }} />
          What it does
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="card" style={{ padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: "var(--accent-lime, #B9FF66)", color: "#191A23",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid #191A23",
              }}>
                <Icon name={f.icon} size={18} />
              </span>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 20 }}>
          <Icon name="layers" size={18} style={{ verticalAlign: -3, marginRight: 8 }} />
          How it works
        </h2>
        <div className="card card-elevated">
          <div className="card-body">
            {[
              { num: "01", title: "Connect wallet + pick a role", body: "MetaMask detects whether you're a property owner or an investor based on on-chain holdings." },
              { num: "02", title: "Browse the marketplace",       body: "Each property has a fixed supply of PROP tokens. Buy at the listing price or from a peer listing." },
              { num: "03", title: "Earn USDC rent",               body: "When the owner deposits rent, the contract snapshots balances and lets every holder claim their share." },
              { num: "04", title: "Pay gas in Mock USD",          body: "Every transaction routes through the Universal Gas Framework. No ETH needed — gas is paid in TYI_MOCK_USD." },
            ].map((step) => (
              <div key={step.num} style={{ display: "flex", gap: 20, padding: "16px 0", borderBottom: "1px solid var(--border, #E0EDD8)" }}>
                <span style={{
                  fontSize: 28, fontWeight: 800, color: "var(--accent-lime, #B9FF66)",
                  fontFeatureSettings: "'tnum' on", flexShrink: 0, lineHeight: 1,
                }}>{step.num}</span>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>{step.title}</div>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>{step.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech stack ───────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 20 }}>
          <Icon name="code" size={18} style={{ verticalAlign: -3, marginRight: 8 }} />
          Tech stack
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {TECH.map((t) => (
            <div key={t.label} className="stat-card" style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "var(--text-primary)" }}>{t.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Team ─────────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 20 }}>
          <Icon name="users" size={18} style={{ verticalAlign: -3, marginRight: 8 }} />
          Built by
        </h2>
        <div className="card card-elevated">
          <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{
              background: "var(--accent-lime, #B9FF66)", color: "#191A23",
              fontWeight: 800, fontSize: 22, padding: "12px 28px",
              borderRadius: 12, border: "1px solid #191A23",
              letterSpacing: "0.04em",
            }}>
              TEAM SPIRIT
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.6 }}>
              A team of builders passionate about making real estate investment
              accessible to everyone through blockchain technology.
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", paddingBottom: "var(--space-16)" }}>
        <Link to="/marketplace" className="btn btn-primary btn-lg" style={{ marginRight: 12 }}>
          <Icon name="building" size={14} /> Browse marketplace
        </Link>
        <Link to="/demo" className="btn btn-secondary btn-lg">
          Try the demo <Icon name="arrowRight" size={14} />
        </Link>
      </div>

    </div>
  );
}
