import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import Icon from "./Icon";
import { useWeb3 } from "../context/Web3Context";
import useMarketPrice from "../hooks/useMarketPrice";

// ─────────────────────────────────────────────────────────────────────────────
// CostBanner — shows estimated gas cost for the upcoming MetaMask transaction.
// Displays real-time on-chain gas estimate converted to USD.
//
// Props:
//   - target, abi, fnName, args, value? — describe the call to estimate
//   - estimate (optional)               — caller-provided fallback gas estimate
// ─────────────────────────────────────────────────────────────────────────────

export default function CostBanner({ target, abi, fnName, args = [], value = 0n, estimate, className = "" }) {
  const { provider, account } = useWeb3();
  const ethUsdRate = useMarketPrice();
  const [ethCost, setEthCost] = useState(null);
  const [gasUnits, setGasUnits] = useState(null);

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
            // Base L2 doesn't support eth_maxPriorityFeePerGas (used by
            // getFeeData), so fall back to the legacy eth_gasPrice RPC call
            // which all chains support.
            const raw = await rp.send("eth_gasPrice", []);
            gasPrice = BigInt(raw);
          }
        } catch (_) { /* keep default */ }

        const wei = gas * gasPrice;
        const eth = Number(ethers.formatEther(wei));
        const usd = eth * (ethUsdRate || 2000);
        if (!cancelled) {
          setEthCost(usd);
          setGasUnits(Number(gas));
        }
      } catch (_) {
        if (!cancelled) { setEthCost(null); setGasUnits(null); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, fnName, JSON.stringify(args?.map(String)), account, ethUsdRate]);

  const fmtUsd = (n) => {
    if (n == null) return "—";
    if (n < 0.01 && n > 0) return "< $0.01";
    return `$${n.toFixed(2)}`;
  };

  return (
    <div className={`cost-banner ${className}`} role="group" aria-label="Estimated transaction cost">
      <div className="cost-row is-active">
        <div className="cost-label">
          <Icon name="bolt" size={12} /> Gas paid in Mock USD · no ETH needed
        </div>
        <div className="cost-value tabular">{fmtUsd(ethCost)}</div>
        <div className="cost-meta">
          <Icon name="check" size={11} /> {gasUnits ? `~${gasUnits.toLocaleString()} gas units` : "estimating…"}
          <span className="text-muted"> · Base Sepolia L2</span>
        </div>
      </div>
      <div className="cost-row" style={{ opacity: 0.5 }}>
        <div className="cost-label">
          <Icon name="drop" size={12} /> Traditional gas (ETH)
        </div>
        <div className="cost-value tabular">{fmtUsd(ethCost)}</div>
        <div className="cost-meta">
          <Icon name="alert" size={11} /> same cost, but requires ETH in wallet
        </div>
      </div>
    </div>
  );
}
