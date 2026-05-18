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
    _readProvider = new ethers.JsonRpcProvider(rpcUrl);
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

  // ── Check if local node is reachable ────────────────────────────────────────
  useEffect(() => {
    async function checkNode() {
      try {
        const rp = getReadProvider();
        await rp.getBlockNumber();
        setNodeOnline(true);
      } catch {
        setNodeOnline(false);
      }
    }
    checkNode();
  }, []);

  // ── Connect MetaMask ─────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("MetaMask not detected. Install it to interact with contracts.");
      return;
    }
    try {
      setConnecting(true);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const _provider = new ethers.BrowserProvider(window.ethereum);
      const _signer   = await _provider.getSigner();
      const _account  = await _signer.getAddress();
      const _network  = await _provider.getNetwork();
      setProvider(_provider);
      setSigner(_signer);
      setAccount(_account);
      setChainId(Number(_network.chainId));
    } catch (e) {
      if (e?.code === 4001) return; // User rejected — not an error
      setError(e.message || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, []);

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
        await connect();
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
  }, [connect]);

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

      await connect();
      return true;
    } catch (e) {
      if (e?.code === 4001) return; // User cancelled — not an error
      setError(e.message || "Failed to switch account");
      return false;
    }
  }, [connect]);

  // ── Fetch USDC balance ───────────────────────────────────────────────────────
  const refreshUsdcBalance = useCallback(async () => {
    if (!signer || !account) return;
    try {
      const usdc = new ethers.Contract(CONTRACT_ADDRESSES.mockUsdc, MOCK_USDC_ABI, signer);
      const bal  = await usdc.balanceOf(account);
      setUsdcBalance((Number(bal) / 1e6).toFixed(2));
    } catch (_) {}
  }, [signer, account]);

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
        setAccount(null);
        setSigner(null);
        setRoleHint(null);
      }
      else connect();
    };
    const onChain = (id) => setChainId(parseInt(id, 16));
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, [connect]);

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
  const fmtUsdc = (raw) => `$${(Number(raw) / 1e6).toFixed(2)}`;
  const fmtProp = (raw) => (Number(ethers.formatEther(raw))).toFixed(2);
  const fmtAddr = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
  const fmtInr  = (raw) => `₹${(Number(raw) / 100).toLocaleString("en-IN")}`;

  return (
    <Web3Context.Provider value={{
      provider, signer, account, chainId,
      isCorrectNetwork, usdcBalance, roleHint, connecting, error, nodeOnline,
      connect, refreshUsdcBalance, switchToExpectedNetwork, switchAccount,
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
