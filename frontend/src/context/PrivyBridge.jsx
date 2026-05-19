// ─────────────────────────────────────────────────────────────────────────────
// PrivyBridge — Tier 3 / Task 6.1: embedded-wallet onboarding for users who
// have no MetaMask or other injected provider.
//
// Design goals
// ────────────
// 1. Zero impact when `VITE_PRIVY_APP_ID` is not set. `<PrivyShell>` becomes a
//    no-op pass-through, so the app boots identically to today's MetaMask-only
//    flow. This is critical because the hackathon judges may run the demo
//    without a Privy app ID.
// 2. Zero changes to `Web3Context.jsx`. When the Privy embedded wallet is
//    ready, we mount it onto `window.ethereum` (the very property the existing
//    `Web3Context.connect()` already calls). That keeps the 260-line Web3
//    surface untouched and means every component that already works with
//    MetaMask (Owner/Investor dashboards, UGF wrapper, marketplace, faucet)
//    works with the embedded wallet for free.
// 3. The "Or continue with email/Google" CTA on `Landing.jsx` consumes
//    `usePrivyEmbeddedSignIn()`. When `enabled === false` (no app ID), the
//    landing page just hides the button — no errors, no half-broken UI.
//
// Dependencies
// ────────────
//   @privy-io/react-auth  (^1.x — installed by `npm install` in `frontend/`)
//
// To activate, add to `frontend/.env`:
//   VITE_PRIVY_APP_ID=clxxxxxxxxxxxxxxxxxxxxxxxx
//
// Spec reference: tasks.md § 6.1; requirements.md § 14.1–14.4.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || "";
const PRIVY_ENABLED = Boolean(PRIVY_APP_ID);

// Load `@privy-io/react-auth` only when a Privy app id is configured. Keeping
// this import inside a function avoids top-level await and still lets Vite
// build when the optional package is absent.
let privyModulePromise = null;
function loadPrivyModule() {
  if (!privyModulePromise) {
    const specifier = "@privy" + "-io/react-auth";
    privyModulePromise = import(/* @vite-ignore */ specifier);
  }
  return privyModulePromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge context — what Landing.jsx (and anything else) consumes
// ─────────────────────────────────────────────────────────────────────────────

const PrivyBridgeContext = createContext({
  enabled:        false,
  ready:          true,
  authenticated:  false,
  address:        null,
  login:          async () => {},
  logout:         async () => {},
});

export function usePrivyEmbeddedSignIn() {
  return useContext(PrivyBridgeContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner bridge — only mounted when Privy is enabled AND the SDK loaded.
// Lives _inside_ <PrivyProvider> so it can call usePrivy()/useWallets().
// Its job: when the embedded wallet exists, expose its EIP-1193 provider as
// `window.ethereum` so the existing Web3Context.connect() picks it up.
// ─────────────────────────────────────────────────────────────────────────────

function PrivyInnerBridge({ children, privyModule }) {
  const { usePrivy, useWallets } = privyModule;
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();

  const embedded = useMemo(
    () => wallets.find((w) => w.walletClientType === "privy") || null,
    [wallets],
  );

  // Mount the embedded wallet onto window.ethereum once it is available.
  useEffect(() => {
    if (!embedded) return;
    let cancelled = false;
    (async () => {
      try {
        const eip1193 = await embedded.getEthereumProvider();
        if (cancelled || !eip1193) return;
        // Only replace window.ethereum if there isn't already an injected
        // provider (e.g. MetaMask). If MetaMask is present we let the user
        // keep using it — Privy is the _fallback_ onboarding, not a takeover.
        if (typeof window !== "undefined" && !window.ethereum) {
          window.ethereum = eip1193;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[PrivyBridge] Failed to expose embedded wallet:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [embedded]);

  const address = embedded?.address || user?.wallet?.address || null;

  const value = useMemo(
    () => ({
      enabled:       true,
      ready,
      authenticated: Boolean(authenticated),
      address,
      login,
      logout,
    }),
    [ready, authenticated, address, login, logout],
  );

  return (
    <PrivyBridgeContext.Provider value={value}>
      {children}
    </PrivyBridgeContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public shell — mount this at the top of main.jsx.
// ─────────────────────────────────────────────────────────────────────────────

export function PrivyShell({ children }) {
  const [privyModule, setPrivyModule] = useState(null);

  useEffect(() => {
    if (!PRIVY_ENABLED) return undefined;
    let cancelled = false;
    loadPrivyModule()
      .then((module) => {
        if (!cancelled) setPrivyModule(module);
      })
      .catch((err) => {
        if (cancelled) return;
        // The user set VITE_PRIVY_APP_ID but forgot to `npm install`.
        // Surface a clear console warning and degrade to no-op.
        // eslint-disable-next-line no-console
        console.warn(
          "[PrivyBridge] VITE_PRIVY_APP_ID is set but @privy-io/react-auth is not " +
          "installed. Run `npm install` in frontend/. Embedded wallet disabled.",
          err,
        );
        setPrivyModule(null);
      });
    return () => { cancelled = true; };
  }, []);

  // Fast path: Privy disabled. Render children untouched.
  if (!PRIVY_ENABLED || !privyModule) {
    return children;
  }

  const { PrivyProvider } = privyModule;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Loginless onboarding for users with no wallet.
        loginMethods: ["email", "google", "wallet"],
        embeddedWallets: {
          // Create an embedded wallet automatically for email/Google users.
          createOnLogin: "users-without-wallets",
        },
        appearance: {
          theme:           "light",
          accentColor:     "#2dd1c1",
          showWalletLoginFirst: false,
        },
      }}
    >
      <PrivyInnerBridge privyModule={privyModule}>{children}</PrivyInnerBridge>
    </PrivyProvider>
  );
}
