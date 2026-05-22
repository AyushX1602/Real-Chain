import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useAuth } from "../context/AuthContext";
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
import {
  BACKEND_URL,
  CONTRACT_ADDRESSES,
  NETWORK_CHAIN_ID,
  NETWORK_MODE,
  PROPERTY_FACTORY_ABI,
  RENTAL_DISTRIBUTION_ABI,
} from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// OwnerDashboard — properties you own, rent you have deposited, quick deposit
// form, create-property launchpad. Deposit is wrapped with UGF in Tier 2.
// ─────────────────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const {
    account,
    chainId,
    isCorrectNetwork,
    nodeOnline,
    switchToExpectedNetwork,
    getReadFactory,
    getReadPropertyContracts,
    fmtUsdc,
    fmtProp,
    fmtAddr,
    fmtInr,
  } = useWeb3();
  const { user: authUser, isAuthenticated, updateProfile } = useAuth();
  const { ugfExecute, ugfApprove, isUGFEnabled, logTx } = useUGF();
  const { toast } = useToast();
  const [props, setProps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingNew, setCreatingNew] = useState(false);
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [newProp, setNewProp] = useState({ name: "", location: "", valueInr: "", price: "", imageUrl: "" });
  const [walletDraft, setWalletDraft] = useState(authUser?.assetWallet || "");
  const [savingWallet, setSavingWallet] = useState(false);
  const [walletError, setWalletError] = useState("");

  const isAdminSession = isAuthenticated && authUser?.role === "owner";
  const savedAssetWallet = authUser?.assetWallet || "";
  const effectiveOwnerWallet = useMemo(() => {
    const candidate = savedAssetWallet || account || "";
    return ethers.isAddress(candidate) ? ethers.getAddress(candidate) : "";
  }, [savedAssetWallet, account]);
  const canWriteAsOwner = Boolean(
    account &&
    effectiveOwnerWallet &&
    account.toLowerCase() === effectiveOwnerWallet.toLowerCase() &&
    isCorrectNetwork
  );
  const canSignForOwnerWallet = Boolean(
    account &&
    effectiveOwnerWallet &&
    account.toLowerCase() === effectiveOwnerWallet.toLowerCase()
  );
  const hasWalletMismatch = Boolean(
    account &&
    effectiveOwnerWallet &&
    account.toLowerCase() !== effectiveOwnerWallet.toLowerCase()
  );

  useEffect(() => {
    setWalletDraft(savedAssetWallet || "");
  }, [savedAssetWallet]);

  // Live refresh — owner panels (deposited, epochs, holder concentration)
  // shift on every tx fired anywhere in the app. The dependency uses
  // `effectiveOwnerWallet` so impersonation by an admin re-fetches against
  // the impersonated owner.
  useEffect(() => {
    function onTx() { if (effectiveOwnerWallet) load(); }
    window.addEventListener("realchain:tx", onTx);
    return () => window.removeEventListener("realchain:tx", onTx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOwnerWallet]);

  useEffect(() => {
    if (!effectiveOwnerWallet) {
      setProps([]);
      setLoading(false);
      return;
    }
    if (nodeOnline === false) {
      // Don't burn cycles hitting an unreachable RPC. Web3Context re-polls
      // every 15 s; this effect re-runs the moment nodeOnline flips to true.
      setLoading(false);
      return;
    }
    load(effectiveOwnerWallet);
  }, [effectiveOwnerWallet, nodeOnline]);

  async function load(ownerWallet = effectiveOwnerWallet) {
    if (!ownerWallet) {
      setProps([]);
      setLoading(false);
      return;
    }
    // Only show skeleton on initial load — not on soft refresh after deposit
    if (props.length === 0) setLoading(true);
    try {
      const normalizedOwner = ownerWallet.toLowerCase();
      const factory = getReadFactory();

      // Pre-flight: ensure there's actually a contract at the factory address
      // on the active chain. Without this, ethers throws an opaque
      // BAD_DATA value="0x" when the RPC returns empty bytes for a missing
      // contract (typical after `npx hardhat node` is restarted without
      // re-running `npm run deploy:local`, or when the address points at the
      // wrong chain).
      const code = await factory.runner.provider.getCode(CONTRACT_ADDRESSES.propertyFactory);
      if (!code || code === "0x") {
        setProps([]);
        toast.error("Factory not deployed", {
          msg: NETWORK_MODE === "local"
            ? `No contract at ${CONTRACT_ADDRESSES.propertyFactory} on chain ${NETWORK_CHAIN_ID}. Run npm run deploy:local.`
            : `No contract at ${CONTRACT_ADDRESSES.propertyFactory} on chain ${NETWORK_CHAIN_ID}. Run npm run deploy:base or update VITE_PROPERTY_FACTORY_ADDRESS.`,
        });
        return;
      }

      const count = Number(await factory.getPropertiesCount());
      const list = [];
      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        if (p.owner.toLowerCase() !== normalizedOwner) continue;
        const { token, rental } = getReadPropertyContracts({
          propertyToken: p.propertyToken,
          rentalDistribution: p.rentalDistribution,
          marketplace: p.marketplace,
        });
        const epochCount = Number(await rental.epochCount());
        let totalDeposited = 0n;
        let epochs = [];

        // Try loading epochs from the backend API (fast — single HTTP call)
        try {
          const apiRes = await fetch(`${BACKEND_URL}/api/properties/${i}/epochs?limit=50`);
          if (apiRes.ok) {
            const apiEpochs = await apiRes.json();
            if (apiEpochs.length > 0) {
              epochs = apiEpochs.map((e) => ({
                id: e.id,
                total: BigInt(e.total),
                ts: e.ts,
              }));
              totalDeposited = epochs.reduce((s, e) => s + e.total, 0n);
            }
          }
        } catch { /* API unavailable — fall through to chain */ }

        // Fallback: read directly from chain if API returned nothing
        if (epochs.length === 0 && epochCount > 0) {
          for (let j = 0; j < epochCount; j++) {
            const [total, , ts] = await rental.getEpoch(j);
            totalDeposited += total;
            epochs.push({ id: j, total, ts: Number(ts) });
          }
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
      const msg = String(e?.shortMessage || e?.reason || e?.message || e || "").toLowerCase();
      const looksUnreachable =
        e?.code === "ECONNREFUSED" ||
        e?.code === "NETWORK_ERROR" ||
        msg.includes("failed to fetch") ||
        msg.includes("could not detect network") ||
        msg.includes("connection refused") ||
        msg.includes("127.0.0.1:8545") ||
        msg.includes("err_connection_refused");
      const looksBadAbi =
        e?.code === "BAD_DATA" ||
        msg.includes("could not decode result data");
      if (looksUnreachable) {
        const rpcLabel = NETWORK_MODE === "local"
          ? "Hardhat node at http://127.0.0.1:8545"
          : `Base Sepolia RPC (${import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"})`;
        toast.error("RPC unreachable", {
          msg: NETWORK_MODE === "local"
            ? `Start the Hardhat node (npm run node) or set VITE_NETWORK_MODE=baseSepolia and restart Vite.`
            : `Could not reach ${rpcLabel}. Check the URL or try again in a moment.`,
        });
      } else if (looksBadAbi) {
        toast.error("Factory address mismatch", {
          msg: NETWORK_MODE === "local"
            ? `${CONTRACT_ADDRESSES.propertyFactory} on chain ${NETWORK_CHAIN_ID} did not respond to getPropertiesCount(). Re-run npm run deploy:local and refresh.`
            : `${CONTRACT_ADDRESSES.propertyFactory} on chain ${NETWORK_CHAIN_ID} did not respond to getPropertiesCount(). Confirm VITE_PROPERTY_FACTORY_ADDRESS matches the deployed factory.`,
        });
      } else {
        toast.error("Could not load properties", { msg: "Check the network and try again." });
      }
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

  function friendlyTxError(e) {
    const msg = String(e?.shortMessage || e?.reason || e?.message || e || "");
    const lower = msg.toLowerCase();
    if (lower.includes("127.0.0.1:8545") || lower.includes("failed to fetch")) {
      return `Your wallet or app is still pointed at Localhost. Switch MetaMask to ${NETWORK_MODE === "local" ? "Hardhat Local" : "Base Sepolia"} and retry.`;
    }
    if (lower.includes("too many errors") || lower.includes("-32002")) {
      return "MetaMask's RPC endpoint is throttling. Use the network repair button, wait a moment, then retry.";
    }
    if (lower.includes("user rejected")) return "Transaction was cancelled in MetaMask.";
    return msg.slice(0, 180) || "Transaction failed. Check MetaMask and retry.";
  }

  async function ensureAdminWriteReady() {
    if (!account) {
      toast.error("Connect wallet", { msg: "Connect your wallet before making on-chain changes." });
      return false;
    }
    if (!effectiveOwnerWallet) {
      toast.error("Save owner wallet", { msg: "Set the wallet that owns and receives assets first." });
      return false;
    }
    if (!canSignForOwnerWallet) {
      toast.error("Wrong wallet", { msg: "Connect the saved owner wallet before making owner changes." });
      return false;
    }
    if (!isCorrectNetwork) {
      toast.info("Switching network", { msg: `Opening MetaMask for ${NETWORK_MODE === "local" ? "Hardhat Local" : "Base Sepolia"}.` });
      const switched = await switchToExpectedNetwork();
      if (!switched) {
        toast.error("Wrong network", { msg: `Switch MetaMask to ${NETWORK_MODE === "local" ? "Hardhat Local" : "Base Sepolia"} and retry.` });
        return false;
      }
    }
    return true;
  }

  /* Lighter check for property creation — any connected wallet can create */
  async function ensureCreateReady() {
    if (!account) {
      toast.error("Connect wallet", { msg: "Connect your wallet to create a property." });
      return false;
    }
    if (!isCorrectNetwork) {
      toast.info("Switching network", { msg: `Opening MetaMask for ${NETWORK_MODE === "local" ? "Hardhat Local" : "Base Sepolia"}.` });
      const switched = await switchToExpectedNetwork();
      if (!switched) {
        toast.error("Wrong network", { msg: `Switch MetaMask to ${NETWORK_MODE === "local" ? "Hardhat Local" : "Base Sepolia"} and retry.` });
        return false;
      }
    }
    return true;
  }

  async function readNewestOwnedProperty(previousCount) {
    const factory = getReadFactory();
    for (let attempt = 0; attempt < 8; attempt++) {
      const count = Number(await factory.getPropertiesCount());
      if (count > previousCount) {
        const newest = await factory.properties(count - 1);
        if (newest.owner.toLowerCase() === account.toLowerCase()) return newest;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return null;
  }

  async function handleSaveAssetWallet(raw = walletDraft) {
    if (!isAdminSession) return;
    const next = String(raw || "").trim();
    if (!next) {
      setWalletError("Enter the wallet address that should receive owner assets.");
      return;
    }
    if (!ethers.isAddress(next)) {
      setWalletError("Enter a valid 0x wallet address.");
      return;
    }

    setSavingWallet(true);
    setWalletError("");
    try {
      const normalized = ethers.getAddress(next);
      await updateProfile({ assetWallet: normalized });
      setWalletDraft(normalized);
      toast.success("Owner wallet saved", { msg: `${fmtAddr(normalized)} will be used for owned properties.` });
    } catch (e) {
      setWalletError((e.message || "Could not save wallet").slice(0, 180));
    } finally {
      setSavingWallet(false);
    }
  }

  async function handleCreate() {
    if (!(await ensureCreateReady())) return;
    const { name, location, valueInr, price } = newProp;
    if (!name || !location || !valueInr || !price) {
      toast.error("Missing fields", { msg: "Name, location, valuation, and token price are required." });
      return;
    }
    setCreatingBusy(true);
    try {
      const inrPaisa = BigInt(Math.floor(parseFloat(valueInr) * 100));
      const usdc6 = BigInt(Math.floor(parseFloat(price) * 1e6));
      if (inrPaisa <= 0n || usdc6 <= 0n) {
        toast.error("Invalid numbers", { msg: "Valuation and token price must be greater than zero." });
        return;
      }

      const previousCount = Number(await getReadFactory().getPropertiesCount());

      toast.info("Creating property", {
        msg: isUGFEnabled && NETWORK_CHAIN_ID === 84532
          ? "Confirm the gasless UGF flow."
          : "Confirm in MetaMask.",
      });
      await ugfExecute(
        CONTRACT_ADDRESSES.propertyFactory,
        PROPERTY_FACTORY_ABI,
        "createProperty",
        [name.trim(), location.trim(), inrPaisa, usdc6]
      );

      // Auto-approve: the new Marketplace must be allowed to transfer the
      // owner's PROP tokens so buyFromOwner works immediately.
      try {
        const newest = await readNewestOwnedProperty(previousCount);
        if (newest) {
          if (newest.owner.toLowerCase() === account.toLowerCase()) {
            toast.info("Approving marketplace", { msg: "One more approval enables investor purchases." });
            await ugfApprove(newest.propertyToken, newest.marketplace, ethers.MaxUint256);
            toast.success("Marketplace approved", { msg: "Investors can now buy tokens." });
          }
        }
      } catch (approveErr) {
        // Non-fatal — owner can approve later. Log for debugging.
        console.warn("Auto-approve failed:", approveErr);
        toast.info("Created but approval pending", { msg: "Marketplace approval can be retried later." });
      }

      toast.success("Property created", { msg: `${name} is now live on-chain.` });

      // Save optional image URL to the backend so the marketplace card shows it.
      const imgUrl = (newProp.imageUrl || "").trim();
      if (imgUrl) {
        try {
          const newestCount = Number(await getReadFactory().getPropertiesCount());
          const newId = newestCount - 1;
          await fetch(`${BACKEND_URL}/api/properties/${newId}/image`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: imgUrl }),
          });
        } catch (imgErr) {
          console.warn("Image URL save failed (non-fatal):", imgErr);
        }
      }

      setCreatingNew(false);
      setNewProp({ name: "", location: "", valueInr: "", price: "", imageUrl: "" });
      await load(effectiveOwnerWallet);
    } catch (e) {
      toast.error("Create failed", { msg: friendlyTxError(e) });
    } finally {
      setCreatingBusy(false);
    }
  }

  if (!account && !isAdminSession) {
    return (
      <ConnectGate
        title="Connect to manage your properties"
        message="Sign in with MetaMask to deposit rent, mint new properties, and review epochs."
      />
    );
  }

  return (
    <div className="container reveal">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Owner <span className="accent">control room</span></h1>
            <p>Deposit USDC rent, launch new properties, and keep owner assets tied to the right wallet.</p>
          </div>
          <div className="flex gap-3 items-center">
            <span className="role-badge is-owner"><Icon name="star" size={12} /> Owner</span>
            <SyncButton toast={toast} />
            <button
              className="btn btn-gold"
              onClick={() => setCreatingNew(true)}
              disabled={!canWriteAsOwner}
              title={!canWriteAsOwner ? "Connect the saved admin wallet to create properties" : undefined}
            >
              <Icon name="plus" size={14} /> New property
            </button>
          </div>
        </div>
      </div>

      {isAdminSession && (
        <>
          <AdminWalletPanel
            account={account}
            effectiveOwnerWallet={effectiveOwnerWallet}
            walletDraft={walletDraft}
            setWalletDraft={setWalletDraft}
            walletError={walletError}
            savingWallet={savingWallet}
            hasWalletMismatch={hasWalletMismatch}
            canWriteAsOwner={canWriteAsOwner}
            fmtAddr={fmtAddr}
            onSave={handleSaveAssetWallet}
          />
          <AdminWorkflowPanel
            chainId={chainId}
            isCorrectNetwork={isCorrectNetwork}
            canSignForOwnerWallet={canSignForOwnerWallet}
            canWriteAsOwner={canWriteAsOwner}
            propertyCount={props.length}
            totalRent={totalRent}
            fmtUsdc={fmtUsdc}
            onSwitchNetwork={switchToExpectedNetwork}
            account={account}
            toast={toast}
          />
        </>
      )}

      {/* Top stats row */}
      <div className="stats-row" style={{ marginBottom: 32 }}>
        <KpiCard icon="building" label="Properties owned" value={String(props.length)} tone="accent" />
        <KpiCard icon="coins" label="Total rent deposited" value={fmtUsdc(totalRent)} tone="gold" />
        <KpiCard icon="history" label="Total epochs" value={String(totalEpochs)} tone="success" />
        <KpiCard icon="user" label="Owner wallet" value={effectiveOwnerWallet ? fmtAddr(effectiveOwnerWallet) : "Not set"} mono tone="muted" />
      </div>

      {creatingNew && (
        <CreatePropertyForm
          value={newProp}
          onChange={setNewProp}
          onSubmit={handleCreate}
          onCancel={() => setCreatingNew(false)}
          busy={creatingBusy}
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
          <button
            className="btn btn-primary mt-6"
            onClick={() => setCreatingNew(true)}
            disabled={!canWriteAsOwner}
            title={!canWriteAsOwner ? "Connect the saved admin wallet to create properties" : undefined}
          >
            <Icon name="plus" size={13} /> {canWriteAsOwner ? "Create property" : "Connect admin wallet"}
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
              canWriteAsOwner={canWriteAsOwner}
              logTx={logTx}
              onRefresh={load}
              toast={toast}
              getReadPropertyContracts={getReadPropertyContracts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdminWalletPanel({
  account,
  effectiveOwnerWallet,
  walletDraft,
  setWalletDraft,
  walletError,
  savingWallet,
  hasWalletMismatch,
  canWriteAsOwner,
  fmtAddr,
  onSave,
}) {
  return (
    <div style={{ marginBottom: 12, padding: "14px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Icon name="wallet" size={14} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Owner wallet</span>
          <span className={`badge ${canWriteAsOwner ? "badge-success" : hasWalletMismatch ? "badge-gold" : "badge-muted"}`} style={{ fontSize: 10 }}>
            {canWriteAsOwner ? "Matched" : hasWalletMismatch ? "Mismatch" : "Not set"}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 240, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="form-input font-mono"
            value={walletDraft}
            onChange={(e) => setWalletDraft(e.target.value)}
            placeholder="0x0000…0000"
            spellCheck={false}
            style={{ fontSize: 12, padding: "6px 10px", flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => onSave()} disabled={savingWallet} style={{ flexShrink: 0 }}>
            {savingWallet ? "Saving" : "Save"}
          </button>
          {account && (
            <button className="btn btn-ghost btn-sm" onClick={() => onSave(account)} disabled={savingWallet} style={{ flexShrink: 0, fontSize: 11 }}>
              Use connected
            </button>
          )}
        </div>
      </div>
      {walletError && <div className="text-xs" style={{ color: "var(--red-500)", marginTop: 6, paddingLeft: 30 }}>{walletError}</div>}
    </div>
  );
}


function AdminWorkflowPanel({
  chainId,
  isCorrectNetwork,
  canSignForOwnerWallet,
  canWriteAsOwner,
  propertyCount,
  totalRent,
  fmtUsdc,
  onSwitchNetwork,
  account,
  toast,
}) {
  const [funding, setFunding] = useState(false);

  // Local-only convenience: use Hardhat's hardhat_setBalance RPC method to
  // top up the currently-connected MetaMask wallet to 100 ETH on chain 31337.
  // This is only meaningful when VITE_NETWORK_MODE=local — production chains
  // (Base Sepolia, Mainnet) reject this RPC. UGF handles gas there instead.
  async function fundWalletLocally() {
    if (!account) {
      toast?.error?.("Connect wallet", { msg: "Connect MetaMask before funding the local account." });
      return;
    }
    if (NETWORK_MODE !== "local") {
      toast?.info?.("Use UGF instead", {
        msg: "On Base Sepolia, gas is paid in Mock USD via UGF — no ETH top-up is possible from the dApp.",
      });
      return;
    }
    setFunding(true);
    try {
      const rpcUrl = "http://127.0.0.1:8545";
      const hexAmount = "0x" + (100n * 10n ** 18n).toString(16); // 100 ETH
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "hardhat_setBalance",
          params: [account, hexAmount],
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (body?.error) throw new Error(body.error.message || "Hardhat RPC rejected setBalance");
      // Tell MetaMask to refresh the cached balance for the active account.
      try { await window.ethereum?.request({ method: "eth_blockNumber" }); } catch (_) {}
      toast?.success?.("Funded with 100 ETH", { msg: `${account.slice(0, 6)}…${account.slice(-4)} now has gas for local txs.` });
    } catch (e) {
      toast?.error?.("Top-up failed", {
        msg: (e?.message || "hardhat_setBalance failed. Is `npx hardhat node` running?").slice(0, 180),
      });
    } finally {
      setFunding(false);
    }
  }

  const steps = [
    { label: "Owner wallet", done: canSignForOwnerWallet },
    { label: NETWORK_MODE === "local" ? "Hardhat network" : "Base Sepolia", done: isCorrectNetwork },
    { label: "Owned properties", done: propertyCount > 0 },
    { label: "Rent deposits", done: totalRent > 0n },
  ];

  return (
    <div className="card" style={{ marginBottom: 24, padding: "14px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {steps.map((step) => (
            <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: step.done ? "#22c55e" : "#d1d5db",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: step.done ? "var(--positivus-black)" : "var(--fg-muted)" }}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className={`badge ${isCorrectNetwork ? "badge-success" : "badge-gold"}`} style={{ fontSize: 11 }}>
            Chain {chainId || "—"}
          </span>
          <span className={`badge ${canWriteAsOwner ? "badge-success" : "badge-muted"}`} style={{ fontSize: 11 }}>
            {canWriteAsOwner ? "Writes on" : "Read-only"}
          </span>
          {NETWORK_MODE === "local" && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={fundWalletLocally}
              disabled={funding || !account}
              style={{ fontSize: 11, padding: "4px 10px" }}
            >
              {funding ? <>Funding…</> : <><Icon name="bolt" size={11} /> Fund ETH</>}
            </button>
          )}
          {!isCorrectNetwork && (
            <button className="btn btn-secondary btn-sm" onClick={onSwitchNetwork} style={{ fontSize: 11 }}>
              <Icon name="alert" size={11} /> Fix network
            </button>
          )}
        </div>
      </div>
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

function CreatePropertyForm({ value, onChange, onSubmit, onCancel, busy }) {
  return (
    <div className="card card-elevated reveal" style={{ marginBottom: 24 }}>
      <div className="card-body">
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
              <Icon name="plus" size={16} style={{ verticalAlign: -2, marginRight: 8 }} />
              Tokenize a new property
            </h2>
            <p className="text-sm text-muted" style={{ marginTop: 4 }}>
              This deploys 3 smart contracts: <strong>PropertyToken</strong> (100 PROP = 100% ownership), <strong>RentalDistribution</strong> (monthly rent pool), and <strong>Marketplace</strong> (buy/sell tokens).
            </p>
          </div>
          <button className="icon-btn" onClick={onCancel} aria-label="Cancel">
            <Icon name="close" size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Property name</label>
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

        {/* Image URL — optional, full-width */}
        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="form-label">Property photo URL <span style={{ fontWeight: 400, color: "var(--fg-muted)" }}>(optional)</span></label>
          <input
            className="form-input"
            type="url"
            placeholder="https://images.unsplash.com/photo-... or any image URL"
            value={value.imageUrl}
            onChange={(e) => onChange({ ...value, imageUrl: e.target.value })}
          />
          <div className="form-helper">Paste any public image URL. If left blank, a matching photo is auto-selected.</div>
          {value.imageUrl && value.imageUrl.startsWith("http") && (
            <div style={{ marginTop: 10, borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border)", height: 120 }}>
              <img
                src={value.imageUrl}
                alt="Preview"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={onSubmit} disabled={busy}>
            {busy
              ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 1.5 }} /> Deploying contracts…</>
              : <><Icon name="check" size={13} /> Mint property</>}
          </button>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function OwnedPropertyCard({ item, fmtUsdc, fmtProp, fmtInr, ugfExecute, ugfApprove, isUGFEnabled, canWriteAsOwner, logTx, onRefresh, toast, getReadPropertyContracts }) {
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
    if (!canWriteAsOwner) {
      toast.error("Owner write locked", { msg: "Connect the saved owner wallet and switch to the expected network first." });
      return;
    }
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

      // Persist epoch to backend immediately (fast-path for instant UI update)
      try {
        const { rental: rentalRo } = getReadPropertyContracts({
          propertyToken: p.propertyToken,
          rentalDistribution: p.rentalDistribution,
          marketplace: p.marketplace,
        });
        // Wait briefly for the block, then read the new epoch count
        await new Promise((r) => setTimeout(r, 2000));
        const newEpochCount = Number(await rentalRo.epochCount());
        const lastIdx = newEpochCount - 1;
        if (lastIdx >= 0) {
          const [total, , ts] = await rentalRo.getEpoch(lastIdx);
          await fetch(`${BACKEND_URL}/api/properties/${item.id}/epochs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              epochIndex: lastIdx,
              amount: Number(total) / 1e6,
              amountRaw: total.toString(),
              timestamp: Number(ts),
              txHash,
              depositor: p.owner,
            }),
          });
        }
      } catch (saveErr) {
        console.warn("Epoch save to backend failed (non-fatal):", saveErr);
      }

      await onRefresh();
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
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
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
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="send" size={14} className="text-accent" />
            Deposit rent
            <span className="text-xs text-muted" style={{ fontWeight: 400, marginLeft: 4 }}>→ creates a new epoch for all token holders</span>
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
            <button className="btn btn-primary" onClick={handleDeposit} disabled={!amount || busy || !canWriteAsOwner}>
              {!canWriteAsOwner
                ? <>Connect admin wallet</>
                : busy
                  ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Depositing…</>
                  : <><Icon name="bolt" size={13} /> Deposit</>}
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

// ── Sync contracts → MongoDB button ─────────────────────────────────────────
function SyncButton({ toast }) {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/properties/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const count = data?.synced ?? data?.count ?? 0;
      toast.success("Sync complete", { msg: `${count} properties resynced from chain → database.` });
    } catch (e) {
      toast.error("Sync failed", { msg: (e.message || "").slice(0, 160) });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={handleSync}
      disabled={syncing}
      title="Re-read all on-chain properties into MongoDB (useful after Hardhat restart)"
    >
      {syncing
        ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Syncing…</>
        : <><Icon name="history" size={12} /> Sync DB</>}
    </button>
  );
}

// ── Bulk Deposit — deposit the same rent to multiple properties ──────────────
function BulkDepositSection({ items, canWriteAsOwner, fmtUsdc, onRefresh }) {
  const { ugfExecute, ugfApprove, isUGFEnabled, logTx } = useUGF();
  const { toast } = useToast();
  const [selected, setSelected] = useState(new Set());
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  if (!items || items.length === 0) return null;

  function toggleProperty(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((it) => it.id)));
  }

  async function handleBulkDeposit() {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n < 0.01) {
      toast.error("Invalid amount", { msg: "Enter at least 0.01 USDC." });
      return;
    }
    if (selected.size === 0) {
      toast.error("No properties selected", { msg: "Check at least one property." });
      return;
    }
    if (!canWriteAsOwner) {
      toast.error("Owner write locked", { msg: "Connect the owner wallet first." });
      return;
    }
    setBusy(true);
    const targets = items.filter((it) => selected.has(it.id));
    setProgress({ done: 0, total: targets.length });
    let success = 0;
    for (const it of targets) {
      try {
        const usdcRaw = BigInt(Math.floor(n * 1e6));
        await ugfApprove(CONTRACT_ADDRESSES.mockUsdc, it.property.rentalDistribution, usdcRaw);
        const receipt = await ugfExecute(it.property.rentalDistribution, RENTAL_DISTRIBUTION_ABI, "depositRental", [usdcRaw]);
        const txHash = receipt?.hash || receipt?.transactionHash || null;
        logTx({
          txHash,
          type: "deposit",
          propertyId: it.id,
          amount: n,
          gasMethod: isUGFEnabled ? "ugf" : "eth",
        });
        success++;
      } catch (e) {
        toast.error(`Deposit failed for ${it.property.name}`, { msg: (e.reason || e.message || "").slice(0, 120) });
      }
      setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }
    toast.success("Bulk deposit complete", { msg: `${success}/${targets.length} properties received $${n.toFixed(2)} each.` });
    setAmount("");
    setSelected(new Set());
    await new Promise((r) => setTimeout(r, 2000));
    await onRefresh();
    setBusy(false);
  }

  return (
    <div className="card card-elevated" style={{ marginTop: 24 }}>
      <div className="card-body" style={{ padding: "20px 24px" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
          <span style={{
            width: 28, height: 28, display: "inline-flex", alignItems: "center",
            justifyContent: "center", borderRadius: 8,
            background: "var(--gold-soft)", color: "var(--amber-400)",
          }}>
            <Icon name="coins" size={14} />
          </span>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Bulk rent deposit</h3>
          <span className="badge badge-muted" style={{ fontSize: 11 }}>{selected.size} selected</span>
        </div>

        {/* Property checkboxes */}
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={selectAll} />
            <span style={{ fontWeight: 600 }}>Select all ({items.length})</span>
          </label>
          {items.map((it) => (
            <label key={it.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", borderRadius: 8, fontSize: 13,
              background: selected.has(it.id) ? "rgba(185,255,102,0.08)" : "var(--bg-elevated)",
              border: `1px solid ${selected.has(it.id) ? "rgba(185,255,102,0.3)" : "var(--border)"}`,
              cursor: "pointer",
            }}>
              <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleProperty(it.id)} />
              <span style={{ flex: 1, fontWeight: 600 }}>{it.property.name}</span>
              <span className="text-xs text-muted">{fmtUsdc(it.totalDeposited || 0n)} deposited</span>
            </label>
          ))}
        </div>

        {/* Amount + button */}
        <div className="flex gap-2 items-end">
          <div style={{ flex: 1 }}>
            <label className="text-xs text-muted" style={{ display: "block", marginBottom: 4 }}>Amount per property (USDC)</label>
            <input
              type="number"
              className="input"
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0.01"
              step="0.01"
              disabled={busy}
            />
          </div>
          <button
            className="btn btn-gold"
            onClick={handleBulkDeposit}
            disabled={busy || !amount || selected.size === 0}
            style={{ minWidth: 160 }}
          >
            {busy ? (
              <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> {progress.done}/{progress.total}</>
            ) : (
              <><Icon name="coins" size={13} /> Deposit to {selected.size}</>
            )}
          </button>
        </div>

        {busy && (
          <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: "var(--bg-elevated)" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: "linear-gradient(90deg, #B9FF66, #8BC34A)",
              width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
              transition: "width 0.3s ease",
            }} />
          </div>
        )}
      </div>
    </div>
  );
}
