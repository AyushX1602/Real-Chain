# Design — Hackathon Zero-ETH Claim

> **Status**: Draft for review.
> **Authoritative companion**: [`implementation_plan.md`](../../../implementation_plan.md). This design document explains *how* each surface in that plan is built; the plan owns *what* and *in what order*. They must stay consistent.
> **Scope**: UGF Hackathon submission (Track 3 — Wallet & Agents) — the user-facing dApp on Base Sepolia. Out of scope: V1/V2 distribution research, snapshot-attack analysis, any contract changes other than the optional Tier 3 `ClaimReceipt.sol`.

## Overview

### Goal — the hackathon north star

An investor wallet with **0 ETH** opens RealChain on Base Sepolia, clicks one button, receives their USDC rent payment, and never touches ETH at any point. UGF settles gas in `TYI_MOCK_USD`. The whole demo runs in 60 seconds.

### Tiered build philosophy

The submission is staged in three tiers that ship strictly in order:

| Tier | Scope | Gate to next tier |
|------|-------|-------------------|
| **Tier 1 — Mandatory** | Base Sepolia deploy, role-based dashboards, UGF-wrapped `claimAll()`, demo recording. Covers the hackathon spec floor. | Phase 4A E2E test passes. |
| **Tier 2 — Differentiators** | Wrap all four state-changing flows, UGF on/off toggle, activity feed, side-by-side cost banner, "Claim Rent" rename, faucet helper, brand pass. | 5A + 5B + 5C + 5D + 5E green. |
| **Tier 3 — Stretch** | Embedded wallet (Privy / Web3Auth), soulbound NFT receipts, pitch video, live demo URL. | n/a. |

This design covers all three tiers in one document so contributors can see how Tier 1 surfaces extend into Tier 2 and Tier 3, but every component is tagged with the tier that authorizes it.

### Hard constraints

| # | Constraint | Source |
|---|------------|--------|
| C1 | Network is Base Sepolia (chain id `84532`). | `hackathon_ps.pdf`, `hardhat.config.js` |
| C2 | Gas is settled in UGF's `TYI_MOCK_USD`, not ETH. | `hackathon_ps.pdf` |
| C3 | Core Solidity contracts and the existing 31 Hardhat tests stay unchanged through Tier 1 + Tier 2. Only Tier 3 (Phase 6B `ClaimReceipt.sol`) introduces a new contract. | `implementation_plan.md`, `memory/decisions.md` |
| C4 | The V1/V2 distribution comparison and snapshot-attack research surface stays in the repo for the academic paper, but is **not** surfaced in any judge-facing flow (README, demo, pitch). | `memory/decisions.md` 2026-05-18 |
| C5 | Two distinct "Mock USD" tokens exist and must not be conflated. Our `MockUSDC` is the **rent settlement** currency; UGF's `TYI_MOCK_USD` is the **gas settlement** currency. UI copy must keep them visually distinct. | `memory/decisions.md` 2026-05-18 |
| C6 | Tiers ship in order. Tier 2 (Phase 5) is gated on Phase 4A passing end-to-end. Tier 3 (Phase 6) is gated on 5A + 5B + 5C + 5D + 5E being green. | `implementation_plan.md`, `AGENTS.md` |
| C7 | UGF SDK API surface is moving — code against the live `@tychilabs/react-ugf` README, not internal notes. | `AGENTS.md` |

### Non-goals

- Production KYC / AML.
- Real USDC settlement (we keep MockUSDC).
- A new tokenomics or distribution model.
- Anything that requires re-deploying the existing contracts during Tier 1 + Tier 2.

## Architecture

### Tier-gated architecture map

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     RealChain v2 — Hackathon Architecture                    │
│                                                                              │
│  Tier 1 (Mandatory):       solid blocks                                      │
│  Tier 2 (Differentiators): dotted blocks                                     │
│  Tier 3 (Stretch):         dashed blocks                                     │
└──────────────────────────────────────────────────────────────────────────────┘

         ┌────────────────────────────────────────────────────────┐
         │            Base Sepolia (chain id 84532)               │
         │                                                        │
         │  MockUSDC ── PropertyToken ── RentalDistribution(V1)   │
         │      │           │                  │                  │
         │      └─── Marketplace ──────────────┘                  │
         │                                                        │
         │   - - -  ClaimReceipt.sol (T3 / 6B, soulbound NFT)     │
         └────────────────────────────────────────────────────────┘
                              ▲                       ▲
            UGF relay         │                       │ ethers.js
            (sponsored gas)   │                       │ (read-only +
                              │                       │  signed tx)
         ┌────────────────────┴───┐         ┌─────────┴──────────┐
         │   UGF Service Layer    │         │   ethers JsonRpc / │
         │  (TYI_MOCK_USD as gas) │         │   BrowserProvider  │
         └────────┬───────────────┘         └─────────┬──────────┘
                  │                                   │
                  ▼                                   ▼
         ┌────────────────────────────────────────────────────────┐
         │                  Frontend (React + Vite)               │
         │                                                        │
         │   ┌──────────────┐    ┌──────────────────────────┐     │
         │   │ Web3Context  │    │ UGFContext (T1 / Phase 3)│     │
         │   │ (existing,   │    │  - openUGF()             │     │
         │   │  unchanged)  │    │  - ugfExecute()          │     │
         │   │              │    │  - getQuote()            │     │
         │   │              │    │  - isUGFEnabled  (T2 / 5B)     │
         │   └──────┬───────┘    └─────────┬────────────────┘     │
         │          │                      │                      │
         │          ▼                      ▼                      │
         │   ┌─────────────────────────────────────┐              │
         │   │    Role-aware routing (App.jsx)     │              │
         │   └─────┬─────────────────────────┬─────┘              │
         │         ▼                         ▼                    │
         │   ┌────────────┐           ┌──────────────────┐        │
         │   │ Owner      │           │ Investor         │        │
         │   │ Dashboard  │           │ Dashboard        │        │
         │   │ (T1 / 2A)  │           │ (T1 / 2B)        │        │
         │   └─────┬──────┘           └────────┬─────────┘        │
         │         │                           │                  │
         │   ┌─────▼────────┐           ┌──────▼────────┐         │
         │   │ Cost banner  │           │ Cost banner   │         │
         │   │ (T2 / 5D)    │           │ (T2 / 5D)     │         │
         │   └──────────────┘           └───────────────┘         │
         │                                                        │
         │   - - -  Embedded wallet (Privy/Web3Auth)              │
         │   - - -  (T3 / 6A)                                     │
         └────────────────────────────────────────────────────────┘
                              │ POST /api/transactions
                              ▼ GET  /api/transactions
         ┌────────────────────────────────────────────────────────┐
         │       Backend (Express, port 5000) — already exists    │
         │                                                        │
         │   ┌────────────────────┐   ┌──────────────────────┐    │
         │   │ Activity feed API  │   │ MongoDB (Atlas M0)   │    │
         │   │   (T2 / 5C wires)  │◄──┤ Transaction model    │    │
         │   └────────────────────┘   └──────────────────────┘    │
         └────────────────────────────────────────────────────────┘

         ┌────────────────────────────────────────────────────────┐
         │       Off-chain tooling (scripts/)                     │
         │                                                        │
         │   scripts/deploy.js      (T1 / 1B, existing)           │
         │   scripts/seedDemo.js    (T1 / 1E, NEW)                │
         └────────────────────────────────────────────────────────┘
```

### Settlement-token model (MUST be visible everywhere)

Two tokens, two distinct roles. The UI must never let a user think they're the same thing.

| Token | Symbol shown | Decimals | Role | Held in | UI label |
|-------|--------------|---------:|------|---------|----------|
| Our `MockUSDC` (deployed by us per `deploy.js`) | `USDC` | 6 | **Rent settlement.** All RealChain contracts already speak this. Owner deposits rent in this; investor receives rent in this. | Investor + Owner wallets, `RentalDistribution` escrow | "Receive USDC" / "Pay rent in USDC" |
| UGF `TYI_MOCK_USD` (UGF-managed on Base Sepolia) | `Mock USD` | per UGF docs | **Gas settlement.** UGF debits this from the user when sponsoring a transaction. | Investor + Owner wallets only | "Pay gas in Mock USD" |

Component-level rule: any component that displays a price in USD MUST take a discriminator (`token: "usdc" | "mockUsd"`) so badge styling and copy can branch. The tokens are never compared, summed, or treated as fungible in business logic.

Failure mode to avoid: writing a single `formatUsd(amount)` helper that hides which token is being shown. We already have `fmtUsdc` in `Web3Context`; we add a separate `fmtMockUsd` (with a different unicode badge / color in CSS) and use it for every gas figure UGF returns.

### Tier ordering rule (enforced)

Anything past row 16 in the component inventory below must not be touched until row 15 is checked off. Anything past row 27 must not be touched until rows 17–25 are checked off. This is the operational form of constraint **C6**.

## Components and Interfaces

### Component inventory

Each row links a deliverable to the `implementation_plan.md` task that produces it.

| # | Component | Type | Path | Tier / Phase | New / Modify |
|---|-----------|------|------|--------------|--------------|
| 1 | `hardhat.config.js` baseSepolia | Config | `hardhat.config.js` | T1 / 1A | Already done; verify |
| 2 | Base Sepolia deployment | Artifact | `deployed-addresses.json` | T1 / 1B | New |
| 3 | Frontend network config | Config | `frontend/src/config/contracts.js` | T1 / 1C | Modify |
| 4 | `Web3Context` baseSepolia branch | Code | `frontend/src/context/Web3Context.jsx` | T1 / 1D | Modify |
| 5 | Demo seed script | Code | `scripts/seedDemo.js` | T1 / 1E | New |
| 6 | Convenience scripts | Config | `package.json` | T1 / 1F | Modify |
| 7 | OwnerDashboard page | Code | `frontend/src/pages/OwnerDashboard.jsx` | T1 / 2A | New |
| 8 | InvestorDashboard page | Code | `frontend/src/pages/InvestorDashboard.jsx` | T1 / 2B | New |
| 9 | Role-aware routing + navbar | Code | `frontend/src/App.jsx` | T1 / 2C | Modify |
| 10 | UGF SDK install | Dep | `frontend/package.json` | T1 / 3A | Modify |
| 11 | UGFContext wrapper | Code | `frontend/src/context/UGFContext.jsx` | T1 / 3B | New |
| 12 | UGFProvider mount | Code | `frontend/src/main.jsx` | T1 / 3B | Modify |
| 13 | UGF-wrapped claimAll | Code | `frontend/src/pages/InvestorDashboard.jsx` | T1 / 3C | Modify |
| 14 | Gas-in-Mock-USD badge | Code + CSS | `frontend/src/index.css`, `InvestorDashboard.jsx` | T1 / 3D | Modify |
| 15 | E2E demo verification | Manual | (test plan) | T1 / 4A | n/a |
| 16 | 60-sec demo recording | Asset | (video file) | T1 / 4B | New |
| 17 | Generic `ugfExecute` helper | Code | `frontend/src/context/UGFContext.jsx` | T2 / 5A.1 | Modify |
| 18 | Wrap depositRental | Code | `OwnerDashboard.jsx` | T2 / 5A.2 | Modify |
| 19 | Wrap buyFromOwner | Code | `frontend/src/pages/Property.jsx` | T2 / 5A.3 | Modify |
| 20 | Wrap buyFromListing + cancelListing | Code | `Property.jsx` (and `Portfolio.jsx` cancel) | T2 / 5A.4 | Modify |
| 21 | UGF on/off toggle | Code | `UGFContext.jsx`, navbar | T2 / 5B | Modify |
| 22 | Activity feed UI | Code | `frontend/src/components/ActivityFeed.jsx` (new), `Home.jsx` (mount) | T2 / 5C | New + Modify |
| 23 | Activity feed POST after tx | Code | `UGFContext.jsx` (success hook) | T2 / 5C | Modify |
| 24 | Side-by-side cost banner | Code | `frontend/src/components/CostBanner.jsx` (new), used by dashboards | T2 / 5D | New |
| 25 | "Dividends" → "Claim Rent" rename | Code | All visible strings | T2 / 5E | Modify |
| 26 | In-app faucet helper | Code | `frontend/src/components/FaucetPanel.jsx` (new), `Home.jsx` | T2 / 5F | New |
| 27 | Brand: name, logo, landing | Asset + Code | logo SVG, `Home.jsx` hero, `index.css` | T2 / 5G | New + Modify |
| 28 | Embedded wallet | Code | `Web3Context.jsx` accepts Privy signer | T3 / 6A | Modify |
| 29 | Soulbound `ClaimReceipt.sol` | Contract | `contracts/ClaimReceipt.sol` | T3 / 6B | New |
| 30 | Receipt mint hook in `RentalDistribution` | Contract change | `contracts/RentalDistribution.sol` | T3 / 6B | Modify (Tier 3 only) |
| 31 | Receipts gallery | Code | `InvestorDashboard.jsx` | T3 / 6B | Modify |
| 32 | Pitch video | Asset | `docs/pitch.mp4` (or external link) | T3 / 6C | New |
| 33 | Live demo URL | Deployment | Vercel / Netlify config | T3 / 6D | New |

### Tier 1 — UGFContext interface (Phase 3A–3B)

A new context that sits **alongside** `Web3Context`, not inside it. `Web3Context` stays UGF-unaware so the existing read paths are not destabilized.

```
frontend/src/context/UGFContext.jsx
─────────────────────────────────────
  imports from "@tychilabs/react-ugf":
    - UGFProvider (mounted in main.jsx)
    - useUGFModal (consumed inside our context to expose openUGF)

  state:
    isUGFEnabled: boolean       (default true; flipped by Tier 2 / 5B toggle)

  exposed API (via useUGF()):
    openUGF(opts)                                   ← thin pass-through to SDK
    ugfExecute(target, abi, fnName, args, opts?)    ← workhorse for T1 + T2
    getQuote(target, abi, fnName, args)             ← cost preview for T2 / 5D
    isUGFEnabled, setUGFEnabled                     ← drives T2 / 5B toggle
    logTx(txHash, type, amount, gasCostUsd)         ← T2 / 5C activity feed POST
```

Pseudocode — `ugfExecute`:

```js
async function ugfExecute(target, abi, fnName, args, opts = {}) {
  const { signer } = useWeb3();          // borrow signer; we do NOT take ownership
  const iface  = new ethers.Interface(abi);
  const data   = iface.encodeFunctionData(fnName, args);
  const value  = opts.value ?? 0n;

  if (!isUGFEnabled) {
    // Tier 2 toggle: bypass UGF, send via signer directly.
    const tx = await signer.sendTransaction({ to: target, data, value });
    return tx.wait();
  }

  return openUGF({
    signer,
    tx: { to: target, data, value },
    destChainId: "84532",
  });
}
```

Mounting (`main.jsx`):

```jsx
<UGFProvider>      {/* SDK provider */}
  <Web3Provider>
    <UGFContextProvider>     {/* our wrapper, exposes useUGF() */}
      <BrowserRouter><App /></BrowserRouter>
    </UGFContextProvider>
  </Web3Provider>
</UGFProvider>
```

Order matters: `UGFContextProvider` must sit inside `Web3Provider` so it can read `signer`.

### Tier 1 — UGF-wrapped claim flow (Phase 3C–3D)

`InvestorDashboard.jsx` claim handler:

```js
async function handleClaimAll(prop) {
  await ugfExecute(
    prop.rentalDistribution,
    RENTAL_DISTRIBUTION_ABI,
    "claimAll",
    [],
  );
  await refreshUsdcBalance();
  await refreshPending();   // local helper that re-reads pendingDividends
  // Tier 2 / 5C will fire-and-forget POST /api/transactions here
}
```

UI in Tier 1:

```jsx
<button className="btn btn-primary btn-full" onClick={() => handleClaimAll(prop)}>
  ⚡ Claim All Rent — {fmtUsdc(prop.pending)}
</button>
<span className="ugf-badge">💎 Gas paid in Mock USD — no ETH needed</span>
```

The badge is a single CSS class in `index.css`. Tier 2 / 5D enriches this row with the side-by-side cost banner.

### Tier 1 — Role split (Phase 2A–2C)

Both dashboards consume the existing `Web3Context` API. No new contract calls are introduced. Routes are added; existing routes keep working (backward compatibility for any team member's open links).

**`OwnerDashboard.jsx`** — route `/owner`
- Gate: `if (!account) → "Connect wallet"`. `if (roleHint !== "Owner") → redirect to /investor`.
- Data: iterate `factory.getPropertiesCount()`, filter `properties[i].owner === account`. For each owned property, show: name, location, total rent deposited (sum of epoch amounts), remaining unsold supply (= `100 - totalSupply()` of holders other than owner), most recent 5 epochs.
- Actions:
  - **Deposit Rental Income** form: amount in USDC. Two-tx in Tier 1 (`approve` then `depositRental`); Tier 2 wraps the second with UGF.
  - **Create New Property** button → calls `factory.createProperty(...)`.

**`InvestorDashboard.jsx`** — route `/investor`, the demo centerpiece
- Gate: `if (!account) → "Connect wallet"`.
- Hero: total pending dividends across all properties, formatted with `fmtUsdc`. Big number, center stage.
- Below the hero: per-property cards, one per property where `token.balanceOf(account) > 0`, each showing tokens held, ownership %, pending USDC.
- Primary action: **⚡ Claim All Rent** button. In Tier 1 / 3C, this calls `UGFContext.ugfExecute` (see UGFContext interface above). In Tier 2 / 5D, the cost banner sits beneath it.
- Secondary: link to `/property/:address` for each card, link to `Home.jsx` to browse other properties.

**`App.jsx`**
- New routes: `/owner`, `/investor`.
- Navbar logic:
  - Not connected → `[Connect Wallet]`.
  - Connected as Owner → `[Dashboard → /owner]` plus existing links.
  - Connected as Investor → `[Dashboard → /investor]` plus existing links.
- Remove the "Switch Account" button from the nav (kept inside `Web3Context.switchAccount` if needed, but unmounted from main nav).

Backward compatibility: existing `/`, `/property/:address`, `/portfolio`, `/dividends` routes keep working unchanged. The role-specific dashboards are *additive*. Tier 2 / 5E later replaces the `/dividends` label.

### Tier 1 — Network config (Phase 1A–1D)

`hardhat.config.js` already has a `baseSepolia` block. The remaining changes are confined to the frontend.

`frontend/src/config/contracts.js`:
- Replace `NETWORK_CHAIN_ID = 31337` with `84532` (or keep an env-driven toggle if local hardhat is still needed for development — see Open Questions).
- Add `BASE_SEPOLIA_RPC_URL = "https://sepolia.base.org"`.
- After Phase 1B, replace `CONTRACT_ADDRESSES.mockUsdc` and `propertyFactory` with the deployed Base Sepolia addresses from `deployed-addresses.json`.

`Web3Context.jsx` (`getExpectedNetworkConfig`):
- Add a `NETWORK_CHAIN_ID === 84532` branch returning `{ chainIdHex: "0x14a34", params: { ... Base Sepolia ... } }` so MetaMask "Add network" works inline.
- `getReadProvider()` swaps `LOCAL_RPC_URL` for `BASE_SEPOLIA_RPC_URL` when `NETWORK_CHAIN_ID === 84532`.

No other `Web3Context` method needs to change. The public surface (`getReadFactory`, `getPropertyContracts`, `roleHint`, `usdcBalance`, etc.) is preserved.

### Tier 1 — Demo-state seeding (Phase 1E)

This is the silent failure mode of the demo: a wallet that on demo day has the wrong combination of (PROP, USDC, pending dividends, ETH). One script must produce a deterministic state every time.

`scripts/seedDemo.js`:

```
Inputs (from .env):
  PRIVATE_KEY                     deployer (= property owner in seeded state)
  DEMO_INVESTOR_PRIVATE_KEY       wallet judges will see
  BASE_SEPOLIA_RPC_URL

Reads:
  deployed-addresses.json         from Phase 1B

Steps:
  1. Connect deployer wallet, load Factory + MockUSDC.
  2. For each property in factory.getPropertiesCount():
       a. Approve marketplace to spend deployer's PROP supply.
  3. Mint 1,000 USDC to demo investor wallet via MockUSDC.mint.
  4. Sign as demo investor → Marketplace.buyFromOwner(propertyId, 30 PROP)
     for property #0 (so investor holds 30% of one property).
  5. Sign as deployer → MockUSDC.approve(rentalDistribution, 1000 USDC)
                     → RentalDistribution.depositRental(1000 USDC)
     This creates one unclaimed epoch with 300 USDC pending for the investor.
  6. (Optional) sweep demo investor's ETH balance to a dust-address so the
     wallet truly has ETH = 0. Only do this if BASE_SEPOLIA_GAS_DUST_ADDRESS
     is set in .env; otherwise just log "ETH balance ≠ 0, manual sweep needed".

Outputs (printed at end):
  ┌────── Demo investor wallet ──────┐
  │ Address:           0x...         │
  │ ETH balance:       0.0           │
  │ USDC balance:      700.00        │  (1000 minted - 300 spent on PROP)
  │ PROP balance:      30 of 100     │  (property #0)
  │ Pending dividends: 300.00 USDC   │
  └──────────────────────────────────┘
```

The script must be idempotent: re-running it should detect "already seeded" (e.g. demo investor already holds tokens) and skip rather than double-buy.

### Tier 2 — Wrap all four state-changing flows (5A)

`ugfExecute` (5A.1) is already in place from Tier 1. The remaining work is binding it everywhere a state-changing call happens.

| Flow | Component | Function | New code path |
|------|-----------|----------|---------------|
| Owner deposits rent (5A.2) | `OwnerDashboard.jsx` | `depositRental(amount)` | After `usdc.approve(...)`, replace `rental.depositRental(amount)` with `ugfExecute(rentalAddr, RENTAL_DISTRIBUTION_ABI, "depositRental", [amount])`. |
| Investor primary buy (5A.3) | `Property.jsx` | `buyFromOwner(amount)` | Same pattern, on `Marketplace`. |
| Investor secondary buy (5A.4) | `Property.jsx` | `buyFromListing(id)` | Same. |
| Cancel listing (5A.4) | `Portfolio.jsx` | `cancelListing(id)` | Same. |

ERC-20 `approve` calls: in Tier 2 we keep them as direct (non-UGF) signer calls *for now*, because they fit on a single MetaMask popup and are cheap. If a judge insists on truly-zero-ETH end-to-end, we can wrap `approve` too in Tier 2 polish — same `ugfExecute` shape, just on the `MockUSDC` contract. Document this decision in `memory/decisions.md` once made.

### Tier 2 — UGF on/off toggle (5B)

A switch lives in the navbar settings (or a small gear icon dropdown). Wired to `isUGFEnabled` on `UGFContext`. When toggled OFF:
- All `ugfExecute` calls fall through to a direct `signer.sendTransaction`.
- The "💎 Gas paid in Mock USD" badge is replaced with "⚠️ Gas paid in ETH".
- The cost banner (5D) shows only the "without UGF" column highlighted.

The judging payoff: with the toggle OFF, claim fails (the demo wallet has 0 ETH); flip ON, succeeds. Ten seconds of unmissable proof.

### Tier 2 — Activity feed (5C)

The backend at `backend/routes/transactions.js` already exposes the right schema (`gasMethod: "eth"|"ugf"`, `gasCostUsd`, `from`, `txHash`, `type`, `amount`). No backend changes needed beyond verifying the routes work against the deployed Atlas instance.

Frontend additions:

`frontend/src/components/ActivityFeed.jsx` (new):
- Polls `GET /api/transactions?limit=20` every 8s using `setInterval`.
- Renders rows: `<wallet short> <verb> <amount> <gasBadge> <relativeTime>`.
- Verb mapping: `claim → "claimed"`, `buy → "bought tokens"`, `deposit → "deposited rent"`.
- Gas badge: green "💎 gasless via UGF" or grey "🛢 gas in ETH".

Mount on `Home.jsx` as a right-rail panel (Tier 2 / 5G brand pass may move it into the hero).

Posting after a UGF tx — a small helper `logTx` on `UGFContext.jsx` runs after `ugfExecute` resolves successfully and POSTs to `/api/transactions`. Backend has `requireDb` middleware that returns 503 when MongoDB is offline; the frontend swallows that error so the tx UX is never blocked by the activity feed.

### Tier 2 — Side-by-side cost banner (5D)

A new `<CostBanner />` component sits beneath every UGF-powered button:

```
┌──────────────────────────────────────────────────────────────┐
│ Without UGF │  ~$3.50 in ETH    │ ✗ you have 0 ETH          │
│ With UGF    │  ~$0.04 Mock USD  │ ✓ paid from your balance  │
└──────────────────────────────────────────────────────────────┘
```

Inputs:
- "Without UGF" estimate: `provider.estimateGas(tx)` × `feeData.gasPrice`, converted to USD via a hardcoded ETH/USD rate (or pulled from a public price feed; for the hackathon a constant is fine).
- "With UGF" estimate: `getQuote(...)` from `UGFContext`, returned by the SDK.

The banner is purely presentational; toggling 5B does not change the numbers, only which row is highlighted.

### Tier 2 — Rename "Dividends" → "Claim Rent" (5E)

User-visible string sweep:
- Navbar link.
- Page title in `Dividends.jsx`.
- All button labels.
- README screenshots.

Routes stay (`/dividends` route still resolves) so links don't break, but every visible label reads "Claim Rent" / "Rent History".

### Tier 2 — In-app faucet helper (5F)

A `<FaucetPanel />` shown on `Home.jsx` only when:
- `usdcBalance === 0` AND `propBalance === 0` (cold-start judge), OR
- The user clicks a small "Need test funds?" link in the navbar.

Three buttons:
1. **Get Mock USD for gas** → opens `https://universalgasframework.com/faucets` in a new tab.
2. **Mint 100 USDC for me** → calls `MockUSDC.mint(account, 100_000000n)` *signed by the deployer key*. To make this safe, expose a backend route `POST /api/faucet/usdc` that holds the deployer key server-side and rate-limits to one request per wallet per hour. Frontend just calls the backend.
3. **Drop me into demo investor wallet** → reveals the demo wallet's mnemonic in a copy-to-clipboard box (only when `NODE_ENV=development` or `?demo=1` is in the URL — never in a public deploy).

Phase 1E (`seedDemo.js`) must run before button 3 is useful.

### Tier 2 — Brand pass (5G)

Hackathon scoring is partly aesthetic. Concrete deliverables:
- Project name candidate: **"RentBox"** with tagline *"Claim your rent, never touch ETH."* — final name TBD by team.
- Logo: 1 SVG, ≤ 5 KB, mounted in the navbar.
- One-screen landing on `/` for non-connected users: hero (tagline), 3 feature pills (Zero-ETH claim / Buy fractional property / Earn USDC rent), `[Connect Wallet]` CTA.
- Color discipline: pick one accent, use it consistently. Existing CSS already has dark + glassmorphism — keep that.

### Tier 3 — Embedded wallet (6A)

Goal: email-only login → smart wallet → UGF claim, with no MetaMask installed.

Surface: `Web3Context` is generalized to accept either a MetaMask `signer` or a Privy `signer`. The rest of the app does not care which it is.

```
Web3Context (generalized in T3)
  - connect()           → falls through to Privy if window.ethereum is missing
  - getSigner()         → returns whichever provider produced a signer
  - account, chainId    → unchanged
```

Caveat: Privy embedded wallets on Base Sepolia must be funded with `TYI_MOCK_USD` for UGF to work. The faucet helper (5F) covers this.

### Tier 3 — Soulbound NFT claim receipt (6B)

A new `contracts/ClaimReceipt.sol` (ERC-721 with `_update` overridden to revert on transfer when `from != address(0)` and `to != address(0)`). Mint authority = the relevant `RentalDistribution`.

`RentalDistribution._claim` is modified to call `ClaimReceipt.mint(user, epochIndex, amount)` after the USDC transfer. **This requires re-deploying `RentalDistribution`** — which means re-deploying every property's distribution contract, which means redoing demo state. Tier 3 only.

The investor dashboard gains a "Your Receipts" gallery reading `ClaimReceipt.tokensOf(account)`.

### Tier 3 — Pitch video (6C) and live demo URL (6D)

Pitch video: 60–90 seconds, narrated, following the Tier 1 demo script with two extra beats — toggle UGF off to show failure, then on to succeed; closing on the live URL. Uploaded and linked from README.

Live demo URL: frontend deployed to Vercel (Vite preset). Subdomain on team-owned DNS or `*.vercel.app`. Backend deployed to Render or Fly.io free tier, pointing at the existing MongoDB Atlas instance. `.env.production` for frontend:
- `VITE_NETWORK_CHAIN_ID=84532`
- `VITE_BACKEND_URL=https://<backend-url>`
- `VITE_BASE_SEPOLIA_RPC_URL=...`

## Data Models

Existing on-chain types stay unchanged. New off-chain types and the activity-feed payload are documented here.

### Activity feed payload (frontend → backend, 5C)

```json
POST /api/transactions
{
  "txHash": "0xabc...123",
  "type": "claim",                  // claim | buy | sell | deposit | listing | cancel
  "from": "0xinvestorwallet...",
  "propertyId": 0,
  "amount": 300.0,                  // USDC, human-readable
  "tokenAmount": 0,                 // PROP if applicable
  "gasMethod": "ugf",               // ugf | eth
  "gasCostUsd": 0.04,               // Mock USD if ugf, ETH-converted-to-USD if eth
  "chainId": 84532
}
```

The backend `Transaction` model already accepts every field (`backend/models/Transaction.js`). No schema change needed.

### Demo wallet manifest (1E output)

Written to `deployed-addresses.json` alongside contract addresses, for the frontend faucet helper to reference:

```json
{
  "network": "baseSepolia",
  "mockUsdc":        "0x...",
  "factory":         "0x...",
  "demoInvestor":    "0x...",
  "demoOwner":       "0x...",
  "deployedAt":      "2026-05-18T..."
}
```

The investor private key NEVER lands in this file. It stays in `.env`.

### Tier 3 — `ClaimReceipt` token (6B, optional)

If 6B ships:

```
ClaimReceipt (ERC-721, soulbound)
  tokenId          uint256        auto-increment
  owner            address        the investor who claimed
  propertyId       uint256        which property
  epochIndex       uint256        which epoch was claimed
  amountUsdc       uint256        amount received (6 decimals)
  claimedAt        uint256        block.timestamp at mint
  tokenURI(id)     string         JSON metadata: name, image, attributes
```

Transfer revert rule: `_update(from, to, ...)` reverts if `from != address(0) && to != address(0)`. Mints (`from == address(0)`) and burns (`to == address(0)`) remain allowed.

## Correctness Properties

These properties must hold in the running system. Each maps to a hard constraint (C1–C7 in Overview) and to a verification activity in Testing Strategy.

### Property 1: Settlement-token UI labelling

Any UI element displaying a USD value shows exactly one of "USDC" or "Mock USD"; never both, never an ambiguous "$". Source: C5.

**Validates: Requirements 5.4, 9.4, 10.2, 11.1**

### Property 2: Settlement-token logical isolation

Business logic (claims, deposits, buys, listings) only ever moves `MockUSDC`. UGF gas accounting only ever debits `TYI_MOCK_USD`. The two tokens are never added, subtracted, or compared in any code path. Source: C5.

**Validates: Requirements 5.2, 7.3**

### Property 3: Settlement-token storage isolation

`Transaction.amount` (rent / purchase) and `Transaction.gasCostUsd` (UGF gas) are stored as separate fields in MongoDB. No code aggregates them across the two semantic categories. Source: C5.

**Validates: Requirements 9.1**

### Property 4: Zero-ETH state-changing calls

When `isUGFEnabled === true`, no state-changing call from the demo investor wallet requires the wallet to hold ETH. Specifically: `claimAll`, `depositRental`, `buyFromOwner`, `buyFromListing`, `cancelListing` succeed with `eth_balance(investor) === 0`. Source: hackathon north star, C2.

**Validates: Requirements 5.2, 7.3, 8.4, 16.2**

### Property 5: Zero-ETH demo seed exit state

The seed script (`scripts/seedDemo.js`) leaves the demo investor wallet with `eth_balance === 0` at exit, OR clearly logs that a manual sweep is required. Source: hackathon north star.

**Validates: Requirements 2.6, 2.8, 6.2**

### Property 6: Zero-ETH balance preservation under UGF

After any successful UGF transaction, the demo investor's ETH balance is unchanged (no MetaMask popup requesting native ETH, no native fee paid). Source: hackathon north star, C2.

**Validates: Requirements 1.4, 5.2, 6.2, 16.2**

### Property 7: Tier 2 toggle isolation

No file under `frontend/src/pages/InvestorDashboard.jsx` or `OwnerDashboard.jsx` contains a UGF toggle switch (`setUGFEnabled`) until Tier 2 / 5A is shipped. The toggle lives in `UGFContext` and the navbar only. Source: C6.

**Validates: Requirements 4.3, 8.1**

### Property 8: Contract-stability across Tier 1 + Tier 2

No new contract is added under `contracts/` during Tier 1 + Tier 2 work. (Verified by `git diff` against the Tier 1 base.) Source: C3, C6.

**Validates: Requirements 6.1, 15.1**

### Property 9: Tier 2 component absence in Tier 1

`<ActivityFeed />`, `<CostBanner />`, `<FaucetPanel />` components do not exist on the Tier 1 branch. They are introduced only when Phase 5C / 5D / 5F lands. Source: C6.

**Validates: Requirements 9.2, 10.1, 12.1**

### Property 10: Owner role routing

A connected wallet whose `roleHint === "Owner"` lands on `/owner` when clicking "Dashboard". Source: §Role split.

**Validates: Requirements 3.3, 3.5**

### Property 11: Investor role routing

A connected wallet whose `roleHint === "Investor"` lands on `/investor` when clicking "Dashboard". Source: §Role split.

**Validates: Requirements 3.4**

### Property 12: Backward compatibility of existing routes

Existing routes (`/`, `/property/:address`, `/portfolio`, `/dividends`) remain reachable and functional after the Tier 1 routing changes. Source: §Role split.

**Validates: Requirements 1.5, 3.6, 11.2**

### Property 13: Seed-script idempotency

Running `npm run seed:base` twice in a row does not double-buy tokens, double-deposit rent, or double-mint USDC. The script detects "already seeded" and exits 0. Source: §Demo-state seeding.

**Validates: Requirements 2.7**

## Error Handling

### Tier 1 error surfaces

| Surface | Failure mode | Handling |
|---------|--------------|----------|
| `getReadProvider().getBlockNumber()` (existing) | RPC unreachable | Existing `nodeOnline = false` path; UI shows "Node offline" banner. Add Base Sepolia URL hint. |
| `connect()` | User rejects (`code 4001`) | Already silently handled — not an error. |
| `connect()` | Wrong network | Existing `isCorrectNetwork === false`; UI prompts `switchToExpectedNetwork()`. Tier 1 / 1D adds the Base Sepolia branch to `getExpectedNetworkConfig`. |
| `factory.getPropertiesCount()` | Returns 0 | `Home.jsx` shows "No properties deployed yet — run `npm run deploy:base`". |
| `ugfExecute` (3C) | UGF SDK rejects (insufficient `TYI_MOCK_USD`, wallet locked, etc.) | Catch the rejection in the dashboard handler. Surface a toast: "Claim failed: <reason>. Check your Mock USD balance via the faucet." Do NOT auto-fall-back to direct signer (that would silently spend ETH, breaking the demo). |
| `ugfExecute` (3C) | Tx reverts on-chain | Same toast pattern; show the revert reason. |
| `seedDemo.js` | Script run on a wallet with no funds | Detect `eth_balance(deployer) === 0` and exit early with a faucet link. |

### Tier 2 error surfaces

| Surface | Failure mode | Handling |
|---------|--------------|----------|
| UGF toggle ON, claim succeeds → `logTx` POSTs to backend | Backend down or 503 | Swallow silently. Activity feed will pick up the tx on next poll once backend recovers. |
| UGF toggle OFF, direct signer call | User has 0 ETH | Tx fails. Surface toast: "Claim failed — you need ETH for gas. Toggle UGF on to pay gas in Mock USD." This **is the demo moment**, do not hide it. |
| `<ActivityFeed />` polling | Backend unreachable | Show "Activity feed offline" inline; do not block any other UI. |
| `getQuote` for cost banner | UGF SDK rejects | Show "—" for the "with UGF" cell; do not block the button. |
| `<FaucetPanel />` button 2 (`/api/faucet/usdc`) | Rate-limited (429) | Show "You've used your faucet quota for this hour." |

### Tier 3 error surfaces

| Surface | Failure mode | Handling |
|---------|--------------|----------|
| Privy embedded wallet (6A) | Email login times out | Fall back to MetaMask flow with a toast. |
| `ClaimReceipt.mint` (6B) | RentalDistribution lacks mint authority | Hard fail at deploy time, not at runtime — verified by a new Hardhat test. |
| Live demo URL (6D) | Backend cold-start | Frontend shows a "Warming up — first request can take 30s" banner if `/api/health` is slow. |

## Testing Strategy

### Tier 1 — automated

- `npx hardhat test` — all 31 existing tests must still pass. Contracts are not changed in T1, so this is a regression check, not a new suite.
- `npm run deploy:base` — must complete without revert and write `deployed-addresses.json`.
- `npm run seed:base` — must exit 0 and print the demo wallet summary specified in §Demo-state seeding. Must be runnable twice (idempotency).

### Tier 1 — manual (the §5.6 E2E checklist)

1. `npm run deploy:base` succeeds.
2. `npm run seed:base` prints the expected wallet summary with ETH=0, USDC=700, PROP=30, pending=300 USDC.
3. Frontend up on `http://localhost:3000`. Switch MetaMask to Base Sepolia.
4. Connect demo investor wallet (already imported via private key).
5. Navbar shows "Investor"; clicking Dashboard lands on `/investor`.
6. Hero shows pending = $300.00.
7. Click "⚡ Claim All Rent". UGF modal opens, shows gas in Mock USD.
8. Confirm. Tx confirms. Pending → $0.00. USDC balance → $1,000.00.
9. MetaMask shows ETH = 0 throughout.

### Tier 2 — manual

- UGF toggle OFF → click Claim All Rent → tx fails (no ETH). Toggle ON → succeeds.
- After a successful claim, `<ActivityFeed />` shows the new entry within 10 seconds.
- The cost banner shows two non-empty cells: "without UGF" and "with UGF".
- The string "Dividends" does not appear in `document.body.innerText`. (Practical check: `npx playwright` script or simple manual sweep.)
- All four state-changing flows (claim, deposit, primary buy, secondary buy) succeed with `eth_balance === 0`.

### Tier 3 — automated

- New Hardhat test for `ClaimReceipt.sol` (if 6B ships): minting allowed; transfer reverts; burn allowed.
- Optional: a Hardhat fork test that runs the seeded demo flow end-to-end against a Base Sepolia fork.

### Tier 3 — manual

- Email-only login (Privy) completes a claim with no MetaMask installed.
- Each successful claim leaves a non-transferable receipt NFT in the investor's wallet (visible in dashboard, transfer attempt fails on Etherscan).
- Pitch video is uploaded and linked from README.
- Live demo URL is reachable from a clean browser with no extensions.

## Open Questions (resolved 2026-05-18)

1. **Local dev mode**: ✅ Resolved — keep both `localhost` (31337) and `baseSepolia` (84532) selectable via an env-driven `VITE_NETWORK_MODE=local|baseSepolia` flag in `frontend/src/config/contracts.js`. Default value is `baseSepolia` for the hackathon submission; teammates flip to `local` for offline dev.
2. **Deployer wallet ownership**: ✅ Resolved — funded by user (address `0xa7Fa1328E32a69C6989C4956D9C7e1f088fbBC3b`). Private key in user's local `.env` only. Phase 1B blocked until faucet funds confirm on Base Sepolia (faucet may have hit Ethereum Sepolia by mistake; user retrying for Base Sepolia).
3. **Demo investor wallet**: ✅ Resolved — public address is `0x25e6f47Fbf5a4Fc83dE6C5D6a5dF3247Ee71c08F`; private key in user's local `.env` as `DEMO_INVESTOR_PRIVATE_KEY`. `.env.example` documents both.
4. **UGF SDK API surface**: still must be re-verified against the live `@tychilabs/react-ugf` README before Phase 3A starts. If `useUGFModal().openUGF()` API has changed, the UGFContext interface and claim flow pseudocode adjust.
5. **Settlement-token UI copy**: open — final visual treatment (badge color / icon) lands in Tier 2 / Phase 5G brand pass.
6. **Activity feed backend URL**: ✅ Resolved — `VITE_BACKEND_URL` defaults to `http://localhost:5000`. MongoDB at `mongodb://localhost:27017/realchain`. Backend degrades gracefully when MongoDB is offline; Tier 1 is fully functional without MongoDB running.
7. **`approve` calls in Tier 2**: ✅ Resolved — leave on direct signer in Tier 2. Only the gas-paying state-changing call is wrapped with UGF. If a future judge asks for "truly zero-ETH including approvals", wrap `approve` then; record that change in `memory/decisions.md`.

## Cross-references

- `implementation_plan.md` — phase numbers (1A, 2B, 5C, 6A, etc.) referenced throughout this design.
- `HACKATHON_PLAN.txt` — UX brief and demo script.
- `CLAUDE.md` — durable project memory; this design is the architectural complement.
- `memory/decisions.md` — settlement-token policy, research-cut decision, tier-gating policy.
- `memory/flags.md` — open risks per tier; this design's Open Questions mirror the Tier 1 / Tier 2 flag categories.
- `../../../hackathon_ps.pdf` — the official problem statement.

## Approval checklist for the user

Before this design is "approved" and we generate `requirements.md`:

- [ ] Hard constraints in Overview reflect what you actually committed to.
- [ ] Settlement-token model in Architecture matches your understanding (rent ≠ gas, two distinct tokens, two distinct UI labels).
- [ ] Component inventory in Components and Interfaces matches what you want built (no missing surface, no surprise additions).
- [ ] Tier 1 scope is exactly what you're willing to gate Tier 2 on.
- [ ] Tier 2 / Tier 3 split feels right.
- [ ] Open Questions all have a decision before any code is written.

Reply with **"approved"** to proceed to `requirements.md`. Reply with specific edits otherwise.
