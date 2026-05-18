# Requirements Document

> **Spec**: Hackathon Zero-ETH Claim
> Derived from `design.md` in this same directory. Authoritative companion: `../../../implementation_plan.md`.
> Format: EARS-style ("WHEN ... THE SYSTEM SHALL ..."). Requirements are organized by tier so contributors only build what their current tier authorizes.

## Introduction

RealChain v2 is being repositioned for the UGF (Universal Gas Framework) Hackathon, Track 3 — Wallet & Agents. The hackathon thesis is that an investor with **0 ETH** on Base Sepolia must be able to claim USDC rent in one click, with UGF settling gas in `TYI_MOCK_USD`. The submission is staged in three tiers (Mandatory → Differentiators → Stretch) that ship in order. These requirements describe the testable behaviour the running system must exhibit at each tier.

## Glossary

| Term | Definition |
|------|------------|
| **UGF** | Universal Gas Framework — the relay infrastructure that lets a user's transaction be paid in `TYI_MOCK_USD` instead of native ETH. |
| **Base Sepolia** | Test network used by the hackathon, chain id `84532`. |
| **MockUSDC** (or "USDC") | The ERC-20 settlement currency for property rent / purchases, deployed by `scripts/deploy.js`. 6 decimals. |
| **TYI_MOCK_USD** (or "Mock USD") | UGF's gas-settlement token on Base Sepolia. Distinct from MockUSDC. |
| **Demo investor wallet** | A specific wallet, populated by `scripts/seedDemo.js`, that is used in the 60-second pitch. Holds PROP tokens, USDC, pending rent, and zero ETH. |
| **roleHint** | A string ("Owner" / "Investor" / "Unknown") computed by `Web3Context` from on-chain factory state. |
| **Tier 1 / 2 / 3** | The three staged delivery batches defined in `implementation_plan.md`. |
| **Phase NX** | The numeric phase label inside `implementation_plan.md` (e.g. Phase 1E, Phase 5A.2). |
| **Activity feed** | The right-rail panel on the home page that polls the backend and shows recent transactions. |
| **Cost banner** | The two-row component beneath every UGF-powered button showing "without UGF" vs "with UGF" cost estimates. |
| **Soulbound NFT** | An ERC-721 that reverts on transfer between non-zero addresses; mints and burns are still allowed. |

## Requirements

### Requirement 1: Base Sepolia network support (Tier 1)

**User Story:** As a hackathon participant, I want the dApp to operate on Base Sepolia (chain id 84532), so that the UGF testnet flow is reachable from my wallet.

#### Acceptance Criteria

1. THE SYSTEM SHALL include a `baseSepolia` network entry in `hardhat.config.js` keyed to chain id `84532` and using `BASE_SEPOLIA_RPC_URL` from the environment when present.
2. THE SYSTEM SHALL expose `NETWORK_CHAIN_ID = 84532` as the production value in `frontend/src/config/contracts.js` for the hackathon submission.
3. WHEN `NETWORK_CHAIN_ID === 84532` IS the active configuration, `Web3Context.getReadProvider()` SHALL connect to the Base Sepolia RPC URL rather than the local Hardhat URL.
4. WHEN the user's MetaMask is on a non-target chain, `Web3Context.switchToExpectedNetwork()` SHALL request a switch (and, if the chain is unknown to MetaMask, request `wallet_addEthereumChain`) for chain id hex `0x14a34` with name `Base Sepolia`, native currency ETH, and the configured RPC URL.
5. THE SYSTEM SHALL preserve the existing `localhost` (`31337`) and `sepolia` (`11155111`) entries in `hardhat.config.js` so local development is not broken.

### Requirement 2: Deterministic demo state (Tier 1)

**User Story:** As a presenter, I want one command to produce a demo wallet with PROP tokens, pending rent, and zero ETH, so that the pitch is reproducible and not dependent on manual setup the morning of the hackathon.

#### Acceptance Criteria

1. WHEN the operator runs `npm run seed:base`, THE SYSTEM SHALL execute `scripts/seedDemo.js` against the `baseSepolia` network and exit with status `0` on success.
2. THE SYSTEM SHALL approve each property's `Marketplace` to spend the deployer's PROP token supply.
3. THE SYSTEM SHALL mint at least 1,000 USDC (6-decimal raw value `1_000_000_000`) to the demo investor wallet.
4. THE SYSTEM SHALL execute a primary-market purchase of 30 PROP tokens for property index 0 from the demo investor wallet.
5. THE SYSTEM SHALL deposit at least 1,000 USDC of rental income to that property's `RentalDistribution`, creating one unclaimed epoch from which the demo investor wallet has a non-zero pending dividend.
6. AT EXIT, THE SYSTEM SHALL print a "Demo investor wallet" summary block including: address, ETH balance, USDC balance, PROP balance, pending dividends.
7. THE SYSTEM SHALL be idempotent: a second invocation on the same network SHALL detect the seeded state (e.g. demo investor already holds PROP tokens) and skip the buy / deposit steps.
8. WHEN the environment variable `BASE_SEPOLIA_GAS_DUST_ADDRESS` is set, THE SYSTEM SHALL transfer the demo investor's residual ETH to that address before exit; otherwise THE SYSTEM SHALL print a "manual sweep needed" notice.
9. THE SYSTEM SHALL write the demo investor and demo owner addresses to `deployed-addresses.json` alongside the contract addresses.

### Requirement 3: Role-based dashboards and routing (Tier 1)

**User Story:** As a connected user, I want to land on a dashboard tailored to my role (property owner vs investor), so that the actions available to me are immediately obvious.

#### Acceptance Criteria

1. THE SYSTEM SHALL expose two new routes: `/owner` (rendering `OwnerDashboard.jsx`) and `/investor` (rendering `InvestorDashboard.jsx`).
2. WHEN no wallet is connected, THE SYSTEM SHALL render a "Connect Wallet" prompt on both `/owner` and `/investor` instead of the dashboard content.
3. WHEN a wallet is connected and `roleHint === "Owner"`, the navbar "Dashboard" link SHALL target `/owner`.
4. WHEN a wallet is connected and `roleHint === "Investor"`, the navbar "Dashboard" link SHALL target `/investor`.
5. WHEN a wallet's `roleHint !== "Owner"` is detected on the `/owner` route, THE SYSTEM SHALL redirect to `/investor`.
6. THE SYSTEM SHALL preserve the existing `/`, `/property/:address`, `/portfolio`, and `/dividends` routes after this change. Their existing functionality SHALL remain unchanged.
7. THE SYSTEM SHALL remove the "Switch Account" button from the main navbar.
8. `OwnerDashboard.jsx` SHALL display only properties for which `properties[i].owner === connected account`, and SHALL provide a "Deposit Rental Income" form and a "Create New Property" button.
9. `InvestorDashboard.jsx` SHALL display the connected wallet's total pending dividends across all properties as the primary hero, AND a per-property breakdown for properties where `token.balanceOf(account) > 0`, AND a single "Claim All Rent" button.

### Requirement 4: UGF wrapper layer (Tier 1)

**User Story:** As a developer adding gasless transactions, I want a single context that owns the UGF SDK lifecycle, so that page components stay free of SDK boilerplate.

#### Acceptance Criteria

1. THE SYSTEM SHALL include a new module `frontend/src/context/UGFContext.jsx` that depends on `@tychilabs/react-ugf`.
2. THE SYSTEM SHALL mount the UGF SDK provider so that `UGFContextProvider` is nested inside `Web3Provider` (so the wrapper can read `signer`).
3. `UGFContext` SHALL expose at minimum: `openUGF`, `ugfExecute(target, abi, fnName, args, opts?)`, `getQuote(target, abi, fnName, args)`, and a boolean `isUGFEnabled` (default `true`) with a setter.
4. WHEN `ugfExecute` is invoked AND `isUGFEnabled === true`, THE SYSTEM SHALL relay the transaction through `openUGF` with `destChainId === "84532"`.
5. WHEN `ugfExecute` is invoked AND `isUGFEnabled === false`, THE SYSTEM SHALL fall back to a direct `signer.sendTransaction(...)` call.
6. `Web3Context.jsx` SHALL NOT import `@tychilabs/react-ugf` and SHALL NOT depend on `UGFContext`.

### Requirement 5: UGF-wrapped Claim All Rent (Tier 1)

**User Story:** As an investor with 0 ETH, I want to claim all my pending rent in one click and pay gas in Mock USD, so that I can use my dividends without first acquiring ETH.

#### Acceptance Criteria

1. WHEN the user clicks the "Claim All Rent" button on `InvestorDashboard.jsx`, THE SYSTEM SHALL invoke `ugfExecute(rentalDistribution, RENTAL_DISTRIBUTION_ABI, "claimAll", [])` for each property where the user has pending dividends.
2. WHEN `isUGFEnabled === true` AND the demo investor wallet's ETH balance is `0`, the call to `claimAll` SHALL succeed and the wallet's USDC balance SHALL increase by the previously-pending amount.
3. AFTER a successful `claimAll`, THE SYSTEM SHALL re-read `pendingDividends(account)` AND `MockUSDC.balanceOf(account)` and re-render the dashboard with the updated values.
4. THE SYSTEM SHALL display a "💎 Gas paid in Mock USD — no ETH needed" badge adjacent to the Claim All Rent button.
5. WHEN the `ugfExecute` call rejects (insufficient `TYI_MOCK_USD`, signed-transaction failure, on-chain revert), THE SYSTEM SHALL surface a user-facing toast with the rejection reason AND SHALL NOT silently fall back to a direct ETH-paying transaction.

### Requirement 6: End-to-end demo verification (Tier 1)

**User Story:** As a hackathon team, we want one repeatable script that proves the demo will work, so that we can sign off Tier 1 before starting Tier 2.

#### Acceptance Criteria

1. THE SYSTEM SHALL pass the existing `npx hardhat test` suite (31 tests) without modification after Tier 1 work lands.
2. THE SYSTEM SHALL allow the manual E2E checklist in `design.md` §Testing Strategy → "Tier 1 — manual" to pass on a clean clone, in order: deploy, seed, frontend up, MetaMask switch, connect demo investor, navbar shows "Investor", `/investor` shows pending = $300.00, click Claim All Rent, UGF modal shows gas in Mock USD, confirm, pending → $0.00, USDC balance → $1,000.00, ETH = 0 throughout.
3. THE SYSTEM SHALL produce a 60-second demo recording (MP4 or equivalent) that follows the same script narrated.

### Requirement 7: Wrap all four state-changing flows (Tier 2)

**User Story:** As a judge, I want the *entire* dApp to operate without ETH (not just claim), so that the zero-ETH thesis is unmissable.

#### Acceptance Criteria

1. WHEN Phase 4A is green AND Tier 2 work is authorized, THE SYSTEM SHALL invoke `ugfExecute` for the following flows: `RentalDistribution.depositRental`, `Marketplace.buyFromOwner`, `Marketplace.buyFromListing`, `Marketplace.cancelListing`.
2. THE SYSTEM SHALL display the same "💎 Gas paid in Mock USD" badge for each of the wrapped flows.
3. WHEN the demo investor wallet has `eth_balance === 0` AND `isUGFEnabled === true`, all four wrapped flows SHALL succeed end-to-end.
4. ERC-20 `approve` calls preceding `buyFromOwner` and `depositRental` MAY remain on the direct signer path in Tier 2 unless explicitly upgraded; if a future decision wraps them, that decision SHALL be recorded in `memory/decisions.md`.

### Requirement 8: UGF on/off toggle (Tier 2)

**User Story:** As a presenter, I want to demonstrate failure-without-UGF and success-with-UGF on the same screen, so that judges see the value proposition in real time.

#### Acceptance Criteria

1. THE SYSTEM SHALL render a toggle UI control (in the navbar settings or an equivalent always-reachable surface) bound to `UGFContext.isUGFEnabled`.
2. WHEN the toggle is OFF, all `ugfExecute` calls SHALL route through `signer.sendTransaction` directly.
3. WHEN the toggle is OFF AND the connected wallet has `eth_balance === 0`, the Claim All Rent button SHALL fail at submission AND a toast SHALL surface text containing "you need ETH for gas. Toggle UGF on to pay gas in Mock USD."
4. WHEN the toggle is ON, the same Claim All Rent action SHALL succeed under the same wallet state.
5. THE SYSTEM SHALL replace the "💎 Gas paid in Mock USD" badge with a "⚠️ Gas paid in ETH" badge while the toggle is OFF.

### Requirement 9: Activity feed (Tier 2)

**User Story:** As a visitor to the home page, I want to see recent transactions on the platform, so that the app feels alive during the demo and the backend earns its place in the architecture.

#### Acceptance Criteria

1. AFTER any successful `ugfExecute` resolution, THE SYSTEM SHALL POST `{ txHash, type, from, propertyId, amount, tokenAmount, gasMethod, gasCostUsd, chainId }` to `${VITE_BACKEND_URL}/api/transactions` in fire-and-forget fashion.
2. THE SYSTEM SHALL render an `<ActivityFeed />` component on the home page that polls `GET /api/transactions?limit=20` every 8 seconds.
3. WHEN the backend returns 503 OR is unreachable, THE SYSTEM SHALL render an inline "Activity feed offline" indicator AND SHALL NOT block any other UI.
4. THE SYSTEM SHALL render each entry with: short wallet, action verb (`claim` → "claimed", `buy` → "bought tokens", `deposit` → "deposited rent"), USDC amount, gas badge ("💎 gasless via UGF" green or "🛢 gas in ETH" grey), relative time.
5. THE SYSTEM SHALL update the feed within 10 seconds of any successful tx (taking the 8-second poll plus network into account).

### Requirement 10: Side-by-side cost banner (Tier 2)

**User Story:** As a judge unfamiliar with crypto gas, I want to see in dollar terms how much UGF saves me, so that the value proposition is concrete.

#### Acceptance Criteria

1. THE SYSTEM SHALL render a `<CostBanner />` beneath every UGF-powered button on `OwnerDashboard.jsx` and `InvestorDashboard.jsx` and the relevant `Property.jsx` actions.
2. THE SYSTEM SHALL display two rows: "Without UGF — ~$X.XX in ETH" and "With UGF — ~$Y.YY Mock USD".
3. THE "Without UGF" row SHALL be computed via `provider.estimateGas(tx) × feeData.gasPrice`, converted to USD using a constant ETH price configured in `contracts.js` or a public price feed.
4. THE "With UGF" row SHALL be sourced from `UGFContext.getQuote(...)`.
5. WHEN `UGFContext.isUGFEnabled === false`, the "Without UGF" row SHALL be visually highlighted; otherwise the "With UGF" row SHALL be highlighted.
6. WHEN `getQuote` rejects, THE SYSTEM SHALL display "—" in the "With UGF" cell rather than blocking the button.

### Requirement 11: User-visible "Dividends" rename (Tier 2)

**User Story:** As a beginner who has never used a DeFi product, I want plain-language labels, so that I understand what a button does without learning new vocabulary.

#### Acceptance Criteria

1. THE SYSTEM SHALL replace every user-visible string "Dividends" with "Claim Rent" or "Rent History" as contextually appropriate, including: navbar links, page titles, button labels, README screenshots.
2. THE SYSTEM SHALL preserve the route `/dividends` so external links continue to resolve.
3. WHEN the rename is complete, the substring "Dividends" (case-sensitive) SHALL NOT appear in `document.body.innerText` of any rendered page.

### Requirement 12: In-app faucet helper (Tier 2)

**User Story:** As a cold-start judge with an empty wallet, I want a single panel inside the app that gets me ready to demo, so that I do not have to leave the page and chase faucets.

#### Acceptance Criteria

1. THE SYSTEM SHALL render a `<FaucetPanel />` on the home page WHEN the connected wallet has both `usdcBalance === 0` AND `propBalance === 0`, OR WHEN the user clicks a "Need test funds?" link in the navbar.
2. THE PANEL SHALL include a "Get Mock USD for gas" button that opens `https://universalgasframework.com/faucets` in a new tab.
3. THE PANEL SHALL include a "Mint 100 USDC for me" button that calls a new backend endpoint `POST /api/faucet/usdc` which mints 100 USDC to the requesting wallet, rate-limited to one request per wallet per hour.
4. THE PANEL SHALL include a "Drop me into demo investor wallet" button that reveals the demo wallet's mnemonic in a copy-to-clipboard box, ONLY WHEN `import.meta.env.MODE === "development"` OR the URL contains the query parameter `?demo=1`.

### Requirement 13: Brand pass (Tier 2)

**User Story:** As a hackathon scorer who weighs polish, I want the app to read as a finished product, not as a school project, so that I rank it above generic submissions.

#### Acceptance Criteria

1. THE SYSTEM SHALL ship a project name and tagline (default proposal: "RentBox — Claim your rent, never touch ETH.") confirmed by the team and surfaced in the navbar and the README.
2. THE SYSTEM SHALL include an SVG logo (≤ 5 KB) mounted in the navbar.
3. THE SYSTEM SHALL render a one-screen landing on `/` for non-connected users including: hero with the tagline, three feature pills (Zero-ETH claim / Buy fractional property / Earn USDC rent), and a `[Connect Wallet]` CTA.
4. THE SYSTEM SHALL apply one consistent accent color across all primary buttons and badges.

### Requirement 14: Embedded wallet (Tier 3)

**User Story:** As a beginner with no wallet installed, I want to sign in with email and complete a claim, so that the only crypto concept I need to learn is "click claim".

#### Acceptance Criteria

1. WHEN Tier 3 is authorized, THE SYSTEM SHALL integrate Privy (or Web3Auth) so a user without `window.ethereum` can sign in with email.
2. `Web3Context.connect()` SHALL fall back to the embedded wallet provider WHEN `window.ethereum` is undefined.
3. THE SYSTEM SHALL allow an embedded-wallet user to complete a `claimAll` via `ugfExecute` end-to-end, given that the wallet has been funded with `TYI_MOCK_USD` (e.g. via the faucet panel).
4. The rest of the application code (dashboards, UGFContext, activity feed) SHALL NOT need to know which provider produced the signer.

### Requirement 15: Soulbound NFT claim receipt (Tier 3)

**User Story:** As an investor, I want a permanent on-chain record of each rent claim, so that my history is verifiable and shareable.

#### Acceptance Criteria

1. WHEN Tier 3 / 6B is authorized, THE SYSTEM SHALL include a new contract `contracts/ClaimReceipt.sol` implementing ERC-721.
2. `ClaimReceipt` SHALL revert any transfer where `from != address(0) && to != address(0)` (soulbound).
3. `RentalDistribution` SHALL be modified to call `ClaimReceipt.mint(user, propertyId, epochIndex, amountUsdc)` after a successful USDC transfer in `_claim`.
4. WHEN a user holds at least one `ClaimReceipt`, `InvestorDashboard.jsx` SHALL render a "Your Receipts" gallery listing token IDs and their metadata.
5. THE SYSTEM SHALL include a Hardhat test that asserts: minting allowed; transfer reverts; burn allowed; mint authority restricted to the configured `RentalDistribution`.

### Requirement 16: Pitch video and live demo URL (Tier 3)

**User Story:** As a remote judge, I want to evaluate the project without checking out the repo, so that the submission stands on its own.

#### Acceptance Criteria

1. THE SYSTEM SHALL include a 60–90 second pitch video uploaded to YouTube (or equivalent) and linked from the README.
2. THE PITCH VIDEO SHALL include the Tier 1 demo script PLUS a live demonstration of the UGF on/off toggle showing claim failing without UGF and succeeding with UGF.
3. THE SYSTEM SHALL be deployed at a publicly reachable URL (Vercel/Netlify subdomain), pointed at a publicly reachable backend (Render/Fly.io free tier).
4. THE LIVE URL SHALL be reachable from a clean browser with no extensions installed; the embedded wallet path (Tier 3 / 6A) SHALL be the default onboarding when MetaMask is absent.

## Cross-references to Design Properties

| Requirement | Validates Design Properties |
|-------------|-----------------------------|
| 1 | Property 6, Property 12 |
| 2 | Property 5, Property 6, Property 13 |
| 3 | Property 10, Property 11, Property 12 |
| 4 | Property 7, Property 9 |
| 5 | Property 1, Property 2, Property 4, Property 6 |
| 6 | Property 4, Property 5, Property 6, Property 8 |
| 7 | Property 2, Property 4 |
| 8 | Property 4, Property 7 |
| 9 | Property 1, Property 3, Property 9 |
| 10 | Property 1, Property 9 |
| 11 | Property 1 |
| 12 | Property 1 |
| 13 | Property 1 |
| 14 | (Tier 3, no Tier 1/2 property to validate) |
| 15 | Property 8 (extends in Tier 3) |
| 16 | Property 4, Property 6 |
