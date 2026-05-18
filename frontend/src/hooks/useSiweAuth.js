import { useCallback, useState } from "react";
import { useWeb3 } from "../context/Web3Context";
import { BACKEND_URL } from "../config/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// useSiweAuth — pulls a fresh nonce from /api/auth/nonce, asks the connected
// wallet to sign "RealChain SIWE: <nonce>", and returns the headers a caller
// can include on a protected POST.
//
// Pattern:
//   const { signed, sign } = useSiweAuth();
//   const headers = await sign();        // { x-wallet-address, x-wallet-signature, x-wallet-nonce }
//   await fetch(url, { method: "POST", headers });
//
// The nonce is single-use, so call sign() once per protected request.
// ─────────────────────────────────────────────────────────────────────────────

export default function useSiweAuth() {
  const { account, signer } = useWeb3();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const sign = useCallback(async () => {
    if (!account || !signer) throw new Error("Connect a wallet first");
    setBusy(true); setError(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/auth/nonce?wallet=${account}`);
      if (!r.ok) throw new Error(`Nonce fetch failed: ${r.status}`);
      const { nonce, message } = await r.json();
      const signature = await signer.signMessage(message);
      return {
        "X-Wallet-Address": account,
        "X-Wallet-Signature": signature,
        "X-Wallet-Nonce": nonce,
      };
    } catch (e) {
      setError(e.message || "sign failed");
      throw e;
    } finally {
      setBusy(false);
    }
  }, [account, signer]);

  return { sign, busy, error };
}
