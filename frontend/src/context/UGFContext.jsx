import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "./Web3Context";
import { BACKEND_URL, NETWORK_CHAIN_ID } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// UGFContext — wraps the Universal Gas Framework SDK so investors can pay gas
// in TYI_MOCK_USD instead of native ETH.
//
// The actual SDK (`@tychilabs/react-ugf`) is loaded dynamically. If the SDK is
// not installed or fails to load, this context falls back to direct
// signer.sendTransaction so the rest of the app keeps working — useful for
// local development and for the Tier 2 / 5B "UGF off" toggle.
//
// Public API (via useUGF()):
//   ugfExecute(target, abi, fnName, args, opts?)    workhorse
//   getQuote(target, abi, fnName, args)             cost preview
//   isUGFEnabled, setUGFEnabled                     toggle
//   logTx({ ... })                                  POST to activity feed
//   sdkReady                                        boolean — SDK actually loaded
// ─────────────────────────────────────────────────────────────────────────────

const UGFCtx = createContext(null);

// Dynamic SDK load — non-blocking, never throws into render.
let _sdkPromise = null;
function loadSdk() {
  if (_sdkPromise) return _sdkPromise;
  _sdkPromise = import("@tychilabs/react-ugf")
    .then((mod) => mod ?? null)
    .catch((e) => {
      console.info("[UGF] SDK unavailable, falling back to direct signer:", e?.message || e);
      return null;
    });
  return _sdkPromise;
}

// Persistent toggle key
const TOGGLE_KEY = "realchain.ugf.enabled";

export function UGFContextProvider({ children }) {
  const { signer, account } = useWeb3();
  const [sdk, setSdk] = useState(null);
  const [isUGFEnabled, _setUGFEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage?.getItem(TOGGLE_KEY);
    return v === null ? true : v === "true";
  });

  useEffect(() => { loadSdk().then(setSdk); }, []);

  const setUGFEnabled = useCallback((next) => {
    _setUGFEnabled((prev) => {
      const v = typeof next === "function" ? next(prev) : next;
      try { window.localStorage?.setItem(TOGGLE_KEY, String(v)); } catch (_) {}
      return v;
    });
  }, []);

  const sdkReady = isUGFEnabled && Boolean(sdk?.openUGF || sdk?.useUGFModal);

  // Workhorse: encode the call, route through UGF when enabled, otherwise direct.
  const ugfExecute = useCallback(async (target, abi, fnName, args = [], opts = {}) => {
    if (!signer) throw new Error("Connect your wallet first");
    const iface = new ethers.Interface(abi);
    const data = iface.encodeFunctionData(fnName, args);
    const value = opts.value ?? 0n;
    const tx = { to: target, data, value };

    if (isUGFEnabled && sdk?.openUGF) {
      const result = await sdk.openUGF({
        signer,
        tx,
        destChainId: String(NETWORK_CHAIN_ID),
      });
      return result;
    }

    // Direct signer path — used when the SDK isn't loaded or the toggle is off.
    const sent = await signer.sendTransaction(tx);
    const receipt = await sent.wait();
    return receipt;
  }, [signer, isUGFEnabled, sdk]);

  // Cost preview — best-effort, returns null when SDK can't quote.
  const getQuote = useCallback(async (target, abi, fnName, args = [], opts = {}) => {
    try {
      if (!sdk?.getQuote) return null;
      const iface = new ethers.Interface(abi);
      const data = iface.encodeFunctionData(fnName, args);
      const tx = { to: target, data, value: opts.value ?? 0n };
      return await sdk.getQuote({ tx, destChainId: String(NETWORK_CHAIN_ID) });
    } catch (_) {
      return null;
    }
  }, [sdk]);

  // Activity feed — fire-and-forget POST. Backend may be offline; that's fine.
  const logTx = useCallback(async (payload) => {
    try {
      if (!BACKEND_URL) return;
      await fetch(`${BACKEND_URL}/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: NETWORK_CHAIN_ID,
          from: account || null,
          ...payload,
        }),
      });
    } catch (_) { /* swallow */ }
  }, [account]);

  const value = useMemo(() => ({
    isUGFEnabled,
    setUGFEnabled,
    sdkReady,
    ugfExecute,
    getQuote,
    logTx,
  }), [isUGFEnabled, setUGFEnabled, sdkReady, ugfExecute, getQuote, logTx]);

  return <UGFCtx.Provider value={value}>{children}</UGFCtx.Provider>;
}

export function useUGF() {
  const ctx = useContext(UGFCtx);
  if (!ctx) throw new Error("useUGF must be used inside UGFContextProvider");
  return ctx;
}

export default UGFContextProvider;
