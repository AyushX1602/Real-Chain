import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { MARKETPLACE_ABI, PROPERTY_TOKEN_ABI, RENTAL_DISTRIBUTION_ABI } from "../config/contracts";

export default function Property() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    signer, account, connect,
    getReadFactory, getReadPropertyContracts,
    getFactory, getPropertyContracts, getUsdc,
    fmtUsdc, fmtProp, fmtAddr, fmtInr,
    refreshUsdcBalance,
  } = useWeb3();

  const [prop, setProp]               = useState(null);
  const [pricePerToken, setPricePerToken] = useState(0n);
  const [ownerBalance, setOwnerBalance]   = useState(0n);
  const [myBalance, setMyBalance]         = useState(0n);
  const [listings, setListings]           = useState([]);
  const [buyAmount, setBuyAmount]         = useState("");
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState(null);
  const [txStatus, setTxStatus]           = useState(null);
  const [txMsg, setTxMsg]                 = useState("");

  // Load read-only data (no wallet needed)
  useEffect(() => { loadReadOnly(); }, [id]);
  // Load wallet-specific data (my balance) when account changes
  useEffect(() => { if (account && prop) loadMyBalance(); }, [account, prop]);

  async function loadReadOnly() {
    setLoading(true);
    setLoadError(null);
    try {
      const factory = getReadFactory();
      const p = await factory.properties(Number(id));
      setProp(p);

      const { token, market } = getReadPropertyContracts({
        propertyToken: p.propertyToken,
        rentalDistribution: p.rentalDistribution,
        marketplace: p.marketplace,
      });

      const [price, ownerBal] = await Promise.all([
        market.pricePerToken(),
        token.balanceOf(p.owner),
      ]);
      setPricePerToken(price);
      setOwnerBalance(ownerBal);

      // Load secondary listings
      const count = await market.getListingCount();
      const ls = [];
      for (let i = 0; i < Number(count); i++) {
        const [seller, amount, price_, active] = await market.getListing(i);
        if (active) ls.push({ id: i, seller, amount, price: price_ });
      }
      setListings(ls);
    } catch (e) {
      console.error(e);
      setLoadError("Failed to load property. Is the Hardhat node running?");
    } finally {
      setLoading(false);
    }
  }

  async function loadMyBalance() {
    try {
      const { token } = getReadPropertyContracts({
        propertyToken: prop.propertyToken,
        rentalDistribution: prop.rentalDistribution,
        marketplace: prop.marketplace,
      });
      const bal = await token.balanceOf(account);
      setMyBalance(bal);
    } catch (_) {}
  }

  async function handleBuyFromOwner() {
    if (!account) { connect(); return; }
    if (!buyAmount || Number(buyAmount) <= 0) return;
    const amount = BigInt(buyAmount);
    const cost   = amount * pricePerToken;
    setTxStatus("pending"); setTxMsg("Approving USDC…");
    try {
      const usdc = getUsdc();
      await (await usdc.approve(prop.marketplace, cost)).wait();
      setTxMsg("Buying tokens…");
      const { market } = getPropertyContracts({
        propertyToken: prop.propertyToken,
        rentalDistribution: prop.rentalDistribution,
        marketplace: prop.marketplace,
      });
      // Owner must have approved marketplace — prompt if needed
      const { token } = getPropertyContracts({
        propertyToken: prop.propertyToken,
        rentalDistribution: prop.rentalDistribution,
        marketplace: prop.marketplace,
      });
      const ownerAllowance = await token.allowance(prop.owner, prop.marketplace);
      if (ownerAllowance < amount * BigInt(1e18)) {
        setTxMsg("Owner must approve marketplace. Approving…");
        await (await token.approve(prop.marketplace, ethers.MaxUint256)).wait();
      }
      await (await market.buyFromOwner(amount)).wait();
      setTxStatus("success"); setTxMsg(`Bought ${buyAmount} PROP!`);
      setBuyAmount("");
      await loadReadOnly();
      await loadMyBalance();
      refreshUsdcBalance();
    } catch (e) {
      setTxStatus("error");
      setTxMsg(e.reason || e.message || "Transaction failed");
    }
  }

  async function handleBuyFromListing(listing) {
    if (!account) { connect(); return; }
    const cost = (listing.amount * listing.price) / BigInt(1e18);
    setTxStatus("pending"); setTxMsg("Approving USDC…");
    try {
      const usdc = getUsdc();
      await (await usdc.approve(prop.marketplace, cost)).wait();
      const { market } = getPropertyContracts({
        propertyToken: prop.propertyToken,
        rentalDistribution: prop.rentalDistribution,
        marketplace: prop.marketplace,
      });
      setTxMsg("Buying from listing…");
      await (await market.buyFromListing(listing.id)).wait();
      setTxStatus("success"); setTxMsg("Purchase complete!");
      await loadReadOnly();
      await loadMyBalance();
      refreshUsdcBalance();
    } catch (e) {
      setTxStatus("error");
      setTxMsg(e.reason || e.message || "Transaction failed");
    }
  }

  if (loading) return (
    <div className="container">
      <div className="empty-state" style={{ marginTop: 80 }}>
        <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 16px" }} />
        <p>Loading property data…</p>
      </div>
    </div>
  );

  if (loadError) return (
    <div className="container">
      <div className="empty-state" style={{ marginTop: 80 }}>
        <div className="icon">❌</div>
        <h3>Failed to load property</h3>
        <p>{loadError}</p>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate("/")}>← Back</button>
      </div>
    </div>
  );

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <button className="btn btn-secondary btn-sm" style={{ marginTop: 24, marginBottom: 24 }} onClick={() => navigate("/")}>
        ← Back to Properties
      </button>

      {/* Property Header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{prop?.name}</h1>
              <p className="text-muted">📍 {prop?.location}</p>
            </div>
            <span className="property-badge">● Live</span>
          </div>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">Valuation</div>
              <div className="stat-value gold" style={{ fontSize: 20 }}>{fmtInr(prop?.valueInr || 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Price / Token</div>
              <div className="stat-value accent" style={{ fontSize: 20 }}>{fmtUsdc(pricePerToken)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Owner Supply Left</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{fmtProp(ownerBalance)} PROP</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">My Balance</div>
              <div className="stat-value success" style={{ fontSize: 20 }}>
                {account ? `${fmtProp(myBalance)} PROP` : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet connect prompt (inline — doesn't block the page) */}
      {!account && (
        <div className="banner banner-info" style={{ marginBottom: 24 }}>
          <span>🔌</span>
          <span>
            Connect MetaMask to buy tokens.{" "}
            <button onClick={connect} style={{ background: "none", border: "none", color: "inherit", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
              Connect now →
            </button>
          </span>
        </div>
      )}

      {/* Tx Status Banner */}
      {txStatus && (
        <div className={`banner banner-${txStatus === "success" ? "success" : txStatus === "pending" ? "info" : "danger"}`} style={{ marginBottom: 24 }}>
          {txStatus === "pending" && <div className="spinner" style={{ width: 16, height: 16, flexShrink: 0 }} />}
          <span>{txMsg}</span>
          {txStatus !== "pending" && (
            <button onClick={() => setTxStatus(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>✕</button>
          )}
        </div>
      )}

      {/* Primary Market */}
      <div className="section">
        <h2 className="section-title">Primary Market — Buy From Owner</h2>
        <div className="card">
          <div className="card-body">
            <p className="text-muted" style={{ marginBottom: 20, fontSize: 14 }}>
              Buy directly from the property owner at the fixed price. Tokens represent fractional ownership and entitle you to rental dividends.
            </p>
            <div className="flex gap-12 items-center" style={{ flexWrap: "wrap" }}>
              <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                <label className="form-label">Tokens to buy</label>
                <input
                  className="form-input"
                  type="number" min="1"
                  placeholder="e.g. 5"
                  value={buyAmount}
                  onChange={e => setBuyAmount(e.target.value)}
                />
              </div>
              <div style={{ paddingTop: 24 }}>
                <div className="text-muted text-sm" style={{ marginBottom: 8 }}>Total cost</div>
                <div style={{ fontWeight: 700, fontSize: 20, color: "var(--gold)" }}>
                  {buyAmount ? fmtUsdc(BigInt(Math.floor(Number(buyAmount))) * pricePerToken) : "$0.00"}
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 20 }}
              onClick={handleBuyFromOwner}
              disabled={txStatus === "pending"}
            >
              {!account ? "Connect Wallet to Buy" : txStatus === "pending" ? "Processing…" : "Buy Tokens"}
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Market */}
      <div className="section">
        <h2 className="section-title">Secondary Market — Peer-to-Peer Listings</h2>
        {listings.length === 0 ? (
          <div className="card">
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="icon" style={{ fontSize: 32 }}>📋</div>
              <h3>No active listings</h3>
              <p>Go to <strong>Portfolio</strong> to list your tokens for sale.</p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Seller</th><th>Amount</th><th>Price / Token</th><th>Total</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {listings.map(l => {
                    const total = (l.amount * l.price) / BigInt(1e18);
                    return (
                      <tr key={l.id}>
                        <td className="font-mono text-sm">{fmtAddr(l.seller)}</td>
                        <td><span className="badge badge-accent">{fmtProp(l.amount)} PROP</span></td>
                        <td>{fmtUsdc(l.price)}</td>
                        <td style={{ fontWeight: 700, color: "var(--gold)" }}>{fmtUsdc(total)}</td>
                        <td>
                          <button className="btn btn-success btn-sm" onClick={() => handleBuyFromListing(l)} disabled={txStatus === "pending"}>
                            {account ? "Buy" : "Connect"}
                          </button>
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
