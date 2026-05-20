import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { useUGF } from "../context/UGFContext";
import Icon from "../components/Icon";
import Logo from "../components/Logo";

// ─────────────────────────────────────────────────────────────────────────────
// DemoWalkthrough — One-click Judge Demo Mode at /demo.
//
// A self-contained guided tour that explains the full RealChain lifecycle
// without requiring any login or prior knowledge. Each step has a highlighted
// card with an explanation and a direct action button.
//
// Steps:
//  1. Connect wallet (auto-detects if already connected)
//  2. Show zero ETH balance proof
//  3. Browse marketplace
//  4. Buy property tokens (gas paid in USDC)
//  5. Owner deposits rent
//  6. Claim rent — gas paid in USDC
//  7. List on secondary market
//  8. Summary / repeat
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: "connect",
    num: 1,
    title: "Connect wallet",
    desc: "Connect MetaMask. In this demo, the wallet starts with 0 ETH — proving that no native gas is needed.",
    icon: "wallet",
    action: "connect",
    actionLabel: "Connect MetaMask",
    successCheck: (ctx) => !!ctx.account,
  },
  {
    id: "zero-eth",
    num: 2,
    title: "0 ETH — no problem",
    desc: "Notice your wallet has 0 ETH. Traditional dApps would be stuck here. RealChain uses the Universal Gas Framework (UGF) to pay gas in Mock USD instead.",
    icon: "shield",
    action: null,
    highlight: "Your ETH balance is 0. Every transaction ahead is gasless.",
    successCheck: () => true,
  },
  {
    id: "marketplace",
    num: 3,
    title: "Browse the marketplace",
    desc: "See tokenized real estate properties. Each property is an ERC-20 token. Fractional ownership means you can buy as little as 1 token.",
    icon: "search",
    action: "link",
    linkTo: "/marketplace",
    actionLabel: "Open marketplace",
    successCheck: () => true,
  },
  {
    id: "buy",
    num: 4,
    title: "Buy property tokens",
    desc: "Click any property → Buy from owner. The transaction is submitted with UGF — gas is deducted in Mock USD from your USDC balance, never ETH.",
    icon: "bolt",
    action: "link",
    linkTo: "/marketplace",
    actionLabel: "Go buy tokens →",
    successCheck: () => true,
  },
  {
    id: "deposit",
    num: 5,
    title: "Owner deposits rent",
    desc: "The property owner deposits USDC rent into the RentalDistribution contract. This creates an epoch — every token holder gets a pro-rata share.",
    icon: "coins",
    action: "link",
    linkTo: "/owner",
    actionLabel: "View owner dashboard",
    successCheck: () => true,
  },
  {
    id: "claim",
    num: 6,
    title: "Claim your rent — 0 ETH gas",
    desc: "Go to your Investor Dashboard and click 'Claim all rent'. Gas is settled in Mock USD via UGF. USDC arrives in your wallet instantly.",
    icon: "dollar",
    action: "link",
    linkTo: "/investor",
    actionLabel: "Claim rent now →",
    successCheck: () => true,
  },
  {
    id: "sell",
    num: 7,
    title: "List on secondary market",
    desc: "Don't want to hold? List your PROP tokens for sale. Other investors can buy them directly — full liquidity cycle: buy → earn → sell.",
    icon: "send",
    action: "link",
    linkTo: "/portfolio",
    actionLabel: "Open portfolio",
    successCheck: () => true,
  },
];

function StepCard({ step, active, completed, ctx, onConnect }) {
  const isActive = active;
  const isDone = completed;

  return (
    <div
      className={`demo-step ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`}
      id={`demo-step-${step.id}`}
    >
      <div className="demo-step-num">
        {isDone ? (
          <span className="demo-check">✓</span>
        ) : (
          step.num
        )}
      </div>
      <div className="demo-step-body">
        <h3 className="demo-step-title">
          <Icon name={step.icon} size={15} /> {step.title}
        </h3>
        <p className="demo-step-desc">{step.desc}</p>
        {step.highlight && isActive && (
          <div className="demo-highlight">
            <Icon name="bolt" size={13} />
            <span>{step.highlight}</span>
          </div>
        )}
        {isActive && step.action === "connect" && !ctx.account && (
          <button className="btn btn-primary btn-sm" onClick={onConnect} style={{ marginTop: 10 }}>
            <Icon name="wallet" size={13} /> {step.actionLabel}
          </button>
        )}
        {isActive && step.action === "link" && (
          <Link to={step.linkTo} className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>
            {step.actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DemoWalkthrough() {
  const { account, connect, usdcBalance, fmtAddr } = useWeb3();
  const { isUGFEnabled, setUGFEnabled } = useUGF();
  const [currentStep, setCurrentStep] = useState(0);

  // Auto-advance step 0 (connect) when wallet connects.
  useEffect(() => {
    if (account && currentStep === 0) setCurrentStep(1);
  }, [account, currentStep]);

  // Ensure UGF is ON during demo.
  useEffect(() => {
    if (!isUGFEnabled) setUGFEnabled(true);
  }, [isUGFEnabled, setUGFEnabled]);

  const ctx = { account, usdcBalance };

  return (
    <div className="container-narrow reveal">
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 40, marginTop: 20 }}>
        <Logo size={56} style={{ margin: "0 auto 18px" }} />
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
          Judge <span className="accent">Demo Mode</span>
        </h1>
        <p className="text-secondary" style={{ maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
          Walk through the complete RealChain lifecycle in 60 seconds.
          Every step below is a real on-chain action — with zero ETH needed.
        </p>

        {account && (
          <div className="demo-wallet-strip">
            <div className="demo-wallet-item">
              <span className="demo-wallet-label">Wallet</span>
              <span className="badge badge-muted font-mono">{fmtAddr(account)}</span>
            </div>
            <div className="demo-wallet-item">
              <span className="demo-wallet-label">ETH balance</span>
              <span className="badge badge-danger">0 ETH</span>
            </div>
            <div className="demo-wallet-item">
              <span className="demo-wallet-label">USDC</span>
              <span className="badge badge-gold">${usdcBalance}</span>
            </div>
            <div className="demo-wallet-item">
              <span className="demo-wallet-label">Gas mode</span>
              <span className="badge badge-success">UGF — Mock USD</span>
            </div>
          </div>
        )}
      </div>

      {/* Step progress bar */}
      <div className="demo-progress">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            className={`demo-progress-dot ${i === currentStep ? "is-active" : ""} ${i < currentStep ? "is-done" : ""}`}
            onClick={() => setCurrentStep(i)}
            aria-label={`Step ${s.num}: ${s.title}`}
          />
        ))}
      </div>

      {/* Steps */}
      <div className="demo-steps">
        {STEPS.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            active={i === currentStep}
            completed={i < currentStep}
            ctx={ctx}
            onConnect={connect}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 justify-center" style={{ marginTop: 32, marginBottom: 48 }}>
        <button
          className="btn btn-secondary"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
        >
          <Icon name="arrowRight" size={13} style={{ transform: "rotate(180deg)" }} /> Previous
        </button>
        {currentStep < STEPS.length - 1 ? (
          <button
            className="btn btn-primary"
            onClick={() => setCurrentStep((s) => s + 1)}
          >
            Next step <Icon name="arrowRight" size={13} />
          </button>
        ) : (
          <Link to="/marketplace" className="btn btn-gold">
            <Icon name="bolt" size={14} /> Enter the app →
          </Link>
        )}
      </div>
    </div>
  );
}
