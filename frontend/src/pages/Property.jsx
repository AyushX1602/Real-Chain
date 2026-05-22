import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { useUGF } from "../context/UGFContext";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import UGFBadge from "../components/UGFBadge";
import CostBanner from "../components/CostBanner";
import ROICalculator from "../components/ROICalculator";
import RentChart from "../components/RentChart";
import HolderList from "../components/HolderList";
import useWatchlist from "../hooks/useWatchlist";
import { CONTRACT_ADDRESSES, MARKETPLACE_ABI, PROPERTY_TOKEN_ABI } from "../config/contracts";
import { propertyImage } from "../utils/propertyImage";

// ─────────────────────────────────────────────────────────────────────────────
// Property — primary + secondary market for a single property.
// All state-changing calls route through ugfExecute so gas is paid in Mock USD.
// ─────────────────────────────────────────────────────────────────────────────

export default function Property() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    account, connect,
    getReadFactory, getReadPropertyContracts,
    getPropertyContracts,
    fmtUsdc, fmtProp, fmtAddr, fmtInr, refreshUsdcBalance,
  } = useWeb3();
  const { ugfExecute, ugfApprove, isUGFEnabled, logTx } = useUGF();
  const { toast } = useToast();

  const [prop, setProp] = useState(null);
  const [pricePerToken, setPricePerToken] = useState(0n);
  const [totalSupply, setTotalSupply] = useState(0n);
  const [ownerBalance, setOwnerBalance] = useState(0n);
  const [myBalance, setMyBalance] = useState(0n);
  const [listings, setListings] = useState([]);
  const [epochs, setEpochs] = useState([]);
  const [buyAmount, setBuyAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(null); // null | "primary" | "listing-N"
  const [lastReceipt, setLastReceipt] = useState(null); // { txHash, tokens, cost, gasMethod, time }
  const [tab, setTab] = useState("overview"); // overview | rent | holders | calculator
  const watch = useWatchlist();

  useEffect(() => { loadReadOnly(); }, [id]);
  useEffect(() => { if (account && prop) loadMyBalance(); }, [account, prop]);

  async function loadReadOnly() {
    setLoading(true); setLoadError(null);
    try {
      const factory = getReadFactory();
      const p = await factory.properties(Number(id));
      setProp(p);

      const { token, market, rental } = getReadPropertyContracts({
        propertyToken: p.propertyToken,
        rentalDistribution: p.rentalDistribution,
        marketplace: p.marketplace,
      });

      const [price, ownerBal, count, supply, epochCount] = await Promise.all([
        market.pricePerToken(),
        token.balanceOf(p.owner),
        market.getListingCount(),
        token.totalSupply(),
        rental.epochCount(),
      ]);
      setPricePerToken(price);
      setOwnerBalance(ownerBal);
      setTotalSupply(supply);

      // Default the buy input to 1 token once a non-zero listing price is
      // known. Only fills it in when the user hasn't already typed a value;
      // re-pulling the page (e.g. after a tx) shouldn't clobber pending edits.
      if (price > 0n) {
        setBuyAmount((prev) => (prev && prev.trim() !== "" ? prev : "1"));
      }

      // Listings
      const ls = [];
      for (let i = 0; i < Number(count); i++) {
        const [seller, amount, price_, active] = await market.getListing(i);
        if (active) ls.push({ id: i, seller, amount, price: price_ });
      }
      setListings(ls);

      // Epoch history for the rent chart.
      const eps = [];
      for (let j = 0; j < Number(epochCount); j++) {
        const [total, , ts] = await rental.getEpoch(j);
        eps.push({ id: j, total, ts: Number(ts) });
      }
      setEpochs(eps);
    } catch (e) {
      console.error(e);
      setLoadError("Failed to load property. Check the network and try again.");
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
    const amount = BigInt(Math.floor(Number(buyAmount)));
    const cost = amount * pricePerToken;
    setBusy("primary");
    try {
      toast.info("Approving USDC", { msg: "UGF will settle approval gas in Mock USD." });
      await ugfApprove(CONTRACT_ADDRESSES.mockUsdc, prop.marketplace, cost);

      // Owner needs to have approved marketplace for the supply transfer.
      const { token } = getPropertyContracts({
        propertyToken: prop.propertyToken,
        rentalDistribution: prop.rentalDistribution,
        marketplace: prop.marketplace,
      });
      const ownerAllowance = await token.allowance(prop.owner, prop.marketplace);
      if (ownerAllowance < amount * BigInt(1e18)) {
        throw new Error("Owner has not approved primary supply. Run seedDemo or approve from the owner wallet before selling.");
      }

      const receipt = await ugfExecute(prop.marketplace, MARKETPLACE_ABI, "buyFromOwner", [amount]);
      const txHash = receipt?.hash || receipt?.transactionHash || null;
      const gasMethod = isUGFEnabled ? "ugf" : "eth";

      logTx({
        txHash, type: "buy",
        propertyId: Number(id),
        amount: Number(cost) / 1e6,
        tokenAmount: Number(amount),
        gasMethod,
      });

      // Show inline receipt
      setLastReceipt({
        txHash,
        tokens: Number(amount),
        cost: Number(cost) / 1e6,
        gasMethod,
        propertyName: prop?.name || "Property",
        time: new Date().toLocaleTimeString(),
      });
      // Auto-dismiss after 15s
      setTimeout(() => setLastReceipt(null), 15000);

      toast.success("Tokens purchased", { msg: `+${buyAmount} PROP at ${fmtUsdc(pricePerToken)} each.` });
      setBuyAmount("");
      await loadReadOnly();
      await loadMyBalance();
      refreshUsdcBalance();
    } catch (e) {
      const msg = e?.reason || e?.message || "Transaction failed";
      toast.error("Buy failed", { msg: msg.slice(0, 180) });
    } finally {
      setBusy(null);
    }
  }

  async function handleBuyFromListing(listing) {
    if (!account) { connect(); return; }
    const cost = (listing.amount * listing.price) / BigInt(1e18);
    setBusy(`listing-${listing.id}`);
    try {
      toast.info("Approving USDC", { msg: "UGF will settle approval gas in Mock USD." });
      await ugfApprove(CONTRACT_ADDRESSES.mockUsdc, prop.marketplace, cost);

      const receipt = await ugfExecute(prop.marketplace, MARKETPLACE_ABI, "buyFromListing", [listing.id]);
      const txHash = receipt?.hash || receipt?.transactionHash || null;

      const gasMethod = isUGFEnabled ? "ugf" : "eth";

      logTx({
        txHash, type: "buy",
        propertyId: Number(id),
        amount: Number(cost) / 1e6,
        tokenAmount: Number(ethers.formatEther(listing.amount)),
        gasMethod,
      });

      setLastReceipt({
        txHash,
        tokens: Number(ethers.formatEther(listing.amount)),
        cost: Number(cost) / 1e6,
        gasMethod,
        propertyName: prop?.name || "Property",
        time: new Date().toLocaleTimeString(),
      });
      setTimeout(() => setLastReceipt(null), 15000);

      toast.success("Listing purchased", { msg: `${fmtProp(listing.amount)} PROP from ${fmtAddr(listing.seller)}.` });
      await loadReadOnly();
      await loadMyBalance();
      refreshUsdcBalance();
    } catch (e) {
      const msg = e?.reason || e?.message || "Transaction failed";
      toast.error("Purchase failed", { msg: msg.slice(0, 180) });
    } finally {
      setBusy(null);
    }
  }  async function handleCancelListing(listing) {
    if (!account) { connect(); return; }
    setBusy(`listing-${listing.id}`);
    try {
      const receipt = await ugfExecute(prop.marketplace, MARKETPLACE_ABI, "cancelListing", [listing.id]);
      const txHash = receipt?.hash || receipt?.transactionHash || null;
      logTx({
        txHash, type: "cancel",
        propertyId: Number(id),
        amount: 0,
        gasMethod: isUGFEnabled ? "ugf" : "eth",
      });
      toast.success("Listing cancelled");
      await loadReadOnly();
    } catch (e) {
      const msg = e?.reason || e?.message || "Transaction failed";
      toast.error("Cancel failed", { msg: msg.slice(0, 180) });
    } finally {
      setBusy(null);
    }
  }

  // Create listing state
  const [showListForm, setShowListForm] = useState(false);
  const [listAmount, setListAmount] = useState("");
  const [listPrice, setListPrice] = useState("");

  async function handleCreateListing() {
    if (!account) { connect(); return; }
    if (!listAmount || !listPrice) return;
    const amount = BigInt(Math.floor(Number(listAmount)));
    const priceVal = BigInt(Math.floor(parseFloat(listPrice) * 1e6));
    setBusy("create-listing");
    try {
      toast.info("Approving PROP tokens", { msg: "UGF will settle approval gas in Mock USD." });
      await ugfApprove(prop.propertyToken, prop.marketplace, amount * BigInt(1e18));

      const receipt = await ugfExecute(prop.marketplace, MARKETPLACE_ABI, "createListing", [amount, priceVal]);
      const txHash = receipt?.hash || receipt?.transactionHash || null;
      logTx({
        txHash, type: "listing",
        propertyId: Number(id),
        amount: parseFloat(listAmount) * parseFloat(listPrice),
        tokenAmount: Number(amount),
        gasMethod: isUGFEnabled ? "ugf" : "eth",
      });

      toast.success("Listing live", { msg: `${listAmount} PROP @ $${listPrice} each.` });
      setListAmount(""); setListPrice(""); setShowListForm(false);
      await loadReadOnly();
      await loadMyBalance();
    } catch (e) {
      const msg = e?.reason || e?.message || "Transaction failed";
      toast.error("Listing failed", { msg: msg.slice(0, 180) });
    } finally {
      setBusy(null);
    }
  }


  if (loading) {
    return (
      <div className="container reveal">
        <div className="skeleton" style={{ height: 220, marginTop: 24, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container">
        <div className="empty-state">
          <span className="emoji"><Icon name="alert" size={28} /></span>
          <h3>Failed to load property</h3>
          <p>{loadError}</p>
          <button className="btn btn-secondary mt-6" onClick={() => navigate("/")}>
            <Icon name="arrowRight" size={13} style={{ transform: "rotate(180deg)" }} /> Back to marketplace
          </button>
        </div>
      </div>
    );
  }

  const buyTotal = buyAmount && pricePerToken
    ? BigInt(Math.floor(Number(buyAmount))) * pricePerToken
    : 0n;

  // Whole-token cap available from the owner's primary stock. ownerBalance is
  // raw 18-decimal PROP; the input deals in whole tokens.
  const availableSupply = ownerBalance > 0n ? Math.floor(Number(ownerBalance) / 1e18) : 0;
  const buyAmountNum = Number(buyAmount || 0);
  const exceedsSupply = buyAmountNum > availableSupply;
  const buyAmountInvalid = !buyAmount || buyAmountNum <= 0 || exceedsSupply;

  return (
    <div className="container-narrow reveal">
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 18 }} onClick={() => navigate("/")}>
        <Icon name="arrowRight" size={12} style={{ transform: "rotate(180deg)" }} /> Marketplace
      </button>

      {/* Hero */}
      <div className="card card-elevated" style={{ marginBottom: 24, overflow: "hidden" }}>
        {prop && (
          <div
            className="property-hero-cover"
            style={{ backgroundImage: `url(${propertyImage(prop, { w: 1600, h: 600 })})` }}
            aria-hidden="true"
          >
            <div className="property-hero-scrim" />
          </div>
        )}
        <div className="card-body">
          <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>{prop?.name}</h1>
              <div className="text-muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="pin" size={14} /> {prop?.location}
              </div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <button
                type="button"
                className={`star-btn ${watch.has(Number(id)) ? "is-on" : ""}`}
                onClick={() => watch.toggle(Number(id))}
                aria-label={watch.has(Number(id)) ? "Remove from watchlist" : "Add to watchlist"}
                aria-pressed={watch.has(Number(id))}
              >
                <Icon name="star" size={14} />
              </button>
              <span className="badge badge-success"><span className="status-dot" /> Live</span>
              <span className="badge badge-accent"><Icon name="layers" size={11} /> ERC-20</span>
              <span className="badge badge-muted font-mono">#{prop?.propertyToken?.slice(2, 6) || "—"}</span>
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label"><Icon name="coins" size={11} /> Valuation</div>
              <div className="stat-value gold" style={{ fontSize: 20 }}>{fmtInr(prop?.valueInr || 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><Icon name="dollar" size={11} /> Price / token</div>
              <div className="stat-value accent" style={{ fontSize: 20 }}>{fmtUsdc(pricePerToken)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><Icon name="layers" size={11} /> Owner supply</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{fmtProp(ownerBalance)}</div>
              <div className="stat-meta">PROP available</div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><Icon name="briefcase" size={11} /> My balance</div>
              <div className="stat-value success" style={{ fontSize: 20 }}>
                {account ? fmtProp(myBalance) : "—"}
              </div>
              <div className="stat-meta">{account ? "PROP held" : "connect to view"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="lp-feature-tabs" role="tablist" aria-label="Property views" style={{ marginBottom: 18 }}>
        {[
          { k: "overview",   label: "Overview" },
          { k: "rent",       label: "Rent history" },
          { k: "holders",    label: "Holders" },
          { k: "calculator", label: "Calculator" },
        ].map((t) => (
          <button
            key={t.k}
            role="tab"
            aria-selected={tab === t.k}
            className={`lp-feature-tab ${tab === t.k ? "is-active" : ""}`}
            onClick={() => setTab(t.k)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {/* Primary market */}
          <div className="section">
            <h2 className="section-title"><Icon name="send" size={14} /> Primary market — buy from owner</h2>
            <div className="card">
              <div className="card-body">
                <p className="text-sm text-secondary" style={{ marginBottom: 18 }}>
                  Buy directly from the property owner at the fixed listing price. Tokens entitle you to a pro-rata share of all future rent deposits.
                </p>

                <div className="flex gap-3 items-end flex-wrap">
                  <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                    <label className="form-label">Number of tokens</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      step="1"
                      max={availableSupply || undefined}
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      aria-invalid={exceedsSupply || undefined}
                      aria-describedby="buy-helper"
                    />
                    <div
                      id="buy-helper"
                      className="text-xs text-muted"
                      style={{ marginTop: 6 }}
                    >
                      Price per token: <strong style={{ color: "var(--text-primary, var(--positivus-black))", fontFeatureSettings: "'tnum' on" }}>
                        {fmtUsdc(pricePerToken)}
                      </strong>
                      <span style={{ opacity: 0.55 }}> · {availableSupply.toLocaleString()} available</span>
                    </div>
                    {exceedsSupply && (
                      <div className="text-xs" style={{ marginTop: 6, color: "var(--red-500, #DC2626)", fontWeight: 600 }}>
                        Exceeds available supply
                      </div>
                    )}
                  </div>
                  <div style={{ minWidth: 160 }}>
                    <div className="form-label" style={{ marginBottom: 4 }}>Total cost</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: "var(--text-primary, var(--positivus-black))", lineHeight: 1.2, fontFeatureSettings: "'tnum' on" }}>
                      {buyAmount && Number(buyAmount) > 0 ? fmtUsdc(buyTotal) : "$0.00"}
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-lg btn-full"
                  style={{ marginTop: 18 }}
                  onClick={handleBuyFromOwner}
                  disabled={busy === "primary" || !account || buyAmountInvalid}
                >
                  {!account
                    ? <><Icon name="wallet" size={14} /> Connect wallet to buy</>
                    : busy === "primary"
                      ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Processing…</>
                      : <><Icon name="bolt" size={14} /> Buy {buyAmount || "1"} PROP</>}
                </button>

                {/* Success receipt */}
                {lastReceipt && (
                  <div style={{
                    marginTop: 16, padding: "18px 20px", borderRadius: "var(--radius-md, 12px)",
                    background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
                    border: "2px solid #10b981",
                    animation: "fadeIn 0.3s ease-out",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{
                        width: 32, height: 32, borderRadius: "50%", background: "#10b981",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 18, fontWeight: 800,
                      }}>✓</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: "#065f46" }}>Purchase successful!</div>
                        <div style={{ fontSize: 12, color: "#047857" }}>{lastReceipt.time}</div>
                      </div>
                      <button onClick={() => setLastReceipt(null)} style={{
                        marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
                        color: "#065f46", fontSize: 18, padding: 4,
                      }}>×</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, color: "#065f46" }}>
                      <div><span style={{ opacity: 0.7 }}>Tokens:</span> <strong>{lastReceipt.tokens} PROP</strong></div>
                      <div><span style={{ opacity: 0.7 }}>Cost:</span> <strong>${lastReceipt.cost.toFixed(2)} USDC</strong></div>
                      <div><span style={{ opacity: 0.7 }}>Gas:</span> <strong>{lastReceipt.gasMethod === "ugf" ? "Mock USD (UGF)" : "ETH"}</strong></div>
                      <div><span style={{ opacity: 0.7 }}>Property:</span> <strong>{lastReceipt.propertyName}</strong></div>
                    </div>
                    {lastReceipt.txHash && (
                      <div style={{ marginTop: 10, fontSize: 11, color: "#047857", wordBreak: "break-all" }}>
                        Tx: {lastReceipt.txHash.slice(0, 10)}...{lastReceipt.txHash.slice(-8)}
                      </div>
                    )}
                    <Link to="/investor" className="btn btn-primary btn-sm" style={{ marginTop: 12, display: "inline-flex" }}>
                      <Icon name="users" size={12} /> Go to Investor Dashboard →
                    </Link>
                  </div>
                )}

                {account && buyAmount && !lastReceipt && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <UGFBadge />
                    <CostBanner
                      target={prop.marketplace}
                      abi={MARKETPLACE_ABI}
                      fnName="buyFromOwner"
                      args={[BigInt(Math.floor(Number(buyAmount || "0")))]}
                      estimate={140_000n}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Secondary market */}
          <div className="section">
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <h2 className="section-title" style={{ margin: 0 }}><Icon name="users" size={14} /> Secondary market</h2>
              {account && myBalance > 0n && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowListForm((v) => !v)}
                >
                  <Icon name={showListForm ? "close" : "send"} size={12} />
                  {showListForm ? "Cancel" : "List my tokens for sale"}
                </button>
              )}
            </div>

            {/* Create listing form */}
            {showListForm && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body">
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="send" size={14} className="text-accent" />
                    Create sell listing
                  </h3>
                  <p className="text-xs text-muted" style={{ marginBottom: 14, lineHeight: 1.5 }}>
                    List your PROP tokens for other investors to buy. You set the price per token. When someone fills the listing, USDC goes directly to your wallet.
                  </p>
                  <div className="flex gap-3 items-end flex-wrap">
                    <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                      <label className="form-label">Tokens to sell</label>
                      <input className="form-input" type="number" min="1" max={Math.floor(Number(myBalance) / 1e18)} placeholder="5"
                        value={listAmount} onChange={(e) => setListAmount(e.target.value)} />
                      <div className="text-xs text-muted" style={{ marginTop: 4 }}>You hold {fmtProp(myBalance)} PROP</div>
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                      <label className="form-label">Price / token (USDC)</label>
                      <div className="form-input-prefix">
                        <span className="prefix">$</span>
                        <input className="form-input" type="number" min="0.01" step="0.01" placeholder="12.00"
                          value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
                      </div>
                    </div>
                    <div style={{ minWidth: 120 }}>
                      <div className="form-label" style={{ marginBottom: 4 }}>Total ask</div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: "var(--positivus-black)" }}>
                        ${listAmount && listPrice ? (Number(listAmount) * Number(listPrice)).toFixed(2) : "0.00"}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-full"
                    style={{ marginTop: 14 }}
                    onClick={handleCreateListing}
                    disabled={!listAmount || !listPrice || busy === "create-listing"}
                  >
                    {busy === "create-listing"
                      ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Creating listing…</>
                      : <><Icon name="bolt" size={13} /> List {listAmount || "0"} PROP for sale</>}
                  </button>
                  <div style={{ marginTop: 10 }}><UGFBadge /></div>
                </div>
              </div>
            )}

            {/* Existing listings table */}
            {listings.length === 0 ? (
              <div className="card">
                <div className="empty-state" style={{ padding: 40 }}>
                  <span className="emoji" style={{ width: 56, height: 56 }}><Icon name="list" size={20} /></span>
                  <h3>No active listings</h3>
                  <p>{account && myBalance > 0n ? "Be the first to list! Click the button above." : "No investors have listed tokens for resale yet."}</p>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Seller</th>
                        <th>Amount</th>
                        <th>Price / token</th>
                        <th>Total</th>
                        <th aria-label="Action" />
                      </tr>
                    </thead>
                    <tbody>
                      {listings.map((l) => {
                        const total = (l.amount * l.price) / BigInt(1e18);
                        const isMine = account && l.seller.toLowerCase() === account.toLowerCase();
                        const lid = `listing-${l.id}`;
                        return (
                          <tr key={l.id}>
                            <td className="font-mono text-sm">
                              {fmtAddr(l.seller)}
                              {isMine && <span className="badge badge-accent" style={{ marginLeft: 6 }}>You</span>}
                            </td>
                            <td><span className="badge badge-accent">{fmtProp(l.amount)} PROP</span></td>
                            <td>{fmtUsdc(l.price)}</td>
                            <td className="font-bold">{fmtUsdc(total)}</td>
                            <td>
                              {isMine ? (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleCancelListing(l)}
                                  disabled={busy === lid}
                                >
                                  {busy === lid ? <span className="spinner" style={{ width: 11, height: 11, borderWidth: 1.5 }} /> : <><Icon name="close" size={11} /> Cancel</>}
                                </button>
                              ) : (
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleBuyFromListing(l)}
                                  disabled={busy === lid}
                                >
                                  {busy === lid ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> : <><Icon name="bolt" size={11} /> Buy</>}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-soft)" }}>
                  <UGFBadge />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "rent" && (
        <div className="section">
          <h2 className="section-title"><Icon name="history" size={14} /> Rent per epoch</h2>
          <div className="card card-elevated">
            <div className="card-body">
              <RentChart data={epochs} />
            </div>
          </div>
        </div>
      )}

      {tab === "holders" && (
        <div className="section">
          <h2 className="section-title"><Icon name="users" size={14} /> Top holders</h2>
          <HolderList propertyId={Number(id)} tokenAddress={prop?.propertyToken} ownerAddress={prop?.owner} limit={10} />
        </div>
      )}

      {tab === "calculator" && (
        <div className="section">
          <h2 className="section-title"><Icon name="trending" size={14} /> ROI Calculator</h2>
          <ROICalculator
            pricePerToken={Number(pricePerToken) / 1e6}
            totalSupply={Number(ethers.formatEther(totalSupply))}
            avgRentPerEpoch={epochs.length > 0 ? epochs.reduce((s, e) => s + Number(e.total || 0) / 1e6, 0) / epochs.length : 0}
            epochsPerYear={12}
          />
        </div>
      )}
    </div>
  );
}
