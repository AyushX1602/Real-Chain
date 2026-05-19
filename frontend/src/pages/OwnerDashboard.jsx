import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { useUGF } from "../context/UGFContext";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import UGFBadge from "../components/UGFBadge";
import CostBanner from "../components/CostBanner";
import ConnectGate from "../components/ConnectGate";
import {
  GasMethodBadge,
  ContractMethodBadge,
  OnChainBadge,
  HolderConcentrationStrip,
  EpochCadenceIndicator,
  FractionalOwnershipBar,
} from "../components/ScreenPrimitives";
import { BACKEND_URL, CONTRACT_ADDRESSES, RENTAL_DISTRIBUTION_ABI } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// OwnerDashboard — properties you own, rent you have deposited, quick deposit
// form, create-property launchpad. Deposit is wrapped with UGF in Tier 2.
// ─────────────────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const { account, roleHint, getReadFactory, getReadPropertyContracts, getFactory, fmtUsdc, fmtProp, fmtAddr, fmtInr } = useWeb3();
  const { ugfExecute, ugfApprove, isUGFEnabled, logTx } = useUGF();
  const { toast } = useToast();
  const [props, setProps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newProp, setNewProp] = useState({ name: "", location: "", valueInr: "", price: "" });

  useEffect(() => { if (account) load(); }, [account]);

  async function load() {
    setLoading(true);
    try {
      const factory = getReadFactory();
      const count = Number(await factory.getPropertiesCount());
      const list = [];
      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        if (p.owner.toLowerCase() !== account.toLowerCase()) continue;
        const { token, rental } = getReadPropertyContracts({
          propertyToken: p.propertyToken,
          rentalDistribution: p.rentalDistribution,
          marketplace: p.marketplace,
        });
        const epochCount = Number(await rental.epochCount());
        let totalDeposited = 0n;
        const epochs = [];
        for (let j = 0; j < epochCount; j++) {
          const [total, , ts] = await rental.getEpoch(j);
          totalDeposited += total;
          epochs.push({ id: j, total, ts: Number(ts) });
        }

        // Cadence calc — same logic as the Claim Rent screen.
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

        const [ownerSupply, totalSupply] = await Promise.all([
          token.balanceOf(p.owner),
          token.totalSupply(),
        ]);
        list.push({
          id: i, property: p, totalDeposited, ownerSupply, totalSupply,
          epochs, cadenceDays, lastDepositAt,
          holderShares: null, // filled async by fetchHolderConcentration
          lastTxHash: null,
        });
      }
      setProps(list);
      // Fire holder-concentration fetches in parallel — they fail soft.
      list.forEach((p) => fetchHolderConcentration(p.id));
    } catch (e) {
      console.error(e);
      toast.error("Could not load properties", { msg: "Check the network and try again." });
    } finally {
      setLoading(false);
    }
  }

  // Pull top-5 holder concentration from the indexer per property.
  async function fetchHolderConcentration(id) {
    try {
      const r = await fetch(`${BACKEND_URL}/api/properties/${id}/holders`, {
        signal: AbortSignal.timeout?.(10_000),
      });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      // Tolerate both new envelope { count, holders } and legacy bare array.
      const list = Array.isArray(data?.holders) ? data.holders : Array.isArray(data) ? data : [];
      // Server may already return sharePct; fall back to local computation.
      const haveServerShare = list.length > 0 && typeof list[0]?.sharePct === "number";
      let top5;
      if (haveServerShare) {
        top5 = list.slice(0, 5).map((h) => Number(h.sharePct));
      } else {
        const sorted = list.slice().sort((a, b) => Number(b.balance) - Number(a.balance));
        const total = sorted.reduce((s, h) => s + Number(h.balance), 0);
        if (total === 0) return;
        top5 = sorted.slice(0, 5).map((h) => Math.round((Number(h.balance) / total) * 1000) / 10);
      }
      setProps((prev) => prev.map((p) => p.id === id ? { ...p, holderShares: top5 } : p));
    } catch { /* leave as null — strip renders "—" */ }
  }

  const totalRent = useMemo(() => props.reduce((s, x) => s + x.totalDeposited, 0n), [props]);
  const totalEpochs = useMemo(() => props.reduce((s, x) => s + x.epochs.length, 0), [props]);

  async function handleCreate() {
    const { name, location, valueInr, price } = newProp;
    if (!name || !location || !valueInr || !price) return;
    try {
      const factory = getFactory();
      const inrPaisa = BigInt(Math.floor(parseFloat(valueInr) * 100));
      const usdc6 = BigInt(Math.floor(parseFloat(price) * 1e6));
      const tx = await factory.createProperty(name, location, inrPaisa, usdc6);
      toast.info("Creating property…", { msg: "Confirm in MetaMask." });
      await tx.wait();
      toast.success("Property created", { msg: `${name} is now live on-chain.` });
      setCreatingNew(false);
      setNewProp({ name: "", location: "", valueInr: "", price: "" });
      await load();
    } catch (e) {
      toast.error("Create failed", { msg: (e.reason || e.message || "").slice(0, 160) });
    }
  }

  if (!account) {
    return (
      <ConnectGate
        title="Connect to manage your properties"
        message="Sign in with MetaMask to deposit rent, mint new properties, and review epochs."
      />
    );
  }
  if (account && roleHint === "Investor") {
    return <Navigate to="/investor" replace />;
  }

  return (
    <div className="container reveal">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Owner <span className="accent">control room</span></h1>
            <p>Deposit USDC rent, launch new properties, and watch your distributions land in seconds.</p>
          </div>
          <div className="flex gap-3 items-center">
            <span className="role-badge is-owner"><Icon name="star" size={12} /> Owner</span>
            <button className="btn btn-gold" onClick={() => setCreatingNew(true)}>
              <Icon name="plus" size={14} /> New property
            </button>
          </div>
        </div>
      </div>

      {/* Top stats row */}
      <div className="stats-row" style={{ marginBottom: 32 }}>
        <KpiCard icon="building" label="Properties owned" value={String(props.length)} tone="accent" />
        <KpiCard icon="coins" label="Total rent deposited" value={fmtUsdc(totalRent)} tone="gold" />
        <KpiCard icon="history" label="Total epochs" value={String(totalEpochs)} tone="success" />
        <KpiCard icon="user" label="Wallet" value={fmtAddr(account)} mono tone="muted" />
      </div>

      {creatingNew && (
        <CreatePropertyForm
          value={newProp}
          onChange={setNewProp}
          onSubmit={handleCreate}
          onCancel={() => setCreatingNew(false)}
        />
      )}

      {loading ? (
        <div className="property-grid">
          {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 280 }} />)}
        </div>
      ) : props.length === 0 ? (
        <div className="empty-state">
          <span className="emoji"><Icon name="building" size={28} /></span>
          <h3>No properties yet</h3>
          <p>Tokenize your first property to start collecting fractional rent.</p>
          <button className="btn btn-primary mt-6" onClick={() => setCreatingNew(true)}>
            <Icon name="plus" size={13} /> Create property
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {props.map((p) => (
            <OwnedPropertyCard
              key={p.id}
              item={p}
              fmtUsdc={fmtUsdc}
              fmtProp={fmtProp}
              fmtInr={fmtInr}
              ugfExecute={ugfExecute}
              ugfApprove={ugfApprove}
              isUGFEnabled={isUGFEnabled}
              logTx={logTx}
              onRefresh={load}
              toast={toast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, tone = "accent", mono = false }) {
  return (
    <div className="stat-card">
      <div className="stat-label"><Icon name={icon} size={12} /> {label}</div>
      <div className={`stat-value ${tone}`} style={{ fontFamily: mono ? "var(--font-mono)" : undefined, fontSize: mono ? 18 : undefined }}>
        {value}
      </div>
    </div>
  );
}

function CreatePropertyForm({ value, onChange, onSubmit, onCancel }) {
  return (
    <div className="card card-elevated reveal" style={{ marginBottom: 24 }}>
      <div className="card-body">
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>
            <Icon name="plus" size={16} style={{ verticalAlign: -2, marginRight: 8 }} />
            Tokenize a new property
          </h2>
          <button className="icon-btn" onClick={onCancel} aria-label="Cancel">
            <Icon name="close" size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" placeholder="Skyline Heights"
              value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-input" placeholder="Mumbai, India"
              value={value.location} onChange={(e) => onChange({ ...value, location: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Valuation (INR)</label>
            <div className="form-input-prefix">
              <span className="prefix">₹</span>
              <input className="form-input" type="number" placeholder="50000000"
                value={value.valueInr} onChange={(e) => onChange({ ...value, valueInr: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Price / token (USDC)</label>
            <div className="form-input-prefix">
              <span className="prefix">$</span>
              <input className="form-input" type="number" step="0.01" placeholder="10.00"
                value={value.price} onChange={(e) => onChange({ ...value, price: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="flex gap-3" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={onSubmit}>
            <Icon name="check" size={13} /> Mint property
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function OwnedPropertyCard({ item, fmtUsdc, fmtProp, fmtInr, ugfExecute, ugfApprove, isUGFEnabled, logTx, onRefresh, toast }) {
  const { property: p, totalDeposited, ownerSupply, totalSupply, epochs, cadenceDays, lastDepositAt, holderShares } = item;
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastTxHash, setLastTxHash] = useState(null);
  const [validationErr, setValidationErr] = useState(null);

  const ownerSupplyNum = Number(ethers.formatEther(ownerSupply));
  const totalSupplyNum = totalSupply ? Number(ethers.formatEther(totalSupply)) : 0;
  const distributedNum = Math.max(0, totalSupplyNum - ownerSupplyNum);

  function validate(value) {
    const v = String(value ?? "").trim();
    if (!v) return "Enter an amount";
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return "Up to 2 decimal places";
    const n = Number(v);
    if (!Number.isFinite(n)) return "Invalid number";
    if (n < 0.01) return "Minimum 0.01 MockUSDC";
    if (n > 1_000_000) return "Maximum 1,000,000 MockUSDC";
    return null;
  }

  async function handleDeposit() {
    const err = validate(amount);
    if (err) { setValidationErr(err); return; }
    setValidationErr(null);
    const usdcRaw = BigInt(Math.floor(parseFloat(amount) * 1e6));
    setBusy(true);
    try {
      toast.info("Approving USDC", { msg: "UGF will settle approval gas in Mock USD." });
      await ugfApprove(CONTRACT_ADDRESSES.mockUsdc, p.rentalDistribution, usdcRaw);

      const receipt = await ugfExecute(p.rentalDistribution, RENTAL_DISTRIBUTION_ABI, "depositRental", [usdcRaw]);
      const txHash = receipt?.hash || receipt?.transactionHash || null;
      setLastTxHash(txHash);
      logTx({
        txHash,
        type: "deposit",
        propertyId: item.id,
        amount: parseFloat(amount),
        gasMethod: isUGFEnabled ? "ugf" : "eth",
      });
      toast.success("Rent deposited", { msg: `${fmtUsdc(usdcRaw)} added to a new epoch.` });
      setAmount("");
      onRefresh();
    } catch (e) {
      toast.error("Deposit failed", { msg: (e.reason || e.message || "").slice(0, 160) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-elevated">
      <div className="card-body">
        <div className="flex items-center justify-between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>{p.name}</h2>
            <div className="text-xs text-muted" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="pin" size={12} /> {p.location}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <span className="badge badge-gold">{fmtInr(p.valueInr)}</span>
            <span className="badge badge-success"><span className="status-dot" /> Live</span>
            <Link to={`/property/${item.id}`} className="btn btn-ghost btn-sm">
              View page <Icon name="arrowRight" size={11} />
            </Link>
          </div>
        </div>

        <div className="stats-row" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-label">Total deposited</div>
            <div className="stat-value gold">{fmtUsdc(totalDeposited)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Rent epochs</div>
            <div className="stat-value">{epochs.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Owner supply left</div>
            <div className="stat-value accent">{fmtProp(ownerSupply)} <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>PROP</span></div>
          </div>
        </div>

        {/* Tokenization health: distribution + holder concentration + cadence */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
          padding: 16, marginBottom: 16,
          background: "#fff", border: "1px solid #191A23", borderRadius: 10,
        }}>
          <FractionalOwnershipBar
            holding={distributedNum}
            totalSupply={totalSupplyNum}
            label="Tokens distributed"
          />
          {holderShares == null
            ? <div className="text-xs text-muted" style={{ alignSelf: "center" }}>
                <Icon name="info" size={11} /> Holder concentration loading…
              </div>
            : <HolderConcentrationStrip shares={holderShares} label="Top-5 share" />
          }
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <EpochCadenceIndicator cadenceDays={cadenceDays} lastDepositAt={lastDepositAt} />
            {lastTxHash && <OnChainBadge txHash={lastTxHash} label="Last deposit" />}
          </div>
        </div>

        {/* Deposit form */}
        <div style={{
          padding: 18,
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          marginBottom: 16,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="send" size={14} className="text-accent" />
            Deposit rental income
          </h3>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="form-label">USDC amount</label>
              <div className="form-input-prefix">
                <span className="prefix">$</span>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="500.00"
                  value={amount} onChange={(e) => { setAmount(e.target.value); setValidationErr(null); }} />
              </div>
              {validationErr && <div className="text-xs" style={{ color: "var(--red-500)", marginTop: 4 }}>{validationErr}</div>}
            </div>
            <button className="btn btn-primary" onClick={handleDeposit} disabled={!amount || busy}>
              {busy ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Depositing…</> : <><Icon name="bolt" size={13} /> Deposit</>}
            </button>
          </div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <UGFBadge />
              <GasMethodBadge method={isUGFEnabled ? "ugf" : "eth"} compact />
              <ContractMethodBadge contractName="RentalDistribution" methodName="depositRental" address={p.rentalDistribution} />
            </div>
            {amount && !validationErr && <CostBanner
              target={p.rentalDistribution}
              abi={RENTAL_DISTRIBUTION_ABI}
              fnName="depositRental"
              args={[BigInt(Math.floor(parseFloat(amount || "0") * 1e6))]}
              estimate={120_000n}
              className="full-width"
            />}
          </div>
        </div>

        {/* Recent epochs */}
        {epochs.length > 0 && (
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <Icon name="history" size={12} style={{ verticalAlign: -2, marginRight: 6 }} /> Recent epochs
            </h3>
            <div className="table-wrap" style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
              <table>
                <thead>
                  <tr><th>#</th><th>Amount</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {epochs.slice(-5).reverse().map((e) => (
                    <tr key={e.id}>
                      <td className="text-muted text-sm">#{e.id}</td>
                      <td className="font-bold" style={{ color: "var(--amber-400)" }}>{fmtUsdc(e.total)}</td>
                      <td className="text-muted text-sm">
                        {new Date(e.ts * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
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
