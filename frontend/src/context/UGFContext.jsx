import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ethers } from "ethers";
import { useUGFModal } from "@tychilabs/react-ugf";
import { useWeb3 } from "./Web3Context";
import { BACKEND_URL, NETWORK_CHAIN_ID } from "../config/contracts";

const UGFCtx = createContext(null);

const TOGGLE_KEY = "realchain.ugf.enabled";
const UGF_GATEWAY_URL = "https://gateway.universalgasframework.com";
const APPROVE_ABI = ["function approve(address,uint256) returns (bool)"];

function resultHash(result) {
  return result?.txHash || result?.hash || result?.transactionHash || null;
}

function quoteToUsd(quote) {
  const raw = quote?.payment_amount ?? quote?.settlement_amount ?? null;
  if (raw == null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return value / 1e6;
}

export function UGFContextProvider({ children }) {
  const { signer, account } = useWeb3();
  const { openUGF, result: ugfResult } = useUGFModal();
  const pendingUgfRef = useRef(null);
  const lastResultHashRef = useRef(resultHash(ugfResult));
  const [isUGFEnabled, _setUGFEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage?.getItem(TOGGLE_KEY);
    return v === null ? true : v === "true";
  });

  const setUGFEnabled = useCallback((next) => {
    _setUGFEnabled((prev) => {
      const v = typeof next === "function" ? next(prev) : next;
      try { window.localStorage?.setItem(TOGGLE_KEY, String(v)); } catch (_) {}
      return v;
    });
  }, []);

  useEffect(() => {
    const pending = pendingUgfRef.current;
    if (!pending) return;

    // Check for error state first — UGF SDK may return an error without a hash
    const errMsg = ugfResult?.error || ugfResult?.message || ugfResult?.reason || null;
    const hash = resultHash(ugfResult);

    // If ugfResult changed but has no hash AND has an error, reject immediately
    if (errMsg && !hash) {
      window.clearTimeout(pending.timeoutId);
      pendingUgfRef.current = null;
      pending.reject(new Error(errMsg));
      return;
    }

    if (!hash || lastResultHashRef.current === hash) return;

    lastResultHashRef.current = hash;
    if (pending.startHash === hash) return;

    window.clearTimeout(pending.timeoutId);
    pendingUgfRef.current = null;
    pending.resolve({ hash, transactionHash: hash, status: 1, ugf: true });
  }, [ugfResult]);

  useEffect(() => () => {
    if (pendingUgfRef.current?.timeoutId) {
      window.clearTimeout(pendingUgfRef.current.timeoutId);
    }
    pendingUgfRef.current = null;
  }, []);

  const sdkReady = isUGFEnabled && Boolean(openUGF);

  const executeWithUGF = useCallback((tx) => new Promise((resolve, reject) => {
    if (!openUGF) {
      reject(new Error("UGF modal is not available. Check @tychilabs/react-ugf setup."));
      return;
    }

    if (pendingUgfRef.current?.timeoutId) {
      window.clearTimeout(pendingUgfRef.current.timeoutId);
    }

    const timeoutId = window.setTimeout(() => {
      const pending = pendingUgfRef.current;
      if (!pending || pending.timeoutId !== timeoutId) return;
      pendingUgfRef.current = null;
      reject(new Error("UGF confirmation timed out. Reopen the action and try again."));
    }, 10 * 60 * 1000);

    pendingUgfRef.current = {
      resolve,
      reject,
      timeoutId,
      startHash: resultHash(ugfResult),
    };

    Promise.resolve(openUGF({
      signer,
      tx,
      destChainId: String(NETWORK_CHAIN_ID),
    })).catch((e) => {
      window.clearTimeout(timeoutId);
      if (pendingUgfRef.current?.timeoutId === timeoutId) pendingUgfRef.current = null;
      reject(e);
    });
  }), [openUGF, signer, ugfResult]);

  const ugfExecute = useCallback(async (target, abi, fnName, args = [], opts = {}) => {
    if (!signer) throw new Error("Connect your wallet first");
    const iface = new ethers.Interface(abi);
    const data = iface.encodeFunctionData(fnName, args);
    const value = opts.value ?? 0n;
    const tx = { to: target, data, value };

    if (isUGFEnabled && NETWORK_CHAIN_ID === 84532) {
      return executeWithUGF(tx);
    }

    const sent = await signer.sendTransaction(tx);
    return sent.wait();
  }, [signer, isUGFEnabled, executeWithUGF]);

  const ugfApprove = useCallback((tokenAddress, spender, amount, opts = {}) => (
    ugfExecute(tokenAddress, opts.abi || APPROVE_ABI, "approve", [spender, amount], opts)
  ), [ugfExecute]);

  // Track whether the gateway is reachable so we don't spam 401s on every render.
  const quoteBlocked = useRef(false);

  const getQuote = useCallback(async (target, abi, fnName, args = [], opts = {}) => {
    try {
      if (!signer || !account || NETWORK_CHAIN_ID !== 84532) return null;
      // Once the gateway returns 401/403 (no API key), stop retrying for this
      // session to avoid flooding the console with browser-level network errors.
      if (quoteBlocked.current) return null;
      const iface = new ethers.Interface(abi);
      const data = iface.encodeFunctionData(fnName, args);
      const value = opts.value ?? 0n;
      const res = await fetch(`${UGF_GATEWAY_URL}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_coin: "TYI_MOCK_USD",
          payer_address: account,
          payment_chain: "84532",
          payment_chain_type: "evm",
          tx_object: JSON.stringify({
            from: account,
            to: target,
            data,
            value: value.toString(),
          }),
          dest_chain_id: "84532",
          dest_chain_type: "evm",
        }),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          console.warn("[UGF] Gateway returned", res.status, "— quote requests disabled for this session. Check your UGF API key.");
          quoteBlocked.current = true;
        }
        return null;
      }
      const quote = await res.json();
      const feeUsd = quoteToUsd(quote);
      return { ...quote, feeUsd, totalUsd: feeUsd };
    } catch (_) {
      return null;
    }
  }, [signer, account]);

  const logTx = useCallback(async (payload) => {
    try {
      if (BACKEND_URL) {
        await fetch(`${BACKEND_URL}/api/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chainId: NETWORK_CHAIN_ID,
            from: account || null,
            ...payload,
          }),
        });
      }
    } catch (_) {
      // Backend is optional during local demos.
    }
    // Broadcast a `realchain:tx` event regardless of backend status so any
    // mounted page (Marketplace catalog, Portfolio holdings, Activity rail)
    // can refresh its own data without prop-drilling. Listeners read the
    // original payload via `event.detail`.
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("realchain:tx", { detail: payload }));
      }
    } catch (_) { /* CustomEvent unsupported — should not happen in browsers */ }
  }, [account]);

  const value = useMemo(() => ({
    isUGFEnabled,
    setUGFEnabled,
    sdkReady,
    ugfExecute,
    ugfApprove,
    getQuote,
    logTx,
  }), [isUGFEnabled, setUGFEnabled, sdkReady, ugfExecute, ugfApprove, getQuote, logTx]);

  return <UGFCtx.Provider value={value}>{children}</UGFCtx.Provider>;
}

export function useUGF() {
  const ctx = useContext(UGFCtx);
  if (!ctx) throw new Error("useUGF must be used inside UGFContextProvider");
  return ctx;
}

export default UGFContextProvider;
