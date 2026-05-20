import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  CONTRACT_ADDRESSES, NETWORK_CHAIN_ID, LOCAL_RPC_URL, SEPOLIA_RPC_URL,
  MOCK_USDC_ABI, PROPERTY_FACTORY_ABI,
  PROPERTY_TOKEN_ABI, RENTAL_DISTRIBUTION_ABI, MARKETPLACE_ABI,
} from "../config/contracts";

const Web3Context = createContext(null);

// ─── Read-only provider (no MetaMask needed — for browsing properties) ────────
// Falls back gracefully if Hardhat node isn't running
let _readProvider = null;
function getReadProvider() {
  if (!_readProvider) {
    const rpcUrl = NETWORK_CHAIN_ID === 84532
      ? import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
      : LOCAL_RPC_URL;
    _readProvider = new ethers.JsonRpcProvider(rpcUrl, NETWORK_CHAIN_ID, { staticNetwork: true });
  }
  return _readProvider;
}

export function Web3Provider({ children }) {
  const [provider, setProvider]       = useState(null);
  const [signer, setSigner]           = useState(null);
  const [account, setAccount]         = useState(null);
  const [chainId, setChainId]         = useState(null);
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [roleHint, setRoleHint]       = useState(null);
  const [connecting, setConnecting]   = useState(false);
  const [error, setError]             = useState(null);
  const [nodeOnline, setNodeOnline]   = useState(null); // null = checking, true/false

  const isCorrectNetwork = chainId === NETWORK_CHAIN_ID;

  function getExpectedNetworkConfig() {
    if (NETWORK_CHAIN_ID === 31337) {
      return {
        chainIdHex: "0x7a69",
        params: {
          chainId: "0x7a69",
          chainName: "Hardhat Local",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [LOCAL_RPC_URL],
        },
      };
    }

    if (NETWORK_CHAIN_ID === 11155111) {
      return {
        chainIdHex: "0xaa36a7",
        params: {
          chainId: "0xaa36a7",
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [SEPOLIA_RPC_URL],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        },
      };
    }

    if (NETWORK_CHAIN_ID === 84532) {
      return {
        chainIdHex: "0x14a34",
        params: {
          chainId: "0x14a34",
          chainName: "Base Sepolia",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"],
          blockExplorerUrls: ["https://sepolia.basescan.org"],
        },
      };
    }

    return {
      chainIdHex: `0x${NETWORK_CHAIN_ID.toString(16)}`,
      params: null,
    };
  }

  // ── Check if the read RPC is reachable ──────────────────────────────────────
  // We re-check every 15 s while the node is down so the UI recovers
  // automatically the moment a local Hardhat node comes back up (or a flaky
  // public RPC stops timing out). When healthy, we stop polling.
  useEffect(() => {
    let alive = true;
    let timer = null;

    async function checkNode() {
      try {
        const rp = getReadProvider();
        await rp.getBlockNumber();
        if (!alive) return;
        setNodeOnline(true);
      } catch {
        if (!alive) return;
        setNodeOnline(false);
        // Reset the cached provider so the next attempt builds a fresh one.
        // ethers caches a "could not detect network" failure and refuses to
        // send further requests on the same instance.
        _readProvider = null;
        timer = setTimeout(checkNode, 15_000);
      }
    }

    checkNode();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);

  // ── Connect MetaMask ─────────────────────────────────────────────────────────
  const hydrateWallet = useCallback(async (ethereum = window.ethereum) => {
    const _provider = new ethers.BrowserProvider(ethereum);
    const _signer   = await _provider.getSigner();
    const _account  = await _signer.getAddress();
    const _network  = await _provider.getNetwork();
    setProvider(_provider);
    setSigner(_signer);
    setAccount(_account);
    setChainId(Number(_network.chainId));
    return { provider: _provider, signer: _signer, account: _account, chainId: Number(_network.chainId) };
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("MetaMask not detected. Install it to interact with contracts.");
      return;
    }
    try {
      setConnecting(true);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await hydrateWallet(window.ethereum);
    } catch (e) {
      if (e?.code === 4001) return; // User rejected — not an error
      setError(e.message || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, [hydrateWallet]);

  useEffect(() => {
    if (!window.ethereum) return undefined;
    let alive = true;
    (async () => {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (!alive || !accounts?.length) return;
        await hydrateWallet(window.ethereum);
      } catch {
        // Silent restore failure should not block read-only browsing.
      }
    })();
    return () => { alive = false; };
  }, [hydrateWallet]);

  // ── Switch MetaMask to configured project network ─────────────────────────
  const switchToExpectedNetwork = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("MetaMask not detected. Install it to interact with contracts.");
      return false;
    }

    const target = getExpectedNetworkConfig();

    try {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: target.chainIdHex }],
        });
      } catch (switchErr) {
        // 4902 = chain not added in MetaMask yet
        if (switchErr?.code === 4902 && target.params) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [target.params],
          });
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: target.chainIdHex }],
          });
        } else {
          throw switchErr;
        }
      }

      // Refresh signer/account/network state after successful switch
      if (window.ethereum.selectedAddress) {
        await hydrateWallet(window.ethereum);
      } else {
        const _provider = new ethers.BrowserProvider(window.ethereum);
        const _network  = await _provider.getNetwork();
        setChainId(Number(_network.chainId));
      }

      return true;
    } catch (e) {
      setError(e.message || "Failed to switch network");
      return false;
    }
  }, [hydrateWallet]);

  // ── Prompt MetaMask account picker for role switching in demos ───────────
  const switchAccount = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("MetaMask not detected. Install it to interact with contracts.");
      return false;
    }

    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });

      await hydrateWallet(window.ethereum);
      return true;
    } catch (e) {
      if (e?.code === 4001) return; // User cancelled — not an error
      setError(e.message || "Failed to switch account");
      return false;
    }
  }, [hydrateWallet]);

  // ── Disconnect — clears local state (MetaMask has no programmatic disconnect) ─
  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setUsdcBalance("0");
    setRoleHint(null);
    setError(null);
  }, []);

  // ── Fetch USDC balance ───────────────────────────────────────────────────────
  const refreshUsdcBalance = useCallback(async () => {
    if (!signer || !account) return;
    if (!isCorrectNetwork) {
      setUsdcBalance("0");
      return;
    }
    try {
      const usdc = new ethers.Contract(CONTRACT_ADDRESSES.mockUsdc, MOCK_USDC_ABI, signer);
      const bal  = await usdc.balanceOf(account);
      setUsdcBalance((Number(bal) / 1e6).toFixed(2));
    } catch (_) {}
  }, [signer, account, isCorrectNetwork]);

  // ── Derive current demo role from on-chain property ownership ──────────────
  const refreshRoleHint = useCallback(async () => {
    if (!account) {
      setRoleHint(null);
      return;
    }

    if (!isCorrectNetwork) {
      setRoleHint("Unknown");
      return;
    }

    try {
      const runner = signer || getReadProvider();
      const factory = new ethers.Contract(
        CONTRACT_ADDRESSES.propertyFactory,
        PROPERTY_FACTORY_ABI,
        runner
      );

      const count = Number(await factory.getPropertiesCount());
      const me = account.toLowerCase();
      let ownsAnyProperty = false;

      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        const propertyOwner = (p.owner || "").toLowerCase();
        if (propertyOwner === me) {
          ownsAnyProperty = true;
          break;
        }
      }

      setRoleHint(ownsAnyProperty ? "Owner" : "Investor");
    } catch (_) {
      setRoleHint("Unknown");
    }
  }, [account, isCorrectNetwork, signer]);

  useEffect(() => { refreshUsdcBalance(); }, [refreshUsdcBalance]);
  useEffect(() => { refreshRoleHint(); }, [refreshRoleHint]);

  // ── MetaMask event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accounts) => {
      if (accounts.length === 0) {
        setProvider(null);
        setAccount(null);
        setSigner(null);
        setChainId(null);
        setUsdcBalance("0");
        setRoleHint(null);
      }
      else hydrateWallet(window.ethereum).catch((e) => setError(e.message || "Connection failed"));
    };
    const onChain = (id) => setChainId(parseInt(id, 16));
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, [hydrateWallet]);

  // ── Contract getters (read-write — requires MetaMask) ───────────────────────
  const getFactory = () =>
    signer ? new ethers.Contract(CONTRACT_ADDRESSES.propertyFactory, PROPERTY_FACTORY_ABI, signer) : null;

  const getUsdc = () =>
    signer ? new ethers.Contract(CONTRACT_ADDRESSES.mockUsdc, MOCK_USDC_ABI, signer) : null;

  const getPropertyContracts = (addresses) => ({
    token:  new ethers.Contract(addresses.propertyToken,      PROPERTY_TOKEN_ABI,      signer),
    rental: new ethers.Contract(addresses.rentalDistribution, RENTAL_DISTRIBUTION_ABI, signer),
    market: new ethers.Contract(addresses.marketplace,        MARKETPLACE_ABI,         signer),
  });

  // ── Read-only contract getters (no MetaMask needed — for browsing) ──────────
  const getReadFactory = () =>
    new ethers.Contract(CONTRACT_ADDRESSES.propertyFactory, PROPERTY_FACTORY_ABI, getReadProvider());

  const getReadPropertyContracts = (addresses) => ({
    token:  new ethers.Contract(addresses.propertyToken,      PROPERTY_TOKEN_ABI,      getReadProvider()),
    rental: new ethers.Contract(addresses.rentalDistribution, RENTAL_DISTRIBUTION_ABI, getReadProvider()),
    market: new ethers.Contract(addresses.marketplace,        MARKETPLACE_ABI,         getReadProvider()),
  });

  // ── Format helpers ───────────────────────────────────────────────────────────
  // Every formatter must survive being handed `undefined`, `null`, `NaN`, an
  // empty string, or a BigInt. The UI calls these inside render paths where a
  // single NaN would otherwise leak as the literal text "NaN" on a card.
  const toFiniteNumber = (raw, fallback = 0) => {
    if (raw === null || raw === undefined || raw === "") return fallback;
    // BigInt -> Number is safe for the magnitudes we deal with here (paisa,
    // USDC 6-decimals, etc.). The actual on-chain BigInts that exceed
    // Number.MAX_SAFE_INTEGER are token quantities, which use fmtProp().
    const n = typeof raw === "bigint" ? Number(raw) : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  const fmtUsdc = (raw) => `$${(toFiniteNumber(raw) / 1e6).toFixed(2)}`;
  const fmtProp = (raw) => {
    try { return Number(ethers.formatEther(raw ?? 0n)).toFixed(2); }
    catch { return "0.00"; }
  };
  const fmtAddr = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
  const fmtInr  = (raw) => `₹${(toFiniteNumber(raw) / 100).toLocaleString("en-IN")}`;

  return (
    <Web3Context.Provider value={{
      provider, signer, account, chainId,
      isCorrectNetwork, usdcBalance, roleHint, connecting, error, nodeOnline,
      connect, refreshUsdcBalance, switchToExpectedNetwork, switchAccount, disconnect,
      // Read-write (MetaMask required)
      getFactory, getUsdc, getPropertyContracts,
      // Read-only (no MetaMask — for browsing)
      getReadFactory, getReadPropertyContracts,
      fmtUsdc, fmtProp, fmtAddr, fmtInr,
    }}>
      {children}
    </Web3Context.Provider>
  );
}

export const useWeb3 = () => {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used inside Web3Provider");
  return ctx;
};
