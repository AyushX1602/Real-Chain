import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { useUGF } from "../context/UGFContext";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import UGFBadge from "../components/UGFBadge";
import ConnectGate from "../components/ConnectGate";
import {
  FractionalOwnershipBar,
  GasMethodBadge,
  ContractMethodBadge,
  OnChainBadge,
} from "../components/ScreenPrimitives";
import { MARKETPLACE_ABI } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio — every property where the user holds tokens, with sell/cancel UI.
// createListing + cancelListing routed through ugfExecute.
// ─────────────────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const { account, getReadFactory, getReadPropertyContracts, fmtUsdc, fmtProp } = useWeb3();
  const { ugfExecute, ugfApprove, isUGFEnabled, logTx } = useUGF();
  const { toast } = useToast();
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { if (account) load(); else { setLoading(false); setHoldings([]); } }, [account]);

  async function load() {
    setLoading(true);
    try {
      const factory = getReadFactory();
      const count = Number(await factory.getPropertiesCount());
      const h = [];
      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        const { token, market } = getReadPropertyContracts({
          propertyToken: p.propertyToken,
          rentalDistribution: p.rentalDistribution,
          marketplace: p.marketplace,
        });

        const [pricePerToken, listCount, bal, totalSupply] = await Promise.all([
          market.pricePerToken(),
          market.getListingCount(),
          token.balanceOf(account),
          token.totalSupply(),
        ]);

        const myListings = [];
        for (let j = 0; j < Number(listCount); j++) {
          const [seller, amount, price, active] = await market.getListing(j);
          if (active && seller.toLowerCase() === account.toLowerCase()) {
            myListings.push({ listingId: j, amount, price });
          }
        }

        if (bal > 0n || myListings.length > 0) {
          h.push({ propId: i, prop: p, balance: bal, totalSupply, pricePerToken, myListings });
        }
      }
      setHoldings(h);
    } catch (e) {
      console.error(e);
      toast.error("Could not load portfolio", { msg: "Check the network and try again." });
    } finally {
      setLoading(false);
    }
  }

  if (!account) {
    return (
      <ConnectGate
        title="Connect to view your portfolio"
        message="Sign in with MetaMask to see your token holdings, manage listings, and track ownership."
      />
    );
  }

  return (
    <div className="container reveal">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>My <span className="accent">portfolio</span></h1>
            <p>Token holdings, active listings, and resale management for every property you own a slice of.</p>
          </div>
          <Link to="/" className="btn btn-ghost btn-sm">
            <Icon name="search" size={12} /> Browse marketplace
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 16 }}>
          {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 280 }} />)}
        </div>
      ) : holdings.length === 0 ? (
        <div className="empty-state">
          <span className="emoji"><Icon name="briefcase" size={28} /></span>
          <h3>No holdings yet</h3>
          <p>Buy your first property tokens to start earning rent and trading on the secondary market.</p>
          <button className="btn btn-primary mt-6" onClick={() => navigate("/")}>
            Browse properties <Icon name="arrowRight" size={13} />
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {holdings.map((h) => (
            <HoldingCard
              key={h.propId}
              holding={h}
              fmtUsdc={fmtUsdc}
              fmtProp={fmtProp}
              onRefresh={load}
              ugfExecute={ugfExecute}
              ugfApprove={ugfApprove}
              isUGFEnabled={isUGFEnabled}
              logTx={logTx}
              toast={toast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HoldingCard({ holding, fmtUsdc, fmtProp, onRefresh, ugfExecute, ugfApprove, isUGFEnabled, logTx, toast }) {
  const { prop, balance, totalSupply, pricePerToken, myListings, propId } = holding;
  const [listAmount, setListAmount] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [busy, setBusy] = useState(null);
  const [lastTxHash, setLastTxHash] = useState(null);

  const balanceNum = Number(ethers.formatEther(balance));
  const supplyNum = totalSupply ? Number(ethers.formatEther(totalSupply)) : 0;
  const pct = supplyNum > 0 ? ((balanceNum / supplyNum) * 100).toFixed(2) : "0.00";

  async function handleCreateListing() {
    if (!listAmount || !listPrice) return;
    const amount = BigInt(Math.floor(Number(listAmount)));
    const priceVal = BigInt(Math.floor(parseFloat(listPrice) * 1e6));
    setBusy("create");
    try {
      toast.info("Approving PROP", { msg: "UGF will settle listing approval gas in Mock USD." });
      await ugfApprove(prop.propertyToken, prop.marketplace, amount * BigInt(1e18));

      const receipt = await ugfExecute(prop.marketplace, MARKETPLACE_ABI, "createListing", [amount, priceVal]);
      const txHash = receipt?.hash || receipt?.transactionHash || null;
      setLastTxHash(txHash);

      logTx({
        txHash, type: "listing",
        propertyId: propId,
        amount: parseFloat(listAmount) * parseFloat(listPrice),
        tokenAmount: Number(amount),
        gasMethod: isUGFEnabled ? "ugf" : "eth",
      });

      toast.success("Listing live", { msg: `${listAmount} PROP @ ${listPrice} USDC each.` });
      setListAmount(""); setListPrice("");
      onRefresh();
    } catch (e) {
      toast.error("Listing failed", { msg: (e.reason || e.message || "").slice(0, 160) });
    } finally {
      setBusy(null);
    }
  }

  async function handleCancelListing(listingId) {
    setBusy(`cancel-${listingId}`);
    try {
      const receipt = await ugfExecute(prop.marketplace, MARKETPLACE_ABI, "cancelListing", [listingId]);
      const txHash = receipt?.hash || receipt?.transactionHash || null;

      logTx({
        txHash, type: "cancel",
        propertyId: propId,
        amount: 0,
        gasMethod: isUGFEnabled ? "ugf" : "eth",
      });

      toast.success("Listing cancelled");
      onRefresh();
    } catch (e) {
      toast.error("Cancel failed", { msg: (e.reason || e.message || "").slice(0, 160) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card card-elevated">
      <div className="card-body">
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>{prop.name}</h2>
            <div className="text-xs text-muted" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="pin" size={12} /> {prop.location}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="stat-value success" style={{ fontSize: 26 }}>{fmtProp(balance)} <span style={{ color: "var(--fg-muted)", fontSize: 13 }}>PROP</span></div>
            <div className="text-xs text-muted">{pct}% ownership · price now {fmtUsdc(pricePerToken)}</div>
          </div>
        </div>

        {/* True fractional ownership bar — holding / totalSupply */}
        <div style={{ marginBottom: 18 }}>
          <FractionalOwnershipBar
            holding={balanceNum}
            totalSupply={supplyNum}
            label="Your fractional ownership"
          />
        </div>

        {/* Create listing */}
        <div style={{
          padding: 18,
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          marginBottom: 16,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="send" size={14} className="text-accent" /> Create sell listing
          </h3>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
              <label className="form-label">Tokens to sell</label>
              <input className="form-input" type="number" min="1" placeholder="5"
                value={listAmount} onChange={(e) => setListAmount(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
              <label className="form-label">Price / token (USDC)</label>
              <div className="form-input-prefix">
                <span className="prefix">$</span>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="12.00"
                  value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleCreateListing}
              disabled={!listAmount || !listPrice || busy === "create"}
            >
              {busy === "create" ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Listing…</> : <><Icon name="bolt" size={13} /> List for sale</>}
            </button>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <UGFBadge />
            <GasMethodBadge method={isUGFEnabled ? "ugf" : "eth"} compact />
            <ContractMethodBadge contractName="Marketplace" methodName="createListing" address={prop.marketplace} />
            {lastTxHash && <OnChainBadge txHash={lastTxHash} label="Last listing tx" />}
          </div>
        </div>

        {/* My active listings */}
        {myListings.length > 0 && (
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <Icon name="list" size={12} style={{ verticalAlign: -2, marginRight: 6 }} /> My active listings
            </h3>
            <div className="table-wrap" style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
              <table>
                <thead>
                  <tr><th>Tokens</th><th>Price / token</th><th>Total ask</th><th aria-label="Action" /></tr>
                </thead>
                <tbody>
                  {myListings.map((l) => {
                    const total = (l.amount * l.price) / BigInt(1e18);
                    const id = `cancel-${l.listingId}`;
                    return (
                      <tr key={l.listingId}>
                        <td><span className="badge badge-accent">{fmtProp(l.amount)}</span></td>
                        <td>{fmtUsdc(l.price)}</td>
                        <td className="font-bold" style={{ color: "var(--amber-400)" }}>{fmtUsdc(total)}</td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleCancelListing(l.listingId)}
                            disabled={busy === id}
                          >
                            {busy === id ? <span className="spinner" style={{ width: 11, height: 11, borderWidth: 1.5 }} /> : <><Icon name="close" size={11} /> Cancel</>}
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
