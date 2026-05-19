import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";
import { useUGF } from "../context/UGFContext";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import UGFBadge from "../components/UGFBadge";
import {
  BACKEND_URL,
  CONTRACT_ADDRESSES,
  MOCK_USDC_ABI,
} from "../config/contracts";

export default function TenantDashboard() {
  const { user, isAuthenticated } = useAuth();
  const {
    account,
    connect,
    connecting,
    getReadFactory,
    fmtAddr,
    fmtInr,
    refreshUsdcBalance,
  } = useWeb3();
  const { ugfExecute, isUGFEnabled } = useUGF();
  const { toast } = useToast();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [paying, setPaying] = useState(false);
  const [receipts, setReceipts] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const factory = getReadFactory();
        const count = Number(await factory.getPropertiesCount());
        const list = [];
        for (let i = 0; i < count; i++) {
          const p = await factory.properties(i);
          list.push({
            id: i,
            name: p.name,
            location: p.location,
            owner: p.owner,
            valueInr: p.valueInr,
          });
        }
        if (!alive) return;
        setProperties(list);
        if (list[0]) setSelectedId((prev) => prev || String(list[0].id));
      } catch (err) {
        if (alive) toast.error("Could not load properties", { msg: "Check the network and try again." });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [getReadFactory]);

  const selected = useMemo(
    () => properties.find((p) => String(p.id) === String(selectedId)) || null,
    [properties, selectedId]
  );

  function validateAmount() {
    const raw = String(amount || "").trim();
    if (!raw) return "Enter a rent amount.";
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) return "Use up to 2 decimal places.";
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return "Amount must be greater than zero.";
    if (n > 1_000_000) return "Amount is too large for the demo flow.";
    return "";
  }

  async function handlePayRent(e) {
    e.preventDefault();
    if (!selected) return;
    if (!account) {
      await connect();
      return;
    }

    const validation = validateAmount();
    if (validation) {
      toast.error("Check amount", { msg: validation });
      return;
    }

    const usdcRaw = BigInt(Math.floor(Number(amount) * 1e6));
    setPaying(true);
    try {
      const receipt = await ugfExecute(
        CONTRACT_ADDRESSES.mockUsdc,
        MOCK_USDC_ABI,
        "transfer",
        [selected.owner, usdcRaw]
      );
      const txHash = receipt?.hash || receipt?.transactionHash || null;
      const paid = Number(amount);

      setReceipts((prev) => [{
        txHash,
        property: selected.name,
        amount: paid,
        memo,
        when: new Date().toISOString(),
      }, ...prev].slice(0, 6));

      fetch(`${BACKEND_URL}/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash,
          type: "deposit",
          from: account,
          propertyId: selected.id,
          amount: paid,
          gasMethod: isUGFEnabled ? "ugf" : "eth",
        }),
      }).catch(() => { /* backend may be offline */ });

      toast.success("Rent paid", { msg: `${paid.toFixed(2)} USDC sent to ${selected.name}.` });
      setAmount("");
      setMemo("");
      await refreshUsdcBalance();
    } catch (err) {
      toast.error("Payment failed", { msg: (err?.reason || err?.message || "Transaction failed").slice(0, 180) });
    } finally {
      setPaying(false);
    }
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === "owner") return <Navigate to="/owner" replace />;

  return (
    <div className="container reveal">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Rent payer <span className="accent">dashboard</span></h1>
            <p>Pay rent in USDC and keep every receipt tied to your wallet activity.</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <span className="role-badge is-investor"><Icon name="receipt" size={12} /> Rent payer</span>
            <span className="badge badge-muted">{user?.email}</span>
          </div>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: 32 }}>
        <TenantKpi icon="building" label="Available properties" value={loading ? "..." : String(properties.length)} />
        <TenantKpi icon="wallet" label="Wallet" value={account ? fmtAddr(account) : "Not connected"} />
        <TenantKpi icon="coins" label="Gas mode" value={isUGFEnabled ? "Mock USD" : "ETH"} tone="gold" />
      </div>

      <div className="layout-two-col">
        <div>
          <form className="card card-elevated tenant-pay-card" onSubmit={handlePayRent}>
            <div className="card-body">
              <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 18 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 700 }}>Pay rent</h2>
                  <p className="text-muted" style={{ marginTop: 4 }}>
                    Select a property and transfer MockUSDC to the owner wallet.
                  </p>
                </div>
                <UGFBadge />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Property</label>
                <select
                  className="form-input"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  disabled={loading || properties.length === 0}
                >
                  {loading && <option>Loading properties...</option>}
                  {!loading && properties.length === 0 && <option>No properties found</option>}
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.id} - {p.name} - {p.location}
                    </option>
                  ))}
                </select>
              </div>

              {selected && (
                <div className="tenant-property-strip">
                  <div>
                    <span className="text-xs text-muted">Owner wallet</span>
                    <strong className="font-mono">{fmtAddr(selected.owner)}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-muted">Valuation</span>
                    <strong>{fmtInr(selected.valueInr)}</strong>
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Amount (USDC)</label>
                <div className="form-input-prefix">
                  <span className="prefix">$</span>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="750.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Memo</label>
                <input
                  className="form-input"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="May rent, unit 1204"
                  maxLength={80}
                />
              </div>

              <button
                className="btn btn-primary btn-lg btn-full"
                type="submit"
                disabled={paying || loading || !selected}
                style={{ marginTop: 20 }}
              >
                {paying
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Paying rent</>
                  : account
                    ? <><Icon name="send" size={14} /> Pay rent</>
                    : <><Icon name="wallet" size={14} /> Connect wallet to pay</>}
              </button>
            </div>
          </form>
        </div>

        <aside className="tenant-side">
          <div className="card">
            <div className="card-body">
              <h3 className="tenant-side-title"><Icon name="shield" size={14} /> Account security</h3>
              <p className="text-sm text-muted">
                Email/password signs you into the app. The wallet still signs
                on-chain rent payments, so reloads restore both sessions safely.
              </p>
              {!account && (
                <button className="btn btn-secondary btn-sm btn-full" onClick={connect} disabled={connecting} style={{ marginTop: 16 }}>
                  {connecting ? "Connecting..." : "Connect wallet"}
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h3 className="tenant-side-title"><Icon name="receipt" size={14} /> Recent receipts</h3>
              {receipts.length === 0 ? (
                <p className="text-sm text-muted">Receipts from this browser session appear here after payment.</p>
              ) : (
                <div className="tenant-receipts">
                  {receipts.map((r) => (
                    <div key={`${r.txHash}-${r.when}`} className="tenant-receipt-row">
                      <strong>{r.property}</strong>
                      <span>{r.amount.toFixed(2)} USDC</span>
                      {r.memo && <small>{r.memo}</small>}
                    </div>
                  ))}
                </div>
              )}
              <Link to="/activity" className="btn btn-ghost btn-sm btn-full" style={{ marginTop: 14 }}>
                View activity <Icon name="arrowRight" size={11} />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TenantKpi({ icon, label, value, tone = "accent" }) {
  return (
    <div className="stat-card">
      <div className="stat-label"><Icon name={icon} size={12} /> {label}</div>
      <div className={`stat-value ${tone}`} style={{ fontSize: String(value).length > 18 ? 18 : undefined }}>
        {value}
      </div>
    </div>
  );
}
