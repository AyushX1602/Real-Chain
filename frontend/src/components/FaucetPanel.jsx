import React, { useState } from "react";
import Icon from "./Icon";
import { useWeb3 } from "../context/Web3Context";
import { useToast } from "./Toast";
import { BACKEND_URL } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// FaucetPanel — three-tile helper for cold-start judges.
//   1. Get Mock USD for gas (UGF faucet — external link)
//   2. Mint 100 USDC (backend faucet, rate-limited)
//   3. Drop me into demo investor wallet (mnemonic copy, dev-only)
// ─────────────────────────────────────────────────────────────────────────────

export default function FaucetPanel({ onClose }) {
  const { account, connect, refreshUsdcBalance } = useWeb3();
  const { toast } = useToast();
  const [loadingMint, setLoadingMint] = useState(false);

  const isDevMode = (import.meta.env.MODE === "development") ||
    (typeof window !== "undefined" && window.location.search.includes("demo=1"));

  async function handleMintUsdc() {
    if (!account) { connect(); return; }
    setLoadingMint(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/faucet/usdc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: account }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || `HTTP ${r.status}`);
      }
      toast.success("Minted 100 USDC", { msg: "Check your wallet — funds arriving on-chain." });
      setTimeout(() => refreshUsdcBalance?.(), 1500);
    } catch (e) {
      toast.error("Faucet unavailable", { msg: e.message?.slice(0, 140) || "Try again in a minute." });
    } finally {
      setLoadingMint(false);
    }
  }

  return (
    <div className="faucet-card" role="region" aria-label="Test fund helpers">
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
            <Icon name="faucet" size={18} style={{ verticalAlign: "-3px", marginRight: 8 }} />
            Need test funds?
          </h2>
          <p className="text-sm text-muted" style={{ marginTop: 4 }}>
            Three ways to get demo-ready in under a minute.
          </p>
        </div>
        {onClose && (
          <button className="icon-btn" aria-label="Dismiss" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      <div className="faucet-grid">
        <div className="faucet-tile">
          <div className="faucet-tile-head">
            <Icon name="drop" size={16} className="text-accent" />
            Mock USD for gas
          </div>
          <div className="faucet-tile-meta">
            UGF settles your transaction fees in TYI_MOCK_USD. Grab some from the
            UGF faucet — opens in a new tab.
          </div>
          <a
            href="https://universalgasframework.com/faucets"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
          >
            Open UGF faucet <Icon name="external" size={13} />
          </a>
        </div>

        <div className="faucet-tile">
          <div className="faucet-tile-head">
            <Icon name="dollar" size={16} className="text-success" />
            100 USDC for rent
          </div>
          <div className="faucet-tile-meta">
            Mints 100 mock USDC straight to your connected wallet. Rate-limited to one
            request per wallet per hour.
          </div>
          <button
            className="btn btn-success btn-sm"
            onClick={handleMintUsdc}
            disabled={loadingMint}
          >
            {loadingMint ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Minting…</> : <>Mint 100 USDC <Icon name="arrowRight" size={13} /></>}
          </button>
        </div>

        <div className="faucet-tile">
          <div className="faucet-tile-head">
            <Icon name="user" size={16} className="text-gold" />
            Demo investor wallet
          </div>
          <div className="faucet-tile-meta">
            {isDevMode
              ? "Reveals the seeded demo investor mnemonic so you can import into MetaMask."
              : "Available only in development or with ?demo=1 — keeps prod safe."}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            disabled={!isDevMode}
            onClick={() => {
              const mnemonic = import.meta.env.VITE_DEMO_MNEMONIC;
              if (mnemonic && navigator.clipboard) {
                navigator.clipboard.writeText(mnemonic);
                toast.success("Mnemonic copied", { msg: "Import into MetaMask to use the demo investor wallet." });
              } else {
                toast.info("No mnemonic configured", { msg: "Set VITE_DEMO_MNEMONIC in frontend/.env to enable." });
              }
            }}
          >
            Copy mnemonic <Icon name="copy" size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
