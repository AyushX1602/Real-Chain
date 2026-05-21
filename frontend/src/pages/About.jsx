import React from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";

// ─────────────────────────────────────────────────────────────────────────────
// About — the real story behind RealChain.
// Content sourced from PROJECT_EXPLAINED.txt and README.md.
// ─────────────────────────────────────────────────────────────────────────────

export default function About() {
  return (
    <div className="container reveal" style={{ maxWidth: 920, paddingTop: "var(--space-12)", paddingBottom: "var(--space-20)" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "var(--space-14)", textAlign: "center" }}>
        <span className="badge badge-accent" style={{ marginBottom: 16, display: "inline-block", fontSize: 13 }}>
          <Icon name="building" size={12} /> About RealChain
        </span>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 50px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 20 }}>
          Fractional real estate,<br />
          <span style={{
            background: "var(--accent-lime, #B9FF66)", padding: "2px 14px",
            borderRadius: 10, border: "1px solid #191A23", display: "inline-block",
            transform: "rotate(-1deg)", boxShadow: "0 3px 0 0 #191A23",
          }}>
            zero-ETH
          </span>{" "}claims
        </h1>
        <p style={{ fontSize: 18, color: "var(--text-secondary)", maxWidth: 640, margin: "0 auto", lineHeight: 1.7 }}>
          RealChain is a blockchain-based fractional real estate investment platform
          built as a research and hackathon project. It solves two problems at once:
          the illiquidity of real estate ownership, and the ETH gas barrier that
          shuts out stablecoin-only users from Web3.
        </p>
      </div>

      {/* ── The core idea ────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          <Icon name="info" size={16} style={{ verticalAlign: -2, marginRight: 8 }} />
          The core idea
        </h2>

        {/* What problem does it solve */}
        <div className="card card-elevated" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: "var(--text-primary)" }}>
              Why does this exist?
            </h3>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.8, fontSize: 15, marginBottom: 10 }}>
              Real estate is the world's largest asset class — but it's locked behind
              two walls. First, you need to buy an <em>entire</em> property to participate.
              Second, even if you could buy a fraction, every blockchain transaction
              requires ETH for gas, shutting out anyone who only holds stablecoins.
            </p>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.8, fontSize: 15 }}>
              RealChain removes both walls. Fractional ownership means you can invest
              from as little as one token. The Universal Gas Framework means you never
              need ETH — gas is paid in Mock USD. The result: anyone with a stablecoin
              balance can own a slice of real property and earn rent.
            </p>
          </div>
        </div>

        {/* How it works step by step */}
        <div className="card card-elevated" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: "var(--text-primary)" }}>
              How the full lifecycle works
            </h3>
            {[
              {
                step: "01", icon: "building",
                title: "Owner tokenises a property",
                body: "A property owner calls the PropertyFactory contract with the property name, location, valuation, and price per token. The factory atomically deploys three contracts: a PropertyToken (100 ERC-20Votes tokens), a RentalDistribution contract, and a Marketplace. All 100 tokens are minted to the owner.",
              },
              {
                step: "02", icon: "coins",
                title: "Investors buy fractional ownership",
                body: "Investors browse the marketplace and buy tokens using USDC — a stablecoin always worth $1. They can buy from the owner at the listing price (primary market) or from other investors at any price (secondary market). Owning 30 tokens means owning 30% of that property's future rent.",
              },
              {
                step: "03", icon: "send",
                title: "Owner deposits monthly rent",
                body: "Each month the owner deposits USDC rent into the RentalDistribution contract. The contract records a snapshot of every holder's balance at that exact moment — one second before the deposit block. This snapshot is the key to fair distribution: only holders at deposit time can claim.",
              },
              {
                step: "04", icon: "history",
                title: "Investors claim their share",
                body: "Any token holder calls claimAll() to receive their pro-rata USDC share. The contract uses ERC20Votes.getPastVotes(user, snapshotTime) to look up what the investor held at deposit time — not now. This prevents anyone from buying tokens after a deposit and stealing rent they didn't earn.",
              },
              {
                step: "05", icon: "bolt",
                title: "Gas is paid in Mock USD — no ETH needed",
                body: "Every transaction (buy, deposit, claim, list, cancel) routes through the Universal Gas Framework. The investor's wallet pays gas in TYI_MOCK_USD instead of native ETH. This means a fresh wallet with only USDC can participate fully — the single biggest onboarding barrier in Web3 is removed.",
              },
              {
                step: "06", icon: "trending",
                title: "Trade anytime on the secondary market",
                body: "Token holders can list their stake for sale at any price. Other investors can buy those listings. The marketplace handles the USDC ↔ token swap atomically. When tokens transfer, the ERC20Votes checkpoint updates automatically so the new holder's rent entitlement is correct from the next deposit onward.",
              },
            ].map((s) => (
              <div key={s.step} style={{ display: "flex", gap: 18, padding: "16px 0", borderBottom: "1px solid var(--border, #E0EDD8)" }}>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: "var(--accent-lime, #B9FF66)", color: "#191A23",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "1px solid #191A23", fontWeight: 800, fontSize: 13,
                  }}>
                    {s.step}
                  </span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 15, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name={s.icon} size={14} /> {s.title}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The one-line summary */}
        <div style={{
          background: "var(--accent-lime, #B9FF66)", color: "#191A23",
          borderRadius: 14, border: "1px solid #191A23",
          padding: "18px 24px", boxShadow: "5px 5px 0 0 #191A23",
          fontWeight: 700, fontSize: 16, lineHeight: 1.6,
        }}>
          <Icon name="bolt" size={16} style={{ verticalAlign: -2, marginRight: 8 }} />
          In one sentence: RealChain lets anyone buy a fraction of a real property,
          earn USDC rent automatically, trade their stake instantly, and do all of
          it without ever needing ETH in their wallet.
        </div>
      </section>

      {/* ── The security problem we solved ───────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          <Icon name="lock" size={16} style={{ verticalAlign: -2, marginRight: 8 }} />
          The security problem we solved
        </h2>
        <div className="card card-elevated">
          <div className="card-body">
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 20, fontSize: 15 }}>
              Naive dividend contracts use <code>balanceOf(user)</code> at <em>claim time</em> to
              calculate share. This is exploitable — an attacker can buy tokens
              <em> after</em> rent is deposited and still claim a full share.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 700, color: "#DC2626", marginBottom: 10 }}>❌ The attack (broken contract)</div>
                {[
                  "Owner deposits 1,000 USDC rent at block T",
                  "Carol buys 30 tokens at block T+1 (after deposit)",
                  "Carol calls claimAll() → gets 300 USDC she never earned",
                  "Alice sold tokens before claiming → gets 0 USDC despite holding during the rental period",
                ].map((s, i) => (
                  <div key={i} style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, paddingLeft: 8, borderLeft: "2px solid rgba(239,68,68,0.4)" }}>
                    {s}
                  </div>
                ))}
              </div>
              <div style={{ background: "rgba(185,255,102,0.08)", border: "1px solid rgba(185,255,102,0.4)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 700, color: "var(--accent-lime, #B9FF66)", marginBottom: 10 }}>✓ The fix (RealChain)</div>
                {[
                  "Record block.timestamp − 1 as snapshotTime when rent is deposited",
                  "Use ERC20Votes.getPastVotes(user, snapshotTime) instead of balanceOf()",
                  "Carol held 0 tokens at snapshotTime → gets 0 USDC",
                  "Alice held 30 tokens at snapshotTime → gets 300 USDC correctly",
                ].map((s, i) => (
                  <div key={i} style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, paddingLeft: 8, borderLeft: "2px solid rgba(185,255,102,0.5)" }}>
                    {s}
                  </div>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              This is proven in <code>test/SnapshotAttack.test.js</code> — a formal test suite
              that deploys both the broken and fixed contracts against the same
              PropertyToken and verifies the attack is blocked. The results form
              Table I in the accompanying research paper.
            </p>
          </div>
        </div>
      </section>

      {/* ── Two distribution algorithms ──────────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          <Icon name="trending" size={16} style={{ verticalAlign: -2, marginRight: 8 }} />
          Two distribution algorithms (V1 vs V2)
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            {
              label: "V1 — Loop-based (default)",
              tag: "O(n) gas",
              tagColor: "#F4C46B",
              points: [
                "Simple epoch loop — iterates every unclaimed epoch on claim",
                "Gas grows linearly: 85,503 + (n−1) × 42,858 per epoch",
                "1 epoch → 85k gas · 12 epochs → 433k gas · 48 epochs → 1.57M gas",
                "Best for: properties with infrequent rent deposits",
              ],
            },
            {
              label: "V2 — Accumulator-based",
              tag: "O(1) gas",
              tagColor: "var(--accent-lime, #B9FF66)",
              points: [
                "Global accRewardPerToken tracks cumulative USDC per token",
                "Constant gas regardless of epoch count: always ~137k gas",
                "Transfer-time fairness: seller's rewards settled before any transfer",
                "Best for: properties with frequent deposits and active trading",
              ],
            },
          ].map((v) => (
            <div key={v.label} className="card card-elevated" style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{v.label}</div>
                <span style={{ background: v.tagColor, color: "#191A23", fontWeight: 700, fontSize: 11, padding: "3px 10px", borderRadius: 999, border: "1px solid #191A23" }}>
                  {v.tag}
                </span>
              </div>
              {v.points.map((p, i) => (
                <div key={i} style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 7, display: "flex", gap: 8 }}>
                  <span style={{ flexShrink: 0, opacity: 0.5 }}>·</span> {p}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── What we built ────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          <Icon name="layers" size={16} style={{ verticalAlign: -2, marginRight: 8 }} />
          What we built
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {[
            { icon: "building", title: "Smart contracts",         desc: "PropertyToken (ERC-20Votes), RentalDistribution V1 + V2, Marketplace, PropertyFactory — all on Base Sepolia." },
            { icon: "bolt",     title: "Zero-ETH gasless flow",   desc: "Every transaction routes through the Universal Gas Framework. Gas is paid in TYI_MOCK_USD — no ETH needed." },
            { icon: "coins",    title: "USDC rent distribution",  desc: "Automated epoch-based rent distribution. Snapshot-secured so only holders at deposit time can claim." },
            { icon: "trending", title: "Secondary marketplace",   desc: "Peer-to-peer token trading. List, buy, and cancel listings without leaving the dApp." },
            { icon: "users",    title: "Role-based dashboards",   desc: "Owner control room for deposits and property management. Investor dashboard for portfolio and claims." },
            { icon: "history",  title: "On-chain indexer",        desc: "Background job ingests every chain event into MongoDB. Analytics, holder lists, and activity feed are O(1)." },
            { icon: "spark",    title: "Smart Agent",             desc: "Heuristic gas optimizer + optional local LLM assistant grounded in your real holdings and live gas state." },
            { icon: "lock",     title: "Dual authentication",     desc: "Email/password session for the app shell. Wallet signature for on-chain writes. Both are independently optional." },
          ].map((f) => (
            <div key={f.title} className="card" style={{ padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: "var(--accent-lime, #B9FF66)", color: "#191A23",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid #191A23",
              }}>
                <Icon name={f.icon} size={16} />
              </span>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14, color: "var(--text-primary)" }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tech stack ───────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          <Icon name="code" size={16} style={{ verticalAlign: -2, marginRight: 8 }} />
          Tech stack
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {[
            { label: "Solidity 0.8.28",         desc: "Smart contract language. EVM target: cancun (required for OpenZeppelin v5.6)." },
            { label: "OpenZeppelin v5.6",        desc: "ERC-20Votes, ReentrancyGuard, and security primitives." },
            { label: "Hardhat",                  desc: "Local Ethereum node, compiler, test runner, and deploy scripts." },
            { label: "ethers.js v6",             desc: "JavaScript library for all blockchain reads and writes." },
            { label: "React 18 + Vite",          desc: "Frontend SPA with HMR and optimised production builds." },
            { label: "Universal Gas Framework",  desc: "Gasless transactions — gas settled in TYI_MOCK_USD, not ETH." },
            { label: "Express + MongoDB",        desc: "Off-chain indexer, transaction history, user profiles, analytics API." },
            { label: "Base Sepolia",             desc: "EVM-compatible L2 testnet — fast, cheap, and ERC-20 compatible." },
          ].map((t) => (
            <div key={t.label} className="stat-card" style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 5, color: "var(--text-primary)" }}>{t.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Team ─────────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          <Icon name="users" size={16} style={{ verticalAlign: -2, marginRight: 8 }} />
          Built by
        </h2>
        <div className="card card-elevated">
          <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <div style={{
              background: "var(--accent-lime, #B9FF66)", color: "#191A23",
              fontWeight: 800, fontSize: 24, padding: "14px 32px",
              borderRadius: 14, border: "1px solid #191A23",
              letterSpacing: "0.06em", boxShadow: "5px 5px 0 0 #191A23",
            }}>
              TEAM SPIRIT
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.7, flex: 1, minWidth: 240 }}>
              A team of builders passionate about making real estate investment
              accessible to everyone through blockchain technology. RealChain was
              built as a UGF Hackathon submission and academic research project,
              combining a working dApp with a formal security proof and gas
              benchmark study.
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center" }}>
        <Link to="/marketplace" className="btn btn-primary btn-lg" style={{ marginRight: 12 }}>
          <Icon name="building" size={14} /> Browse marketplace
        </Link>
        <Link to="/signup" className="btn btn-secondary btn-lg">
          Create account <Icon name="arrowRight" size={14} />
        </Link>
      </div>

    </div>
  );
}
