import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { useUGF } from "../context/UGFContext";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import UGFBadge from "../components/UGFBadge";
import ConnectGate from "../components/ConnectGate";
import {
  GasMethodBadge,
  ContractMethodBadge,
  OnChainBadge,
  EpochCadenceIndicator,
  FractionalOwnershipBar,
} from "../components/ScreenPrimitives";
import { CONTRACT_ADDRESSES, RENTAL_DISTRIBUTION_ABI, BACKEND_URL } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// "Claim Rent" page — granular per-property view (replaces the old Dividends).
// Route stays /dividends so old links still resolve (per Requirement 11.2).
// All visible labels read "Claim Rent" / "Rent" — Requirement 11.1.
// ─────────────────────────────────────────────────────────────────────────────

export default function Dividends() {
  const { account, getReadFactory, getReadPropertyContracts, fmtUsdc, fmtProp, refreshUsdcBalance } = useWeb3();
  const { ugfExecute, ugfApprove, isUGFEnabled, logTx } = useUGF();
  const { toast } = useToast();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (account) load(); else { setLoading(false); setProperties([]); } }, [account]);

  // Live refresh — pending rent and epoch state shift on every claim/deposit
  // dispatched anywhere in the app.
  useEffect(() => {
    function onTx() { if (account) load(); }
    window.addEventListener("realchain:tx", onTx);
    return () => window.removeEventListener("realchain:tx", onTx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  async function load() {
    if (properties.length === 0) setLoading(true);
    try {
      const factory = getReadFactory();
      const count = Number(await factory.getPropertiesCount());
      const ps = [];
      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        const { token, rental } = getReadPropertyContracts({
          propertyToken: p.propertyToken,
          rentalDistribution: p.rentalDistribution,
          marketplace: p.marketplace,
        });

        const epochCount = Number(await rental.epochCount());
        let epochs = [];

        // Try loading epochs from backend API (fast — single HTTP call)
        try {
          const apiRes = await fetch(`${BACKEND_URL}/api/properties/${i}/epochs?limit=50`);
          if (apiRes.ok) {
            const apiEpochs = await apiRes.json();
            if (apiEpochs.length > 0) {
              // Enrich with per-user claimed status from chain
              epochs = await Promise.all(apiEpochs.map(async (e) => {
                const isClaimed = await rental.claimed(e.id, account).catch(() => false);
                return { id: e.id, total: BigInt(e.total), ts: e.ts, isClaimed };
              }));
            }
          }
        } catch { /* API unavailable — fall through to chain */ }

        // Fallback: read directly from chain if API returned nothing
        if (epochs.length === 0 && epochCount > 0) {
          for (let j = 0; j < epochCount; j++) {
            const [total, , ts] = await rental.getEpoch(j);
            const isClaimed = await rental.claimed(j, account);
            epochs.push({ id: j, total, ts: Number(ts), isClaimed });
          }
        }

        const [pending, balance, totalSupply] = await Promise.all([
          rental.pendingDividends(account),
          token.balanceOf(account),
          token.totalSupply(),
        ]);

        // Compute median cadence over the last 12 deposits — used by the
        // EpochCadenceIndicator to show the projected next deposit date.
        let cadenceDays = null;
        let lastDepositAt = null;
        if (epochs.length >= 2) {
          const sorted = [...epochs].sort((a, b) => a.ts - b.ts);
          lastDepositAt = sorted[sorted.length - 1].ts * 1000;
          const recent = sorted.slice(-12);
          const gaps = [];
          for (let k = 1; k < recent.length; k++) gaps.push(recent[k].ts - recent[k - 1].ts);
          gaps.sort((a, b) => a - b);
          const median = gaps[Math.floor(gaps.length / 2)];
          cadenceDays = Math.max(1, Math.round(median / 86_400));
        }

        ps.push({
          propId: i, prop: p, pending, balance, totalSupply,
          epochCount, epochs,
          cadenceDays, lastDepositAt,
          isOwner: p.owner.toLowerCase() === account.toLowerCase(),
        });
      }
      setProperties(ps);
    } catch (e) {
      console.error(e);
      toast.error("Could not load rent history", { msg: "Check the network and try again." });
    } finally {
      setLoading(false);
    }
  }

  const totalPending = properties.reduce((s, p) => s + p.pending, 0n);

  if (!account) {
    return (
      <ConnectGate
        title="Connect to claim your rent"
        message="Sign in with MetaMask to see pending rent across every property you hold tokens for."
      />
    );
  }

  return (
    <div className="container reveal">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Claim <span className="accent">rent</span></h1>
            <p>Per-property breakdown of every rent epoch — claim individually or use the dashboard hero for one-tap claim-all.</p>
          </div>
          <Link to="/investor" className="btn btn-secondary btn-sm">
            <Icon name="grid" size={12} /> One-tap claim-all <Icon name="arrowRight" size={11} />
          </Link>
        </div>
      </div>

      {/* Hero KPI */}
      <div className="hero-kpi" style={{ marginBottom: 32 }}>
        <div className="hero-kpi-label">Total pending rent</div>
        <div className="hero-kpi-value">{fmtUsdc(totalPending)}</div>
        <div className="hero-kpi-meta">Across {properties.length} {properties.length === 1 ? "property" : "properties"}</div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 16 }}>
          {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 240 }} />)}
        </div>
      ) : properties.length === 0 ? (
        <div className="empty-state">
          <span className="emoji"><Icon name="receipt" size={28} /></span>
          <h3>No properties yet</h3>
          <p>Once a property is deployed and you hold tokens, rent will show up here.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          {properties.map((p) => (
            <RentCard
              key={p.propId}
              data={p}
              fmtUsdc={fmtUsdc}
              fmtProp={fmtProp}
              ugfExecute={ugfExecute}
              ugfApprove={ugfApprove}
              isUGFEnabled={isUGFEnabled}
              logTx={logTx}
              onRefresh={load}
              refreshUsdcBalance={refreshUsdcBalance}
              toast={toast}
              getReadPropertyContracts={getReadPropertyContracts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RentCard({ data, fmtUsdc, fmtProp, ugfExecute, ugfApprove, isUGFEnabled, logTx, onRefresh, refreshUsdcBalance, toast, getReadPropertyContracts }) {
  const { prop, balance, totalSupply, pending, epochCount, epochs, isOwner, propId, cadenceDays, lastDepositAt } = data;
  const [busy, setBusy] = useState(null); // null | "claim" | "deposit"
  const [depositAmt, setDepositAmt] = useState("");
  const [lastTxHash, setLastTxHash] = useState(null);
  const hasPending = pending > 0n;

  const balanceNum = Number(ethers.formatEther(balance));
  const supplyNum = totalSupply ? Number(ethers.formatEther(totalSupply)) : 0;

  async function handleClaim() {
    setBusy("claim");
    try {
      const receipt = await ugfExecute(prop.rentalDistribution, RENTAL_DISTRIBUTION_ABI, "claimAll", []);
      const txHash = receipt?.hash || receipt?.transactionHash || null;
      setLastTxHash(txHash);
      logTx({
        txHash, type: "claim",
        propertyId: propId,
        amount: Number(pending) / 1e6,
        gasMethod: isUGFEnabled ? "ugf" : "eth",
      });
      toast.success("Rent claimed", { msg: `${fmtUsdc(pending)} arrived in your wallet.` });
      onRefresh(); refreshUsdcBalance();
    } catch (e) {
      toast.error("Claim failed", { msg: (e.reason || e.message || "").slice(0, 180) });
    } finally {
      setBusy(null);
    }
  }

  async function handleDeposit() {
    if (!depositAmt) return;
    const amt = BigInt(Math.floor(parseFloat(depositAmt) * 1e6));
    setBusy("deposit");
    try {
      toast.info("Approving USDC", { msg: "UGF will settle approval gas in Mock USD." });
      await ugfApprove(CONTRACT_ADDRESSES.mockUsdc, prop.rentalDistribution, amt);

      const receipt = await ugfExecute(prop.rentalDistribution, RENTAL_DISTRIBUTION_ABI, "depositRental", [amt]);
      const txHash = receipt?.hash || receipt?.transactionHash || null;
      setLastTxHash(txHash);
      logTx({
        txHash, type: "deposit",
        propertyId: propId,
        amount: parseFloat(depositAmt),
        gasMethod: isUGFEnabled ? "ugf" : "eth",
      });
      toast.success("Rent deposited", { msg: `${fmtUsdc(amt)} added to a new epoch.` });
      setDepositAmt("");

      // Persist epoch to backend immediately (fast-path)
      try {
        const { rental: rentalRo } = getReadPropertyContracts({
          propertyToken: prop.propertyToken,
          rentalDistribution: prop.rentalDistribution,
          marketplace: prop.marketplace,
        });
        await new Promise((r) => setTimeout(r, 2000));
        const newEpochCount = Number(await rentalRo.epochCount());
        const lastIdx = newEpochCount - 1;
        if (lastIdx >= 0) {
          const [total, , ts] = await rentalRo.getEpoch(lastIdx);
          await fetch(`${BACKEND_URL}/api/properties/${propId}/epochs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              epochIndex: lastIdx,
              amount: Number(total) / 1e6,
              amountRaw: total.toString(),
              timestamp: Number(ts),
              txHash,
            }),
          });
        }
      } catch (saveErr) {
        console.warn("Epoch save to backend failed (non-fatal):", saveErr);
      }

      await onRefresh();
    } catch (e) {
      toast.error("Deposit failed", { msg: (e.reason || e.message || "").slice(0, 180) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card card-elevated">
      <div className="card-body">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>{prop.name}</h2>
            <div className="text-xs text-muted" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="pin" size={12} /> {prop.location}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: hasPending ? "var(--amber-400)" : "var(--fg-muted)", letterSpacing: "-0.01em", fontFeatureSettings: "'tnum' on" }}>
              {fmtUsdc(pending)}
            </div>
            <div className="text-xs text-muted">pending</div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="stats-row" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-label">My tokens</div>
            <div className="stat-value accent" style={{ fontSize: 18 }}>{fmtProp(balance)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total epochs</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{epochCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Claimable now</div>
            <div className="stat-value gold" style={{ fontSize: 18 }}>{fmtUsdc(pending)}</div>
          </div>
        </div>

        {/* Fractional ownership + cadence — visible blockchain context */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, marginBottom: 16, alignItems: "center" }}>
          <FractionalOwnershipBar
            holding={balanceNum}
            totalSupply={supplyNum}
            label="Your share of this property"
          />
          <EpochCadenceIndicator cadenceDays={cadenceDays} lastDepositAt={lastDepositAt} />
        </div>

        {/* Claim CTA */}
        {hasPending && (
          <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={handleClaim} disabled={busy === "claim"}>
              {busy === "claim"
                ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 1.5 }} /> Claiming…</>
                : <><Icon name="bolt" size={13} /> Claim {fmtUsdc(pending)}</>}
            </button>
            <UGFBadge />
            <GasMethodBadge method={isUGFEnabled ? "ugf" : "eth"} compact />
            <ContractMethodBadge contractName="RentalDistribution" methodName="claimAll" address={prop.rentalDistribution} />
            {lastTxHash && <OnChainBadge txHash={lastTxHash} label="Last claim" />}
          </div>
        )}

        {/* Owner-only deposit */}
        {isOwner && (
          <div style={{
            padding: 16,
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="star" size={12} className="text-gold" /> Owner — deposit rent
            </h3>
            <div className="flex gap-3 items-end flex-wrap">
              <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                <label className="form-label">USDC amount</label>
                <div className="form-input-prefix">
                  <span className="prefix">$</span>
                  <input className="form-input" type="number" min="0" step="0.01" placeholder="500.00"
                    value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} />
                </div>
              </div>
              <button className="btn btn-secondary" onClick={handleDeposit} disabled={!depositAmt || busy === "deposit"}>
                {busy === "deposit" ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Depositing…</> : <>Deposit</>}
              </button>
            </div>
          </div>
        )}

        {/* Epoch history */}
        {epochCount > 0 && (
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <Icon name="history" size={12} style={{ verticalAlign: -2, marginRight: 6 }} /> Rent history
            </h3>
            <div className="table-wrap" style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
              <table>
                <thead>
                  <tr><th>#</th><th>Amount</th><th>Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {epochs.map((e) => (
                    <tr key={e.id}>
                      <td className="text-muted text-sm">#{e.id}</td>
                      <td className="font-bold" style={{ color: "var(--amber-400)" }}>{fmtUsdc(e.total)}</td>
                      <td className="text-muted text-sm">
                        {new Date(e.ts * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td>
                        {balance === 0n ? (
                          <span className="badge badge-muted">No holdings</span>
                        ) : e.isClaimed ? (
                          <span className="badge badge-success"><Icon name="check" size={10} /> Claimed</span>
                        ) : (
                          <span className="badge badge-gold">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
