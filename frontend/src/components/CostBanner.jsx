import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import Icon from "./Icon";
import { useWeb3 } from "../context/Web3Context";
import { useUGF } from "../context/UGFContext";
import { ETH_USD_RATE } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// CostBanner — side-by-side "Without UGF" vs "With UGF" cost preview.
// Highlights the active row based on the toggle state.
//
// Props:
//   - target, abi, fnName, args, value? — describe the call to estimate
//   - estimate (optional)               — caller-provided fallback gas estimate
// ─────────────────────────────────────────────────────────────────────────────

export default function CostBanner({ target, abi, fnName, args = [], value = 0n, estimate, className = "" }) {
  const { provider, account } = useWeb3();
  const { isUGFEnabled, getQuote } = useUGF();
  const [ethCost, setEthCost] = useState(null);
  const [ugfCost, setUgfCost] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const iface = new ethers.Interface(abi);
        const data = iface.encodeFunctionData(fnName, args);
        const tx = { to: target, data, value, from: account || undefined };
        const rp = provider || null;

        let gas = estimate;
        try {
          if (rp && account) gas = await rp.estimateGas(tx);
        } catch (_) { /* keep estimate fallback */ }
        if (!gas) gas = 100_000n;

        let gasPrice = 1_000_000_000n; // 1 gwei default
        try {
          if (rp) {
            const fee = await rp.getFeeData();
            gasPrice = fee.gasPrice ?? fee.maxFeePerGas ?? gasPrice;
          }
        } catch (_) { /* keep default */ }

        const wei = gas * gasPrice;
        const eth = Number(ethers.formatEther(wei));
        const usd = eth * (ETH_USD_RATE || 2000);
        if (!cancelled) setEthCost(usd);
      } catch (_) {
        if (!cancelled) setEthCost(null);
      }
      try {
        const q = await getQuote(target, abi, fnName, args, { value });
        if (!cancelled) setUgfCost(q?.feeUsd ?? q?.totalUsd ?? null);
      } catch (_) {
        if (!cancelled) setUgfCost(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, fnName, JSON.stringify(args?.map(String)), isUGFEnabled, account]);

  const fmt = (n) => (n == null ? "—" : `$${n.toFixed(2)}`);

  return (
    <div className={`cost-banner ${className}`} role="group" aria-label="Estimated transaction cost">
      <div className={`cost-row ${!isUGFEnabled ? "is-active is-fail" : ""}`}>
        <div className="cost-label">
          <Icon name="alert" size={12} /> Without UGF
        </div>
        <div className="cost-value tabular">{fmt(ethCost)}</div>
        <div className="cost-meta">
          <Icon name="drop" size={11} /> paid in ETH
          {!isUGFEnabled && <span className="text-danger font-semibold">· you have 0 ETH</span>}
        </div>
      </div>
      <div className={`cost-row ${isUGFEnabled ? "is-active" : ""}`}>
        <div className="cost-label">
          <Icon name="bolt" size={12} /> With UGF
        </div>
        <div className="cost-value tabular">
          {ugfCost != null ? fmt(ugfCost) : ethCost != null ? `≈ $${(ethCost * 0.012).toFixed(2)}` : "—"}
        </div>
        <div className="cost-meta">
          <Icon name="check" size={11} /> paid in Mock USD
        </div>
      </div>
    </div>
  );
}
