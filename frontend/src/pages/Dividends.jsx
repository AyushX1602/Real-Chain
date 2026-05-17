import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { RENTAL_DISTRIBUTION_ABI } from "../config/contracts";

export default function Dividends() {
  const { account, connect, getReadFactory, getReadPropertyContracts, getPropertyContracts, getUsdc, fmtUsdc, fmtProp, refreshUsdcBalance } = useWeb3();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { load(); }, [account]);

  async function load() {
    setLoading(true);
    try {
      const factory = getReadFactory();
      const count   = Number(await factory.getPropertiesCount());
      const ps = [];
      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        const { token, rental } = getReadPropertyContracts({
          propertyToken: p.propertyToken,
          rentalDistribution: p.rentalDistribution,
          marketplace: p.marketplace,
        });

        const epochCount = Number(await rental.epochCount());
        const epochs = [];
        for (let j = 0; j < epochCount; j++) {
          const [total, , ts] = await rental.getEpoch(j);
          let isClaimed = false;
          if (account) isClaimed = await rental.claimed(j, account);
          epochs.push({ id: j, total, ts: Number(ts), isClaimed });
        }

        let pending = 0n;
        let balance = 0n;
        if (account) {
          [pending, balance] = await Promise.all([
            rental.pendingDividends(account),
            token.balanceOf(account),
          ]);
        }

        ps.push({
          propId: i, prop: p, pending, balance,
          epochCount, epochs,
          isOwner: account && p.owner.toLowerCase() === account.toLowerCase(),
        });
      }
      setProperties(ps);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const totalPending = properties.reduce((s, p) => s + p.pending, 0n);

  if (loading) return (
    <div className="container">
      <div className="empty-state" style={{ marginTop: 64 }}>
        <div className="spinner" style={{ width: 36, height: 36, margin: "0 auto 16px" }} />
        <p>Loading dividend data…</p>
      </div>
    </div>
  );

  return (
    <div className="container">
      <div className="page-header" style={{ marginTop: 32 }}>
        <h1>💰 Dividends</h1>
        <p>Claim your proportional share of rental income. Calculated from your token balance at the time of each deposit.</p>
      </div>

      {/* Global pending */}
      <div className="card" style={{ marginBottom: 32, background: "linear-gradient(135deg, rgba(124,110,250,0.1), rgba(245,158,11,0.08))", border: "1px solid rgba(124,110,250,0.2)" }}>
        <div className="card-body" style={{ textAlign: "center", padding: 32 }}>
          <div className="stat-label" style={{ marginBottom: 8, fontSize: 14 }}>Total Pending Dividends</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: "var(--gold)", marginBottom: 4 }}>
            {account ? fmtUsdc(totalPending) : "—"}
          </div>
          <div className="text-muted text-sm">Across {properties.length} properties</div>
        </div>
      </div>

      {!account && (
        <div className="banner banner-info" style={{ marginBottom: 24 }}>
          <span>🔌</span>
          <span>
            Connect MetaMask to see your pending dividends and claim them.{" "}
            <button onClick={connect} style={{ background: "none", border: "none", color: "inherit", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
              Connect now →
            </button>
          </span>
        </div>
      )}

      {properties.map(p => (
        <PropertyDividendCard key={p.propId} data={p} fmtUsdc={fmtUsdc} fmtProp={fmtProp}
          getPropertyContracts={getPropertyContracts} getUsdc={getUsdc}
          onRefresh={load} refreshUsdcBalance={refreshUsdcBalance} account={account} />
      ))}

      {properties.length === 0 && (
        <div className="empty-state">
          <div className="icon">📭</div>
          <h3>No properties found</h3>
          <p>Deploy contracts and create properties first.</p>
        </div>
      )}
    </div>
  );
}

function PropertyDividendCard({ data, fmtUsdc, fmtProp, getPropertyContracts, getUsdc, onRefresh, refreshUsdcBalance, account }) {
  const { prop, balance, pending, epochCount, epochs, isOwner } = data;
  const [txStatus, setTxStatus]     = useState(null);
  const [txMsg, setTxMsg]           = useState("");
  const [depositAmt, setDepositAmt] = useState("");

  function getRw() {
    return getPropertyContracts({
      propertyToken: prop.propertyToken,
      rentalDistribution: prop.rentalDistribution,
      marketplace: prop.marketplace,
    });
  }

  async function handleClaimAll() {
    setTxStatus("pending"); setTxMsg("Claiming dividends…");
    try {
      const { rental } = getRw();
      await (await rental.claimAll()).wait();
      setTxStatus("success"); setTxMsg(`Claimed ${fmtUsdc(pending)} USDC!`);
      onRefresh(); refreshUsdcBalance();
    } catch (e) {
      setTxStatus("error"); setTxMsg(e.reason || e.message || "Claim failed");
    }
  }

  async function handleDeposit() {
    const amt = BigInt(Math.floor(parseFloat(depositAmt) * 1e6));
    setTxStatus("pending"); setTxMsg("Approving USDC…");
    try {
      const usdc = getUsdc();
      await (await usdc.approve(prop.rentalDistribution, amt)).wait();
      setTxMsg("Depositing rental income…");
      const { rental } = getRw();
      await (await rental.depositRental(amt)).wait();
      setTxStatus("success"); setTxMsg(`Deposited ${fmtUsdc(amt)}!`);
      setDepositAmt(""); onRefresh();
    } catch (e) {
      setTxStatus("error"); setTxMsg(e.reason || e.message || "Deposit failed");
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-body">
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>{prop.name}</h2>
            <p className="text-muted text-sm">📍 {prop.location}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)" }}>
              {account ? fmtUsdc(pending) : "—"}
            </div>
            <div className="text-sm text-muted">pending</div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">My Tokens</div>
            <div className="stat-value accent" style={{ fontSize: 20 }}>{account ? fmtProp(balance) : "—"}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Epochs</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{epochCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Claimable</div>
            <div className="stat-value success" style={{ fontSize: 20 }}>
              {account ? fmtUsdc(pending) : "—"}
            </div>
          </div>
        </div>

        {/* Tx Banner */}
        {txStatus && (
          <div className={`banner banner-${txStatus === "success" ? "success" : txStatus === "pending" ? "info" : "danger"}`} style={{ marginBottom: 16 }}>
            {txStatus === "pending" && <div className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />}
            <span>{txMsg}</span>
          </div>
        )}

        {/* Claim button */}
        {account && pending > 0n && (
          <button className="btn btn-primary btn-full" style={{ marginBottom: 20 }}
            onClick={handleClaimAll} disabled={txStatus === "pending"}>
            💰 Claim All — {fmtUsdc(pending)}
          </button>
        )}

        {/* Owner: Deposit Rental */}
        {isOwner && (
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>🏦 Deposit Rental Income (Owner Only)</h3>
            <div className="flex gap-12 items-center">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">USDC amount</label>
                <input className="form-input" type="number" min="1" step="0.01" placeholder="500.00"
                  value={depositAmt} onChange={e => setDepositAmt(e.target.value)} />
              </div>
              <div style={{ paddingTop: 24 }}>
                <button className="btn btn-secondary" onClick={handleDeposit}
                  disabled={!depositAmt || txStatus === "pending"}>Deposit</button>
              </div>
            </div>
          </div>
        )}

        {/* Epoch History */}
        {epochCount > 0 && (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📊 Epoch History</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Deposit Amount</th><th>Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {epochs.map(e => (
                    <tr key={e.id}>
                      <td className="text-muted text-sm">#{e.id}</td>
                      <td style={{ fontWeight: 600 }}>{fmtUsdc(e.total)}</td>
                      <td className="text-muted text-sm">
                        {new Date(e.ts * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td>
                        {!account ? (
                          <span className="badge badge-muted">—</span>
                        ) : balance === 0n ? (
                          <span className="badge badge-muted">No Holdings</span>
                        ) : e.isClaimed ? (
                          <span className="badge badge-success">✓ Claimed</span>
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
