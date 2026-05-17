import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";

export default function Portfolio() {
  const { account, connect, getReadFactory, getReadPropertyContracts, getPropertyContracts, fmtUsdc, fmtProp, fmtAddr } = useWeb3();
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const navigate = useNavigate();

  useEffect(() => { load(); }, [account]);

  async function load() {
    setLoading(true);
    try {
      const factory = getReadFactory();
      const count   = Number(await factory.getPropertiesCount());
      const h = [];
      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        const { token, market } = getReadPropertyContracts({
          propertyToken: p.propertyToken,
          rentalDistribution: p.rentalDistribution,
          marketplace: p.marketplace,
        });

        const [pricePerToken, listCount] = await Promise.all([
          market.pricePerToken(),
          market.getListingCount(),
        ]);

        // My balance — only if wallet connected
        let bal = 0n;
        if (account) {
          bal = await token.balanceOf(account);
        }

        // My active listings — only if wallet connected
        const myListings = [];
        if (account) {
          for (let j = 0; j < Number(listCount); j++) {
            const [seller, amount, price, active] = await market.getListing(j);
            if (active && seller.toLowerCase() === account.toLowerCase()) {
              myListings.push({ listingId: j, amount, price });
            }
          }
        }

        // Only show properties where I hold tokens OR if no account show all
        if (!account || bal > 0n) {
          h.push({ propId: i, prop: p, balance: bal, pricePerToken, myListings });
        }
      }
      setHoldings(h);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="container">
      <div className="empty-state" style={{ marginTop: 64 }}>
        <div className="spinner" style={{ width: 36, height: 36, margin: "0 auto 16px" }} />
        <p>Loading portfolio…</p>
      </div>
    </div>
  );

  return (
    <div className="container">
      <div className="page-header" style={{ marginTop: 32 }}>
        <h1>💼 My Portfolio</h1>
        <p>Your token holdings, active listings, and sell management.</p>
      </div>

      {!account && (
        <div className="banner banner-info" style={{ marginBottom: 24 }}>
          <span>🔌</span>
          <span>
            Connect MetaMask to see your holdings and manage listings.{" "}
            <button onClick={connect} style={{ background: "none", border: "none", color: "inherit", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
              Connect now →
            </button>
          </span>
        </div>
      )}

      {account && holdings.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📭</div>
          <h3>No holdings yet</h3>
          <p>Buy some property tokens to see them here.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate("/")}>
            Browse Properties →
          </button>
        </div>
      ) : !account ? null : (
        holdings.map((h) => (
          <HoldingCard key={h.propId} holding={h} fmtUsdc={fmtUsdc} fmtProp={fmtProp} fmtAddr={fmtAddr} onRefresh={load}
            getPropertyContracts={getPropertyContracts} />
        ))
      )}
    </div>
  );
}

function HoldingCard({ holding, fmtUsdc, fmtProp, fmtAddr, onRefresh, getPropertyContracts }) {
  const { prop, balance, pricePerToken, myListings } = holding;
  const [listAmount, setListAmount] = useState("");
  const [listPrice, setListPrice]   = useState("");
  const [txStatus, setTxStatus]     = useState(null);
  const [txMsg, setTxMsg]           = useState("");

  const pct = ((Number(ethers.formatEther(balance)) / 100) * 100).toFixed(1);

  function getRwContracts() {
    return getPropertyContracts({
      propertyToken: prop.propertyToken,
      rentalDistribution: prop.rentalDistribution,
      marketplace: prop.marketplace,
    });
  }

  async function handleCreateListing() {
    const amount   = BigInt(listAmount);
    const priceVal = BigInt(Math.floor(parseFloat(listPrice) * 1e6));
    setTxStatus("pending"); setTxMsg("Approving token transfer…");
    try {
      const { token, market } = getRwContracts();
      await (await token.approve(prop.marketplace, amount * BigInt(1e18))).wait();
      setTxMsg("Creating listing…");
      await (await market.createListing(amount, priceVal)).wait();
      setTxStatus("success"); setTxMsg("Listing created!");
      setListAmount(""); setListPrice("");
      onRefresh();
    } catch (e) {
      setTxStatus("error"); setTxMsg(e.reason || e.message || "Failed");
    }
  }

  async function handleCancelListing(listingId) {
    setTxStatus("pending"); setTxMsg("Cancelling listing…");
    try {
      const { market } = getRwContracts();
      await (await market.cancelListing(listingId)).wait();
      setTxStatus("success"); setTxMsg("Listing cancelled.");
      onRefresh();
    } catch (e) {
      setTxStatus("error"); setTxMsg(e.reason || e.message || "Failed");
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-body">
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700 }}>{prop.name}</h2>
            <p className="text-muted text-sm">📍 {prop.location}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="stat-value success" style={{ fontSize: 28 }}>{fmtProp(balance)} PROP</div>
            <div className="text-muted text-sm">{pct}% ownership</div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {txStatus && (
          <div className={`banner banner-${txStatus === "success" ? "success" : txStatus === "pending" ? "info" : "danger"}`} style={{ marginBottom: 16 }}>
            {txStatus === "pending" && <div className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />}
            <span>{txMsg}</span>
          </div>
        )}

        {/* Create Listing */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>📤 Create Sell Listing</h3>
          <div className="flex gap-12" style={{ flexWrap: "wrap" }}>
            <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
              <label className="form-label">Tokens to sell</label>
              <input className="form-input" type="number" min="1" placeholder="5"
                value={listAmount} onChange={e => setListAmount(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
              <label className="form-label">Price per token (USDC)</label>
              <input className="form-input" type="number" min="0.01" step="0.01" placeholder="12.00"
                value={listPrice} onChange={e => setListPrice(e.target.value)} />
            </div>
            <div style={{ paddingTop: 24 }}>
              <button className="btn btn-primary" onClick={handleCreateListing}
                disabled={!listAmount || !listPrice || txStatus === "pending"}>
                List for Sale
              </button>
            </div>
          </div>
        </div>

        {myListings.length > 0 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>📋 My Active Listings</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tokens</th><th>Price / Token</th><th>Total Ask</th><th>Action</th></tr></thead>
                <tbody>
                  {myListings.map(l => {
                    const total = (l.amount * l.price) / BigInt(1e18);
                    return (
                      <tr key={l.listingId}>
                        <td><span className="badge badge-accent">{fmtProp(l.amount)}</span></td>
                        <td>{fmtUsdc(l.price)}</td>
                        <td style={{ fontWeight: 700, color: "var(--gold)" }}>{fmtUsdc(total)}</td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={() => handleCancelListing(l.listingId)}>Cancel</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
