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
      // Build a provider once and probe the token contract for deployed
      // bytecode. If the address has no code on the connected chain (e.g. the
      // user switched networks, or the indexer is reporting addresses from a
      // different deployment), `totalSupply()` will revert with BAD_DATA. In
      // that case we still want to render whatever the indexer gave us using
      // its own sharePct, instead of failing the whole panel.
      const provider = window.ethereum
        ? new ethers.BrowserProvider(window.ethereum)
        : new ethers.JsonRpcProvider("https://sepolia.base.org");

      let tokenDeployed = false;
      try {
        const code = await provider.getCode(tokenAddress);
        tokenDeployed = !!code && code !== "0x" && code !== "0x0";
      } catch { tokenDeployed = false; }

      // Safe totalSupply: returns 0n if contract isn't deployed or call reverts.
      const safeTotalSupply = async () => {
        if (!tokenDeployed) return 0n;
        try {
          const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          return await token.totalSupply();
        } catch { return 0n; }
      };

      // 1) Try the backend indexer first — fast, doesn't hit RPC limits.
      if (propertyId !== undefined && propertyId !== null) {
        try {
          const r = await fetch(`${BACKEND_URL}/api/properties/${propertyId}/holders?limit=${limit}`);
          if (r.ok) {
            const data = await r.json();
            // Tolerate { count, holders } envelope and the legacy bare-array shape.
            const rows = Array.isArray(data?.holders) ? data.holders : Array.isArray(data) ? data : [];
            if (rows.length > 0) {
              if (!alive) return;
              const totalSupply = await safeTotalSupply();
              const enriched = rows.map((row) => {
                const bal = (() => { try { return BigInt(row.balance); } catch { return 0n; } })();
                // Prefer server-side sharePct when supplied; fall back to the
                // raw chain-derived ratio when we actually have a totalSupply.
                const pct = (typeof row.sharePct === "number")
                  ? row.sharePct
                  : (totalSupply > 0n ? (Number(bal) / Number(totalSupply)) * 100 : 0);
                return { address: row.wallet, balance: bal, pct };
              });
              if (alive) {
                setHolders(enriched);
                setSource("indexer");
                setLoading(false);
              }
              return;
            }
          }
        } catch { /* indexer offline — fall through to on-chain */ }
      }

      // 2) On-chain fallback — replay Transfer events. Skip outright if the
      //    token contract isn't deployed on this chain.
      if (!tokenDeployed) {
        if (alive) {
          setHolders([]);
          setSource("on-chain");
          setLoading(false);
        }
        return;
      }

      try {
        // Public RPCs (Base Sepolia, Alchemy free tier, …) cap eth_getLogs at
        // a 2 000-block window. A single `fromBlock:0 → toBlock:"latest"` call
        // explodes with `query exceeds max block range 2000`. We page backwards
        // from `latest` in fixed-size windows until we either run out of budget
        // or the chain itself runs out of blocks. The window size is small
        // enough to satisfy every public provider we've seen; the total budget
        // is generous enough to find every holder on a typical testnet
        // deployment without taking forever.
        const CHUNK         = 1_900;        // safely under every 2k cap we've hit
        const MAX_CHUNKS    = 30;           // ≈ 57 000 blocks of history
        const latest        = await provider.getBlockNumber();
        const logs          = [];
        let   toBlock       = latest;
        for (let i = 0; i < MAX_CHUNKS && toBlock >= 0; i++) {
          const fromBlock = Math.max(0, toBlock - CHUNK + 1);
          try {
            const batch = await provider.getLogs({
              address: tokenAddress,
              topics:  [TRANSFER_TOPIC],
              fromBlock,
              toBlock,
            });
            logs.push(...batch);
          } catch (chunkErr) {
            // If even a 1 900-block window is too wide (some providers cap at
            // 1 000), halve the chunk and retry once before giving up on this
            // window. We don't loop forever — one retry is plenty.
            try {
              const mid = Math.floor((fromBlock + toBlock) / 2);
              const a = await provider.getLogs({ address: tokenAddress, topics: [TRANSFER_TOPIC], fromBlock: mid + 1, toBlock });
              const b = await provider.getLogs({ address: tokenAddress, topics: [TRANSFER_TOPIC], fromBlock,       toBlock: mid });
              logs.push(...a, ...b);
            } catch {
              // Give up on this window; keep whatever we've already collected
              // so the UI can still render a (partial) holder list rather than
              // erroring out entirely.
              console.warn("HolderList: getLogs window failed", { fromBlock, toBlock, chunkErr });
            }
          }
          if (fromBlock === 0) break;
          toBlock = fromBlock - 1;
        }

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

        const totalSupply = await safeTotalSupply();

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
