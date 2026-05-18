import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import Icon from "./Icon";
import { useWeb3 } from "../context/Web3Context";
import { BACKEND_URL } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// HolderList — top token holders for a single PropertyToken contract.
//
// Strategy:
//   1. Try the indexer-backed `GET /api/properties/:id/holders` first.
//      That's O(1) — Mongo lookup, no log replay.
//   2. Fall back to replaying ERC20 Transfer logs via the read provider when
//      the indexer is offline or hasn't run yet. Cheap on testnet, painful at
//      scale; the indexer obviates this path in production.
//
// Props:
//   propertyId:   number (preferred — lets us hit the indexer)
//   tokenAddress: 0x...
//   ownerAddress: 0x...
//   limit:        number (default 10)
// ─────────────────────────────────────────────────────────────────────────────

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

export default function HolderList({ propertyId, tokenAddress, ownerAddress, limit = 10 }) {
  const { account, fmtAddr, fmtProp } = useWeb3();
  const [holders, setHolders] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null); // "indexer" | "on-chain"

  useEffect(() => {
    if (!tokenAddress) return undefined;
    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      // 1) Try the backend indexer first — fast, doesn't hit RPC limits.
      if (propertyId !== undefined && propertyId !== null) {
        try {
          const r = await fetch(`${BACKEND_URL}/api/properties/${propertyId}/holders?limit=${limit}`);
          if (r.ok) {
            const rows = await r.json();
            if (Array.isArray(rows) && rows.length > 0) {
              if (!alive) return;
              try {
                const provider = window.ethereum
                  ? new ethers.BrowserProvider(window.ethereum)
                  : new ethers.JsonRpcProvider("https://sepolia.base.org");
                const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                const totalSupply = await token.totalSupply();
                const enriched = rows.map((row) => ({
                  address: row.wallet,
                  balance: BigInt(row.balance),
                  pct: totalSupply > 0n ? (Number(BigInt(row.balance)) / Number(totalSupply)) * 100 : 0,
                }));
                if (alive) {
                  setHolders(enriched);
                  setSource("indexer");
                  setLoading(false);
                }
                return;
              } catch { /* fall through to on-chain */ }
            }
          }
        } catch { /* indexer offline — fall through to on-chain */ }
      }

      // 2) On-chain fallback — replay Transfer events.
      try {
        const provider = window.ethereum
          ? new ethers.BrowserProvider(window.ethereum)
          : new ethers.JsonRpcProvider("https://sepolia.base.org");

        const logs = await provider.getLogs({
          address: tokenAddress,
          topics: [TRANSFER_TOPIC],
          fromBlock: 0,
          toBlock: "latest",
        });

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

        const ranked = [...balances.entries()]
          .filter(([, bal]) => bal > 0n)
          .sort((a, b) => (b[1] > a[1] ? 1 : -1))
          .slice(0, limit);

        const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const totalSupply = await token.totalSupply();

        const enriched = ranked.map(([address, balance]) => ({
          address,
          balance,
          pct: totalSupply > 0n ? (Number(balance) / Number(totalSupply)) * 100 : 0,
        }));

        if (alive) {
          setHolders(enriched);
          setSource("on-chain");
        }
      } catch (e) {
        if (alive) setError(e?.message || "Could not load holders");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [propertyId, tokenAddress, limit]);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Top {holders.length} holders</div>
        {source && (
          <span className={`badge ${source === "indexer" ? "badge-success" : "badge-muted"}`} title={source === "indexer" ? "From backend indexer" : "Replayed from chain logs"}>
            <Icon name={source === "indexer" ? "check" : "history"} size={11} />
            {source === "indexer" ? "indexed" : "on-chain"}
          </span>
        )}
      </div>
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
