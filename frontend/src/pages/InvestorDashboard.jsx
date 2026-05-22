import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { useUGF } from "../context/UGFContext";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import UGFBadge from "../components/UGFBadge";
import CostBanner from "../components/CostBanner";
import ConnectGate from "../components/ConnectGate";
import AgentSuggestions from "../components/AgentSuggestions";
import { RENTAL_DISTRIBUTION_ABI, BACKEND_URL } from "../config/contracts";
import PortfolioChart from "../components/PortfolioChart";
import EpochCountdown from "../components/EpochCountdown";
import OnboardingChecklist from "../components/OnboardingChecklist";

// ─────────────────────────────────────────────────────────────────────────────
// InvestorDashboard — the demo centerpiece.
// Hero: total pending rent across all holdings.
// Body: per-property cards with "Claim" actions (UGF-wrapped).
// Sidebar: cost banner + recent epochs + quick links.
// ─────────────────────────────────────────────────────────────────────────────

export default function InvestorDashboard() {
  const { account, connect, getReadFactory, getReadPropertyContracts, getPropertyContracts, fmtUsdc, fmtProp, fmtAddr, refreshUsdcBalance } = useWeb3();
  const { ugfExecute, isUGFEnabled, logTx } = useUGF();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [claimReceipt, setClaimReceipt] = useState(null); // { amount, propertyName, gasMethod, txHash, time }
  const [portfolioEpochs, setPortfolioEpochs] = useState([]);
  const [walletStats, setWalletStats] = useState(null);

  useEffect(() => {
    if (account) {
      load();
      // Fetch P&L stats from backend
      fetch(`${BACKEND_URL}/api/transactions/stats/${account}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setWalletStats(d); })
        .catch(() => {});
    } else { setItems([]); setLoading(false); }
  }, [account]);

  // Live refresh — re-pull holdings + pending rent + USDC after any logTx.
  useEffect(() => {
    function onTx() { if (account) load(); }
    window.addEventListener("realchain:tx", onTx);
    return () => window.removeEventListener("realchain:tx", onTx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  async function load() {
    setLoading(true);
    try {
      const factory = getReadFactory();
      const count = Number(await factory.getPropertiesCount());
      const list = [];
      const allEpochs = [];
      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        const { token, rental } = getReadPropertyContracts({
          propertyToken: p.propertyToken,
          rentalDistribution: p.rentalDistribution,
          marketplace: p.marketplace,
        });
        const [bal, pending, totalSupply, epochCount] = await Promise.all([
          token.balanceOf(account),
          rental.pendingDividends(account),
          token.totalSupply(),
          rental.epochCount(),
        ]);
        if (bal > 0n) {
          const ownershipPct = totalSupply > 0n
            ? (Number(ethers.formatEther(bal)) / Number(ethers.formatEther(totalSupply))) * 100
            : 0;
          list.push({ id: i, property: p, balance: bal, pending });

          // Fetch epoch history for the portfolio chart — try API first
          let propertyEpochs = [];
          try {
            const apiRes = await fetch(`${BACKEND_URL}/api/properties/${i}/epochs?limit=50`);
            if (apiRes.ok) {
              const apiEpochs = await apiRes.json();
              if (apiEpochs.length > 0) {
                propertyEpochs = apiEpochs.map((e) => ({
                  propertyName: p.name,
                  id: e.id,
                  total: BigInt(e.total),
                  ts: e.ts,
                  ownershipPct,
                }));
              }
            }
          } catch { /* API unavailable */ }

          // Fallback: read from chain if API returned nothing
          if (propertyEpochs.length === 0) {
            for (let j = 0; j < Math.min(Number(epochCount), 50); j++) {
              try {
                const [total, , ts] = await rental.getEpoch(j);
                propertyEpochs.push({
                  propertyName: p.name,
                  id: j,
                  total,
                  ts: Number(ts),
                  ownershipPct,
                });
              } catch { /* skip bad epochs */ }
            }
          }
          allEpochs.push(...propertyEpochs);
        }
      }
      setItems(list);
      setPortfolioEpochs(allEpochs);
    } catch (e) {
      console.error(e);
      toast.error("Could not load holdings", { msg: "Check the network and try again." });
    } finally {
      setLoading(false);
    }
  }

  const totalPending = useMemo(() => items.reduce((s, it) => s + it.pending, 0n), [items]);
  const totalProp    = useMemo(() => items.reduce((s, it) => s + it.balance, 0n), [items]);
  const claimable    = items.filter((it) => it.pending > 0n);

  async function handleClaimOne(it) {
    setClaimingId(it.id);
    try {
      const receipt = await ugfExecute(
        it.property.rentalDistribution,
        RENTAL_DISTRIBUTION_ABI,
        "claimAll",
        []
      );
      const txHash = receipt?.hash || receipt?.transactionHash || null;
      const amountUsd = Number(it.pending) / 1e6;
      logTx({
        txHash,
        type: "claim",
        propertyId: it.id,
        amount: amountUsd,
        gasMethod: isUGFEnabled ? "ugf" : "eth",
        gasCostUsd: isUGFEnabled ? Number((amountUsd * 0.0001).toFixed(4)) : null,
      });

      // Show receipt
      setClaimReceipt({
        amount: amountUsd,
        propertyName: it.property?.name || `Property #${it.id}`,
        gasMethod: isUGFEnabled ? "ugf" : "eth",
        txHash,
        time: new Date().toLocaleTimeString(),
      });
      setTimeout(() => setClaimReceipt(null), 12000);

      toast.success("Rent claimed", { msg: `${fmtUsdc(it.pending)} arrived in your wallet.` });
      await refreshUsdcBalance();
      await load();
    } catch (e) {
      const msg = e?.reason || e?.message || "Transaction failed";
      const hint = !isUGFEnabled
        ? "you need ETH for gas. Toggle UGF on to pay gas in Mock USD."
        : msg;
      toast.error("Claim failed", { msg: hint.slice(0, 180) });
    } finally {
      setClaimingId(null);
    }
  }

  async function handleClaimAll() {
    for (const it of claimable) {
      // eslint-disable-next-line no-await-in-loop
      await handleClaimOne(it);
    }
  }

  if (!account) {
    return (
      <ConnectGate
        title="Connect to claim your rent"
        message="Sign in with MetaMask to see your holdings and claim USDC dividends. Gas is paid in Mock USD — no ETH needed."
      />
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="container reveal">
        <div className="page-header">
          <h1>Your <span className="accent">portfolio</span></h1>
          <p>Loading on-chain holdings…</p>
        </div>
        <div className="skeleton" style={{ height: 220, marginBottom: 24 }} />
        <div className="property-grid">
          {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 240 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container reveal">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Your <span className="accent">portfolio</span></h1>
            <p>One click claims every pending rent payment across your properties — gas settled in Mock USD.</p>
          </div>
          <div className="flex gap-3 items-center">
            <span className="role-badge is-investor"><Icon name="users" size={12} /> Investor</span>
            <span className="badge badge-muted font-mono"><Icon name="wallet" size={12} /> {fmtAddr(account)}</span>
          </div>
        </div>
      </div>

      <div className="layout-two-col">
        {/* MAIN COLUMN */}
        <div>
          {/* Onboarding checklist for new investors */}
          <OnboardingChecklist
            hasHoldings={items.length > 0}
            hasClaimed={walletStats?.claimCount > 0}
          />

          {/* Hero KPI */}
          <div className="hero-kpi reveal" style={{ marginBottom: 24 }}>
            <div className="hero-kpi-label">Total Pending Rent</div>
            <div className="hero-kpi-value">{fmtUsdc(totalPending)}</div>
            <div className="hero-kpi-meta">
              Across {items.length} {items.length === 1 ? "property" : "properties"} · {fmtProp(totalProp)} PROP held
            </div>

            {claimable.length > 0 && (
              <div style={{ marginTop: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <button
                  className="btn btn-gold btn-xl"
                  onClick={handleClaimAll}
                  disabled={Boolean(claimingId)}
                  aria-label={`Claim all rent worth ${fmtUsdc(totalPending)}`}
                >
                  {claimingId
                    ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Claiming…</>
                    : <><Icon name="bolt" size={16} /> Claim all rent · {fmtUsdc(totalPending)}</>}
                </button>
                <UGFBadge />
              </div>
            )}
          </div>

          {/* P&L Summary */}
          {walletStats && (walletStats.totalInvested > 0 || walletStats.totalClaimed > 0) && (
            <div className="section">
              <h2 className="section-title"><Icon name="trending" size={14} /> Profit & Loss</h2>
              <div className="stats-row" style={{ marginBottom: 0 }}>
                <div className="stat-card">
                  <div className="stat-label"><Icon name="dollar" size={12} /> Total invested</div>
                  <div className="stat-value">${Number(walletStats.totalInvested || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label"><Icon name="coins" size={12} /> Total claimed</div>
                  <div className="stat-value">${Number(walletStats.totalClaimed || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label"><Icon name="bolt" size={12} /> Net P&L</div>
                  {(() => {
                    const net = (walletStats.totalClaimed || 0) - (walletStats.totalInvested || 0) + Number(totalPending) / 1e6;
                    const isPos = net >= 0;
                    return <div className="stat-value" style={{ color: isPos ? "#22c55e" : "#ef4444" }}>{isPos ? "+" : ""}${Math.abs(net).toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>;
                  })()}
                </div>
                <div className="stat-card">
                  <div className="stat-label"><Icon name="history" size={12} /> Transactions</div>
                  <div className="stat-value">{walletStats.totalTransactions || 0}</div>
                </div>
              </div>
            </div>
          )}

          {/* Portfolio earnings chart */}
          {portfolioEpochs.length > 0 && (
            <div className="section">
              <h2 className="section-title"><Icon name="trending" size={14} /> Earnings over time</h2>
              <div className="card card-elevated">
                <div className="card-body">
                  <PortfolioChart epochs={portfolioEpochs} />
                </div>
              </div>
            </div>
          )}

          {/* Cost banner */}
          {claimable.length > 0 && (
            <div className="section">
              <h2 className="section-title"><Icon name="info" size={14} /> Estimated cost</h2>
              <CostBanner
                target={claimable[0].property.rentalDistribution}
                abi={RENTAL_DISTRIBUTION_ABI}
                fnName="claimAll"
                args={[]}
              />
              <div className="text-xs text-muted" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="info" size={11} /> Comparing native gas vs UGF-sponsored gas for the same call.
              </div>
            </div>
          )}

          {/* Smart Agent — heuristic suggestions + optional LLM Q&A */}
          <AgentSuggestions
            holdings={items.map((it) => ({
              id: it.id,
              name: it.property?.name || `Property #${it.id}`,
              location: it.property?.location || "",
              pending: it.pending,
              balance: it.balance,
            }))}
          />

          {/* Holdings */}
          <div className="section">
            <h2 className="section-title"><Icon name="building" size={14} /> Holdings</h2>
            {items.length === 0 ? (
              <EmptyHoldings onBrowse={() => navigate("/")} />
            ) : (
              <div className="property-grid">
                {items.map((it) => (
                  <HoldingCard
                    key={it.id}
                    item={it}
                    fmtUsdc={fmtUsdc}
                    fmtProp={fmtProp}
                    isClaiming={claimingId === it.id}
                    onClaim={() => handleClaimOne(it)}
                    epochs={portfolioEpochs.filter(e => e.propertyName === it.property.name)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR */}
        <div>
          {/* Claim receipt */}
          {claimReceipt && (
            <div style={{
              marginBottom: 16, padding: "18px 20px", borderRadius: "var(--radius-md, 12px)",
              background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
              border: "2px solid #10b981",
              animation: "fadeIn 0.3s ease-out",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", background: "#10b981",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 16, fontWeight: 800,
                }}>✓</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#065f46" }}>Rent claimed!</div>
                  <div style={{ fontSize: 11, color: "#047857" }}>{claimReceipt.time}</div>
                </div>
                <button onClick={() => setClaimReceipt(null)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#065f46", fontSize: 16, padding: 4,
                }}>×</button>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#065f46", marginBottom: 8 }}>
                +${claimReceipt.amount.toFixed(2)} USDC
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, color: "#065f46" }}>
                <div><span style={{ opacity: 0.7 }}>Property:</span> <strong>{claimReceipt.propertyName}</strong></div>
                <div><span style={{ opacity: 0.7 }}>Gas:</span> <strong>{claimReceipt.gasMethod === "ugf" ? "Mock USD (UGF) ⚡" : "ETH"}</strong></div>
              </div>
              {claimReceipt.txHash && (
                <div style={{ marginTop: 8, fontSize: 10, color: "#047857", wordBreak: "break-all" }}>
                  Tx: {claimReceipt.txHash.slice(0, 10)}...{claimReceipt.txHash.slice(-8)}
                </div>
              )}
            </div>
          )}
          <SidebarTips />
        </div>
      </div>
    </div>
  );
}

function HoldingCard({ item, fmtUsdc, fmtProp, isClaiming, onClaim, epochs = [] }) {
  const { property: p, balance, pending } = item;
  const pct = (Number(ethers.formatEther(balance)) / 100) * 100;
  const hasPending = pending > 0n;

  return (
    <div className="card card-elevated reveal">
      <div className="card-body">
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <span className="badge badge-success"><span className="status-dot" /> Live</span>
          <span className="badge badge-muted font-mono">#{p.propertyToken?.slice(2, 6) || "—"}</span>
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>{p.name}</h3>
        <div className="text-xs text-muted" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="pin" size={12} /> {p.location}
        </div>

        <div style={{
          marginTop: 16, padding: 16,
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
        }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span className="text-xs text-muted">Pending rent</span>
            <span className="badge badge-gold">USDC</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: hasPending ? "var(--amber-400)" : "var(--fg-muted)", letterSpacing: "-0.02em" }}>
            {fmtUsdc(pending)}
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>
            From your {fmtProp(balance)} PROP · {pct.toFixed(1)}% ownership
          </div>
        </div>

        {/* Epoch countdown */}
        <div style={{ marginTop: 12 }}>
          <EpochCountdown epochs={epochs} />
        </div>

        <div className="flex gap-2" style={{ marginTop: 14 }}>
          <button
            className="btn btn-primary btn-sm flex-1"
            onClick={onClaim}
            disabled={!hasPending || isClaiming}
          >
            {isClaiming
              ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Claiming…</>
              : hasPending
                ? <><Icon name="bolt" size={12} /> Claim {fmtUsdc(pending)}</>
                : <>Nothing to claim</>}
          </button>
          <Link to="/portfolio" className="btn btn-secondary btn-sm" aria-label="Sell tokens">
            <Icon name="send" size={12} /> Sell
          </Link>
          <Link to={`/property/${item.id}`} className="btn btn-secondary btn-sm" aria-label="View property">
            <Icon name="external" size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyHoldings({ onBrowse }) {
  return (
    <div className="empty-state">
      <span className="emoji"><Icon name="briefcase" size={28} /></span>
      <h3>No holdings yet</h3>
      <p>Buy fractional ownership in a property to start earning USDC rent.</p>
      <button className="btn btn-primary mt-6" onClick={onBrowse}>
        Browse properties <Icon name="arrowRight" size={13} />
      </button>
    </div>
  );
}

function SidebarTips() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div className="card-body">
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <span style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--accent-soft)", color: "var(--violet-300)" }}>
              <Icon name="info" size={14} />
            </span>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>How rent works</h3>
          </div>
          <ol style={{ paddingLeft: 18, color: "var(--fg-secondary)", fontSize: 13, lineHeight: 1.7 }}>
            <li>Owners deposit USDC each rental epoch.</li>
            <li>Your share is calculated by token balance at deposit time.</li>
            <li>Claim anytime — gas settled in Mock USD via UGF.</li>
          </ol>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <span style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--gold-soft)", color: "var(--amber-400)" }}>
              <Icon name="shield" size={14} />
            </span>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Two-token model</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <div className="flex items-center justify-between">
              <span className="text-muted">Rent settlement</span>
              <span className="badge badge-gold">USDC</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Gas settlement</span>
              <span className="badge badge-accent">Mock USD</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
