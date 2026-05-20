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
  const [newProp, setNewProp] = useState({ name: "", location: "", valueInr: "", price: "" });
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
    setLoading(true);
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
      toast.error("Connect wallet", { msg: "Connect the admin wallet before making on-chain changes." });
      return false;
    }
    if (!effectiveOwnerWallet) {
      toast.error("Save admin wallet", { msg: "Set the wallet that owns and receives assets first." });
      return false;
    }
    if (!canSignForOwnerWallet) {
      toast.error("Wrong wallet", { msg: "Connect the saved admin wallet before making owner changes." });
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
      toast.success("Admin wallet saved", { msg: `${fmtAddr(normalized)} will be used for owned properties.` });
    } catch (e) {
      setWalletError((e.message || "Could not save wallet").slice(0, 180));
    } finally {
      setSavingWallet(false);
    }
  }

  async function handleCreate() {
    if (!(await ensureAdminWriteReady())) return;
    const { name, location, valueInr, price } = newProp;
    if (!name || !location || !valueInr || !price) {
      toast.error("Missing fields", { msg: "Name, location, valuation, and token price are required." });
      return;
    }
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
      setCreatingNew(false);
      setNewProp({ name: "", location: "", valueInr: "", price: "" });
      await load(effectiveOwnerWallet);
    } catch (e) {
      toast.error("Create failed", { msg: friendlyTxError(e) });
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
            <h1>Admin <span className="accent">control room</span></h1>
            <p>Deposit USDC rent, launch new properties, and keep owner assets tied to the right wallet.</p>
          </div>
          <div className="flex gap-3 items-center">
            <span className="role-badge is-owner"><Icon name="star" size={12} /> Admin</span>
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
        <KpiCard icon="user" label="Admin wallet" value={effectiveOwnerWallet ? fmtAddr(effectiveOwnerWallet) : "Not set"} mono tone="muted" />
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
    <div className="card card-elevated reveal" style={{ marginBottom: 24 }}>
      <div className="card-body">
        <div className="page-header-row" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Admin receiving wallet</h2>
            <p className="text-sm text-muted" style={{ marginTop: 4 }}>
              Properties, sale proceeds, and owner actions are tied to this wallet. Connect the same wallet before deploying or depositing rent.
            </p>
          </div>
          <span className={`badge ${canWriteAsOwner ? "badge-success" : "badge-muted"}`}>
            {canWriteAsOwner ? "Wallet matched" : "Read-only"}
          </span>
        </div>

        <div className="flex gap-3 items-end flex-wrap">
          <div className="form-group" style={{ flex: 1, minWidth: 260 }}>
            <label className="form-label">Wallet address for receiving assets</label>
            <div className="form-input-prefix">
              <span className="prefix"><Icon name="wallet" size={13} /></span>
              <input
                className="form-input font-mono"
                value={walletDraft}
                onChange={(e) => setWalletDraft(e.target.value)}
                placeholder="0x0000000000000000000000000000000000000000"
                spellCheck={false}
              />
            </div>
            {walletError && <div className="text-xs" style={{ color: "var(--red-500)", marginTop: 4 }}>{walletError}</div>}
          </div>
          <button className="btn btn-primary" onClick={() => onSave()} disabled={savingWallet}>
            {savingWallet
              ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Saving</>
              : <><Icon name="check" size={13} /> Save wallet</>}
          </button>
          {account && (
            <button className="btn btn-ghost" onClick={() => onSave(account)} disabled={savingWallet}>
              Use connected
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap" style={{ marginTop: 12 }}>
          {effectiveOwnerWallet && <span className="badge badge-muted font-mono">Admin: {fmtAddr(effectiveOwnerWallet)}</span>}
          {account && <span className="badge badge-muted font-mono">Connected: {fmtAddr(account)}</span>}
          {hasWalletMismatch && (
            <span className="badge badge-gold">Connect the admin wallet for write actions</span>
          )}
        </div>
      </div>
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
    { label: "Admin wallet", done: canSignForOwnerWallet },
    { label: NETWORK_MODE === "local" ? "Hardhat network" : "Base Sepolia", done: isCorrectNetwork },
    { label: "Owned properties", done: propertyCount > 0 },
    { label: "Rent deposits", done: totalRent > 0n },
  ];

  return (
    <div className="card card-elevated reveal" style={{ marginBottom: 24 }}>
      <div className="card-body">
        <div className="page-header-row" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Admin workflow</h2>
            <p className="text-sm text-muted" style={{ marginTop: 4 }}>
              Create properties, approve marketplace sales, then deposit collected rent as USDC epochs.
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {NETWORK_MODE === "local" && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={fundWalletLocally}
                disabled={funding || !account}
                title="Top up the connected wallet to 100 ETH on the local Hardhat chain"
              >
                {funding
                  ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Funding</>
                  : <><Icon name="bolt" size={12} /> Fund 100 ETH (local)</>}
              </button>
            )}
            {!isCorrectNetwork && (
              <button className="btn btn-secondary btn-sm" onClick={onSwitchNetwork}>
                <Icon name="alert" size={12} /> Repair network
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          {steps.map((step) => (
            <div key={step.label} className="stat-card">
              <div className="stat-label">
                <Icon name={step.done ? "check" : "info"} size={12} /> {step.label}
              </div>
              <div className={`stat-value ${step.done ? "success" : "muted"}`} style={{ fontSize: 18 }}>
                {step.done ? "Ready" : "Needs setup"}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap" style={{ marginTop: 12 }}>
          <span className={`badge ${isCorrectNetwork ? "badge-success" : "badge-gold"}`}>
            Chain: {chainId || "not connected"} / expected {NETWORK_CHAIN_ID}
          </span>
          <span className={`badge ${canWriteAsOwner ? "badge-success" : "badge-muted"}`}>
            Writes: {canWriteAsOwner ? "enabled" : "locked"}
          </span>
          <span className="badge badge-muted">Rent deposited: {fmtUsdc(totalRent)}</span>
          {NETWORK_MODE === "local" && (
            <span className="badge badge-muted">Local mode: gas paid in test ETH (UGF disabled)</span>
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

function OwnedPropertyCard({ item, fmtUsdc, fmtProp, fmtInr, ugfExecute, ugfApprove, isUGFEnabled, canWriteAsOwner, logTx, onRefresh, toast }) {
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
      toast.error("Admin write locked", { msg: "Connect the saved admin wallet and switch to the expected network first." });
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
