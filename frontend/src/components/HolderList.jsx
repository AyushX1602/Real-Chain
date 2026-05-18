import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import Icon from "./Icon";
import { useWeb3 } from "../context/Web3Context";

// ─────────────────────────────────────────────────────────────────────────────
// HolderList — top token holders for a single PropertyToken contract.
// Builds the holder set client-side by replaying the ERC20 Transfer event log
// from the read provider. Works for low-volume tokens (which ours are) and
// avoids needing a backend indexer.
//
// Props:
//   tokenAddress: 0x...
//   ownerAddress: 0x... (rendered with an "Owner" tag)
//   limit:        number (default 10)
// ─────────────────────────────────────────────────────────────────────────────

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

export default function HolderList({ tokenAddress, ownerAddress, limit = 10 }) {
  const { account, fmtAddr, fmtProp } = useWeb3();
  const [holders, setHolders] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenAddress) return undefined;
    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Use the wallet provider when available so we share its rate budget;
        // otherwise fall back to a fresh read provider per the project default.
        const provider = window.ethereum
          ? new ethers.BrowserProvider(window.ethereum)
          : new ethers.JsonRpcProvider("https://sepolia.base.org");

        // Pull every Transfer event ever emitted by this token. For our
        // testnet volumes (a few hundred at worst) this is cheap; for higher
        // volume tokens we'd swap this for a backend indexer.
        const logs = await provider.getLogs({
          address: tokenAddress,
          topics: [TRANSFER_TOPIC],
          fromBlock: 0,
          toBlock: "latest",
        });

        // Reduce log stream into address → net balance.
        const balances = new Map();
        for (const log of logs) {
          if (!log?.topics || log.topics.length < 3) continue;
          const from = ethers.getAddress("0x" + log.topics[1].slice(26)).toLowerCase();
          const to   = ethers.getAddress("0x" + log.topics[2].slice(26)).toLowerCase();
          const amt  = BigInt(log.data || "0x0");
          if (from !== "0x0000000000000000000000000000000000000000") {
            balances.set(from, (balances.get(from) ?? 0n) - amt);
          }
          if (to !== "0x0000000000000000000000000000000000000000") {
            balances.set(to, (balances.get(to) ?? 0n) + amt);
          }
        }

        // Drop zero-balance dust accounts and sort descending.
        const ranked = [...balances.entries()]
          .filter(([, bal]) => bal > 0n)
          .sort((a, b) => (b[1] > a[1] ? 1 : -1))
          .slice(0, limit);

        // Total supply for ownership %
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const totalSupply = await token.totalSupply();

        const enriched = ranked.map(([address, balance]) => ({
          address,
          balance,
          pct: totalSupply > 0n ? (Number(balance) / Number(totalSupply)) * 100 : 0,
        }));

        if (alive) setHolders(enriched);
      } catch (e) {
        if (alive) setError(e?.message || "Could not load holders");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [tokenAddress, limit]);

  const ownerLc = (ownerAddress || "").toLowerCase();
  const meLc    = (account || "").toLowerCase();

  if (loading) {
    return <div className="skeleton" style={{ height: 220 }} />;
  }

  if (error) {
    return (
      <div className="banner banner-warn">
        <Icon name="info" size={14} /> Could not pull holder list: {error}
      </div>
    );
  }

  if (!holders || holders.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 32 }}>
        <span className="emoji" style={{ width: 56, height: 56 }}><Icon name="users" size={20} /></span>
        <h3>No holders yet</h3>
        <p>Once tokens are bought, holders will appear here.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="table-wrap" style={{ border: "none" }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Wallet</th>
              <th>Balance</th>
              <th>Ownership</th>
              <th aria-label="Tag" />
            </tr>
          </thead>
          <tbody>
            {holders.map((h, i) => (
              <tr key={h.address}>
                <td className="text-muted text-sm">{i + 1}</td>
                <td className="font-mono text-sm">{fmtAddr(h.address)}</td>
                <td className="font-bold">{fmtProp(h.balance)} PROP</td>
                <td>
                  <div className="holder-bar" aria-hidden="true">
                    <div className="holder-bar-fill" style={{ width: `${Math.min(100, h.pct)}%` }} />
                  </div>
                  <span className="text-xs text-muted">{h.pct.toFixed(2)}%</span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {h.address === ownerLc && <span className="badge badge-gold">Owner</span>}
                    {h.address === meLc && <span className="badge badge-success">You</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
