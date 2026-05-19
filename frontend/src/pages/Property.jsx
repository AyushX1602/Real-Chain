import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { useUGF } from "../context/UGFContext";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import UGFBadge from "../components/UGFBadge";
import CostBanner from "../components/CostBanner";
import YieldCalculator from "../components/YieldCalculator";
import RentChart from "../components/RentChart";
import HolderList from "../components/HolderList";
import useWatchlist from "../hooks/useWatchlist";
import { CONTRACT_ADDRESSES, MARKETPLACE_ABI } from "../config/contracts";
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

      logTx({
        txHash, type: "buy",
        propertyId: Number(id),
        amount: Number(cost) / 1e6,
        tokenAmount: Number(amount),
        gasMethod: isUGFEnabled ? "ugf" : "eth",
      });

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

      logTx({
        txHash, type: "buy",
        propertyId: Number(id),
        amount: Number(cost) / 1e6,
        tokenAmount: Number(ethers.formatEther(listing.amount)),
        gasMethod: isUGFEnabled ? "ugf" : "eth",
      });

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
                    <label className="form-label">Tokens to buy</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      placeholder="e.g. 5"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                    />
                  </div>
                  <div style={{ minWidth: 160 }}>
                    <div className="form-label" style={{ marginBottom: 4 }}>Total cost</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: "var(--positivus-black)", lineHeight: 1.2, fontFeatureSettings: "'tnum' on" }}>
                      {buyAmount ? fmtUsdc(buyTotal) : "$0.00"}
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-lg btn-full"
                  style={{ marginTop: 18 }}
                  onClick={handleBuyFromOwner}
                  disabled={busy === "primary" || !account || !buyAmount}
                >
                  {!account
                    ? <><Icon name="wallet" size={14} /> Connect wallet to buy</>
                    : busy === "primary"
                      ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Processing…</>
                      : <><Icon name="bolt" size={14} /> Buy {buyAmount || ""} PROP</>}
                </button>

                {account && buyAmount && (
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
            <h2 className="section-title"><Icon name="users" size={14} /> Secondary market — peer listings</h2>
            {listings.length === 0 ? (
              <div className="card">
                <div className="empty-state" style={{ padding: 40 }}>
                  <span className="emoji" style={{ width: 56, height: 56 }}><Icon name="list" size={20} /></span>
                  <h3>No active listings</h3>
                  <p>Visit the <Link to="/portfolio" style={{ color: "var(--positivus-black)", textDecoration: "underline" }}>Portfolio</Link> page to list your tokens.</p>
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
                        const id = `listing-${l.id}`;
                        return (
                          <tr key={l.id}>
                            <td className="font-mono text-sm">{fmtAddr(l.seller)}</td>
                            <td><span className="badge badge-accent">{fmtProp(l.amount)} PROP</span></td>
                            <td>{fmtUsdc(l.price)}</td>
                            <td className="font-bold">{fmtUsdc(total)}</td>
                            <td>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleBuyFromListing(l)}
                                disabled={busy === id}
                              >
                                {busy === id ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> : <><Icon name="bolt" size={11} /> Buy</>}
                              </button>
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
          <h2 className="section-title"><Icon name="trending" size={14} /> Yield calculator</h2>
          <div className="card card-elevated">
            <div className="card-body">
              <YieldCalculator pricePerToken={pricePerToken} totalSupply={totalSupply} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
