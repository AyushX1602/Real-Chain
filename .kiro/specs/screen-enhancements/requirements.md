# Requirements Document

> **Spec**: Screen Enhancements
> **Workflow**: Requirements-first (new feature)
> **Companion docs (must not contradict)**: `BACKEND_BLOCKCHAIN_PLAN.md`, `FEATURE_IDEAS.md`, `Real-Estate Project Audit.md`, `.kiro/specs/hackathon-zero-eth-claim/*`

## Introduction

This spec scopes a phased enhancement of six existing RealChain screens — **Marketplace** (`Home.jsx`), **Portfolio** (`Portfolio.jsx`), **Claim Rent** (`Dividends.jsx`), **Owner Control Room** (`OwnerDashboard.jsx`), **Activity** (`ActivityFeed.jsx` → optionally elevated to `/activity`), and **Analysis** (`Analytics.jsx`). The goal is to bring each screen up to industry-standard real-estate-tokenization UX (fractional ownership visibility, smart-contract call transparency, automated rent epoch clarity, real-time on-chain analytics) while tightening the Positivus visual hierarchy (lime / black / grey, hard 1px borders, 5px offset shadows, glassmorphism scoped to hero / header surfaces only) and shoring up baseline UX states (loading, empty, error, offline, keyboard parity, reduced motion).

Work ships in seven sequential phases (one per screen plus a cross-cutting hardening pass). No new Solidity contracts are introduced. All contract reads route through existing `Web3Context`; all gas-paying writes route through existing `UGFContext` (gas in `TYI_MOCK_USD`); rent settlement remains in `MockUSDC`. Indexer-backed reads come from existing Express routes under `/api/properties`, `/api/transactions`, `/api/users`.

### Out of scope (explicit)

1. New Solidity contracts (no governance, no NFT receipts, no upgradeable proxies, no V3 distribution).
2. Multi-chain deployment (single target chain remains as configured in `frontend/src/config/contracts.js`).
3. Backend services that need third-party API keys (Resend email, Twilio SMS).
4. Mobile / native apps. PWA-style enhancements (installable manifest, offline shell) are permitted.
5. Replacing the Positivus visual language. This spec refines and enforces it; it does not redesign it.
6. Settlement-token policy changes. `MockUSDC` remains the rent / purchase currency; `TYI_MOCK_USD` remains gas-only. Per accepted decisions, the V1/V2 distribution research surface stays cut from end-user UI.

## Glossary

| Term | Definition |
|------|------------|
| **Marketplace screen** | The page rendered by `frontend/src/pages/Home.jsx` at route `/marketplace`. Property browse + buy surface. |
| **Portfolio screen** | The page rendered by `frontend/src/pages/Portfolio.jsx` at route `/portfolio`. Per-wallet holdings view. |
| **Claim Rent screen** | The page rendered by `frontend/src/pages/Dividends.jsx` at route `/dividends`. Rental dividend claim surface. |
| **Owner Control Room** | The page rendered by `frontend/src/pages/OwnerDashboard.jsx` at route `/owner`. Property-owner administrative surface. |
| **Activity screen** | The activity surface, currently `frontend/src/components/ActivityFeed.jsx` rendered as a right-rail on `/marketplace`; this spec promotes it to a deep-linkable surface (either dedicated route or strengthened rail). |
| **Analysis screen** | The page rendered by `frontend/src/pages/Analytics.jsx` at route `/analytics`. Cross-platform analytics surface. |
| **Epoch** | One on-chain rental distribution period created by a `RentalDistribution.depositRental` call. Each epoch produces a per-holder claimable share. |
| **Holding** | A wallet's `PropertyToken.balanceOf(account)` value for a given property, mirrored in the `Holding` Mongoose collection by the indexer. |
| **Claim** | A successful `RentalDistribution.claim(epochId)` or `claimAll()` transaction transferring `MockUSDC` rent to the holder. |
| **Holder concentration** | The Gini-style or top-N-share metric computed over the `Holding` collection for a single property. Indicates how distributed fractional ownership is. |
| **Gas method** | The string label `"ugf"` or `"eth"` describing which path paid gas: `ugf` = relayed via UGF in `TYI_MOCK_USD`; `eth` = direct signer transaction in native ETH. |
| **Fractional ownership** | A wallet's share of a property expressed as `holding / totalSupply`, rendered as a percentage. |
| **Indexer-backed view** | A view whose primary data source is the Mongoose collections (`Holding`, `Transaction`, `Property`) populated by `backend/jobs/indexer.js`, with on-chain reads only as a freshness fallback. |
| **On-chain badge** | A small UI marker that links a number or row to its source transaction via an explorer URL derived from `txHash` and the active chain id. |
| **Positivus tokens** | The design tokens enforced project-wide: lime (`#B9FF66`), black (`#191A23`), white (`#FFFFFF`), grey (`#F3F3F3`), hard 1px borders, 5px offset hard shadows, no soft drop shadows except on hero / header surfaces where glassmorphism is permitted. |
| **Glassmorphism boundary** | The rule that backdrop-blur / translucent panels are permitted only on hero, header, and modal-overlay surfaces; dense data screens (tables, lists, charts) MUST use opaque Positivus tokens. |
| **UGFContext** | The provider exported by `frontend/src/context/UGFContext.jsx` that exposes `ugfExecute`, `getQuote`, and `isUGFEnabled`. |
| **Web3Context** | The provider exported by `frontend/src/context/Web3Context.jsx` that exposes the read provider, signer, account, and `roleHint`. |
| **SmartAgentContext** | The provider exported by `frontend/src/context/SmartAgentContext.jsx` that exposes the heuristic gas optimizer + LLM-backed agent. |

## Requirements

### Requirement 1: Marketplace screen enhancements

**User Story:** As an investor browsing the platform, I want the Marketplace to surface property tokenisation health, on-chain liquidity, and clear primary-market actions, so that I can evaluate and buy fractional ownership without leaving the page.

#### Acceptance Criteria

1. WHEN the Marketplace screen mounts, THE Marketplace_Screen SHALL fetch the property catalog from `GET /api/properties` and render each property card with: property name, image, price per token in `MockUSDC`, total supply, tokens remaining, and a fractional-ownership-progress bar computed as `(totalSupply - tokensRemaining) / totalSupply`.
2. WHEN a property card is at least 50% intersected with the viewport, THE Marketplace_Screen SHALL display a holder count badge sourced from `GET /api/properties/:id/holders` showing the number of distinct holders.
3. WHEN the user hovers a property card with pointer input, focuses it via keyboard, OR taps it once on a touch input, THE Marketplace_Screen SHALL reveal a secondary action panel containing "View Details", "Add to Watchlist", and "Buy Tokens".
4. WHEN the user clicks "Buy Tokens" on a property card AND `Web3Context.signer` is defined, THE Marketplace_Screen SHALL invoke `UGFContext.ugfExecute` against `Marketplace.buyFromOwner` (or `buyFromListing` for secondary listings) using that signer.
5. WHILE a buy transaction is in flight, THE Marketplace_Screen SHALL display an inline progress state on the originating card, disable further buy actions on that card, AND show a `<CostBanner />` row reading "Gas paid in Mock USD via UGF" sourced from `UGFContext.getQuote`.
6. WHEN a buy transaction resolves successfully, THE Marketplace_Screen SHALL re-fetch the affected property's tokens-remaining value AND update the holder count badge within 10 seconds.
7. IF `GET /api/properties` returns a non-2xx response OR does not respond within 10 seconds, THEN THE Marketplace_Screen SHALL render an error state with retry control AND SHALL fall back to direct on-chain reads via `Web3Context` for property name, total supply, and price.
8. IF `GET /api/properties` returns an empty array AND on-chain `PropertyFactory.getProperties()` returns zero entries, THEN THE Marketplace_Screen SHALL render an empty state with copy "No properties listed yet" and a link to documentation on creating a property.
9. WHILE the property catalog is loading, THE Marketplace_Screen SHALL render skeleton cards matching the final card layout dimensions to prevent layout shift.
10. THE Marketplace_Screen SHALL render the page header (title + filter bar) using glassmorphism (backdrop-blur, translucent surface) AND SHALL render every property card using opaque Positivus tokens with a 1px black border and 5px offset hard shadow.
11. THE Marketplace_Screen SHALL render every interactive element (filter chip, card, buy button) with visible focus rings of at least 2px contrasting outline meeting WCAG 2.1 SC 1.4.11 (3:1 against the adjacent surface) AND SHALL match hover and focus visual treatment.
12. WHERE the user has set `prefers-reduced-motion: reduce`, THE Marketplace_Screen SHALL disable card-hover lift transitions AND replace shimmer skeletons with static placeholders.
13. WHERE the active right-rail Activity surface is mounted on the Marketplace screen, THE Marketplace_Screen SHALL constrain its width so the property grid retains at least three columns each at minimum 280px wide at viewports `>= 1280px`.
14. IF `GET /api/properties/:id/holders` returns a non-2xx response OR does not respond within 5 seconds, THEN THE Marketplace_Screen SHALL render the holder count badge as "—" with a tooltip "Holder count unavailable" AND SHALL NOT block the rest of the card from rendering.
15. WHEN the user clicks "Buy Tokens" on a property card AND `Web3Context.signer` is undefined, THE Marketplace_Screen SHALL render a connect-wallet prompt AND SHALL NOT invoke `UGFContext.ugfExecute`.
16. IF a buy transaction reverts, is rejected by the wallet, OR does not resolve within 60 seconds, THEN THE Marketplace_Screen SHALL render an error state on the originating card with the failure reason, re-enable the "Buy Tokens" action, AND SHALL NOT modify the displayed tokens-remaining value until the next successful re-fetch.

### Requirement 2: Portfolio screen enhancements

**User Story:** As a holder of property tokens, I want the Portfolio to show my fractional ownership, projected next rent, and claim status per property, so that I can manage my holdings without computing values by hand.

#### Acceptance Criteria

1. WHEN the Portfolio screen mounts AND a wallet is connected, THE Portfolio_Screen SHALL fetch the wallet's holdings from `GET /api/users/:address` (or equivalent holdings route) within a 10-second request timeout, and render one row per property where `holding > 0`.
2. THE Portfolio_Screen SHALL display each row with: property name truncated to 60 characters with ellipsis if longer; raw token holding; fractional ownership percentage `holding / totalSupply` rounded to 2 decimal places; current valuation in `MockUSDC` rounded to 2 decimal places; lifetime rent received in `MockUSDC` rounded to 2 decimal places; and pending rent in `MockUSDC` rounded to 2 decimal places.
3. WHEN the wallet's pending rent across all properties is greater than zero, THE Portfolio_Screen SHALL render a hero summary card showing total pending rent in `MockUSDC` rounded to 2 decimal places and a "Claim All Rent" CTA that navigates to the Claim Rent screen on activation.
4. THE Portfolio_Screen SHALL display a projected-next-deposit indicator per property sourced from `GET /api/properties/:id` showing the median epoch cadence in days computed over the most recent 12 `RentalDistribution.RentalDeposited` events AND the resulting projected next deposit date in `YYYY-MM-DD` format.
5. WHEN the user hovers OR focuses a portfolio row, THE Portfolio_Screen SHALL reveal a secondary action panel containing "View Property", "Sell Tokens", and "View History".
6. WHEN the user clicks "Sell Tokens", THE Portfolio_Screen SHALL navigate to the `Property.jsx` detail view scrolled to the secondary listing form, NOT submit a transaction directly.
7. IF the wallet is not connected, THEN THE Portfolio_Screen SHALL render a `<ConnectGate />` empty state with a "Connect Wallet" CTA AND SHALL NOT issue any backend or on-chain reads.
8. IF the wallet is connected but has zero holdings AND zero pending rent, THEN THE Portfolio_Screen SHALL render an empty state with copy "No holdings yet" and a CTA "Browse Marketplace" linking to `/marketplace`.
9. WHILE holdings data is loading, THE Portfolio_Screen SHALL render at most six skeleton rows AND SHALL preserve the hero summary card frame so the layout does not shift on data arrival.
10. IF `GET /api/users/:address` is unreachable, returns a non-2xx response, OR does not respond within 10 seconds, THEN THE Portfolio_Screen SHALL surface a non-blocking "Indexer offline — showing on-chain data" banner AND SHALL fall back to per-property on-chain reads via `Web3Context` for holding, total supply, and pending rent.
11. THE Portfolio_Screen SHALL render the hero summary card with glassmorphism (backdrop-blur, translucent lime tint over black) AND SHALL render the holdings table using opaque Positivus tokens with 1px borders between rows and a 5px offset hard shadow on the table container.
12. WHERE `prefers-reduced-motion: reduce` is set, THE Portfolio_Screen SHALL disable count-up animations on the hero summary AND SHALL render final values immediately.
13. THE Portfolio_Screen SHALL expose every per-row action via keyboard with arrow-key navigation and Enter to activate AND SHALL match focus and hover visual treatment.
14. IF fewer than 2 historical `RentalDistribution.RentalDeposited` events exist for a property, THEN THE Portfolio_Screen SHALL render the projected-next-deposit indicator as "Cadence unavailable" rather than computing a misleading median.
15. IF both `GET /api/users/:address` and the on-chain fallback in criterion 10 fail, THEN THE Portfolio_Screen SHALL render an error state with copy "Could not load your holdings" and a "Retry" CTA AND SHALL NOT render the holdings table.

### Requirement 3: Claim Rent screen enhancements

**User Story:** As a holder with pending rent, I want the Claim Rent screen to show my epoch-by-epoch claim status and gas method clearly, so that I understand what I am claiming and what it costs.

#### Acceptance Criteria

1. WHEN the Claim Rent screen mounts AND a wallet is connected, THE ClaimRent_Screen SHALL render a per-property panel for every property where the wallet has pending rent, sourced from on-chain `RentalDistribution.pendingDividends(account)` via `Web3Context`.
2. THE ClaimRent_Screen SHALL render an epoch list per property where each row shows: epoch index; deposit timestamp formatted in the user's locale with a machine-readable ISO 8601 `datetime` attribute; the wallet's claimable share in `MockUSDC` rounded to 2 decimal places; and a claim status badge whose value is exactly one of `unclaimed`, `claimed`, or `partial`.
3. WHEN the user clicks "Claim All Rent" on a property panel, THE ClaimRent_Screen SHALL invoke `UGFContext.ugfExecute` against `RentalDistribution.claimAll()` for that property using the active signer.
4. WHEN the user clicks "Claim Epoch" on a single epoch row, THE ClaimRent_Screen SHALL invoke `UGFContext.ugfExecute` against `RentalDistribution.claim(epochId)` for that epoch.
5. WHILE a claim transaction is in flight, THE ClaimRent_Screen SHALL display a per-row in-flight state (spinner + "Confirming") on every row in the affected scope (the originating row only for `claim`, every `unclaimed` row for the property for `claimAll`), disable additional claim actions inside that scope, AND show a `<CostBanner />` quoting "With UGF" cost from `UGFContext.getQuote` and an estimated "Without UGF" cost from `provider.estimateGas`.
6. WHEN a claim transaction resolves successfully, THE ClaimRent_Screen SHALL re-read `pendingDividends(account)` AND re-render the affected epoch rows with status `claimed` AND SHALL render an on-chain badge linking to the explorer URL derived from `txHash` and the active chain id within 10 seconds.
7. IF `UGFContext.ugfExecute` rejects, THEN THE ClaimRent_Screen SHALL surface a toast containing the rejection reason that remains visible for at least 8 seconds and exposes a manual-dismiss control, restore every affected row to its pre-submit status with claim controls re-enabled, AND SHALL NOT silently retry on a direct-ETH path.
8. IF the wallet is connected but has zero pending rent across all properties, THEN THE ClaimRent_Screen SHALL render an empty state with copy "All caught up — no pending rent" and a projected-next-deposit indicator per property using the median of the most recent 3 epoch intervals; if fewer than 3 prior deposits exist, the indicator SHALL render "Cadence unavailable".
9. WHILE epoch data is loading, THE ClaimRent_Screen SHALL render skeleton rows matching the final epoch row dimensions.
10. IF an on-chain read via `Web3Context` does not resolve within 15 seconds OR reverts, THEN THE ClaimRent_Screen SHALL render an error state on the affected property panel with a retry control AND SHALL NOT block other property panels from rendering.
11. THE ClaimRent_Screen SHALL render the page header using glassmorphism AND SHALL render every property panel using opaque Positivus tokens with 1px borders and 5px offset hard shadows. The epoch list SHALL NOT use glassmorphism.
12. THE ClaimRent_Screen SHALL render the gas-method badge ("Gas paid in Mock USD via UGF" lime-on-black or "Gas paid in ETH" grey-on-black) adjacent to every claim button.
13. WHERE `prefers-reduced-motion: reduce` is set, THE ClaimRent_Screen SHALL disable the in-flight spinner rotation AND SHALL replace it with a static "Confirming" pill.
14. THE ClaimRent_Screen SHALL expose every claim action via keyboard with Tab order matching the visual top-to-bottom order AND SHALL render visible focus rings on every interactive element.
15. IF the wallet is not connected at mount OR disconnects mid-session, THEN THE ClaimRent_Screen SHALL render a connect-wallet prompt AND SHALL NOT issue any on-chain reads or claim transactions.

### Requirement 4: Owner Control Room enhancements

**User Story:** As a property owner, I want the Owner Control Room to surface my property's holder distribution, deposit history, and primary administrative actions in one place, so that I can run my properties without bouncing between screens.

#### Acceptance Criteria

1. WHEN the Owner Control Room screen mounts AND `Web3Context.roleHint === "Owner"`, THE OwnerControlRoom_Screen SHALL render one panel per property where the connected account equals `Property.owner`, sourced from `GET /api/properties` filtered by owner.
2. THE OwnerControlRoom_Screen SHALL render each property panel with: property name; total supply; tokens remaining; lifetime rent deposited; last deposit timestamp displayed in the user's local timezone with format `YYYY-MM-DD HH:mm`; and a holder concentration metric (top-5 holder share percentage rounded to one decimal place) sourced from `GET /api/properties/:id/holders`.
3. WHEN the user submits the "Deposit Rental Income" form with a numeric amount between `0.01` and `1,000,000.00` MockUSDC having at most 2 decimal places, THE OwnerControlRoom_Screen SHALL first invoke `MockUSDC.approve` for the entered amount AND, upon successful approval, invoke `UGFContext.ugfExecute` against `RentalDistribution.depositRental(amount)` for the corresponding property.
4. IF the user submits the "Deposit Rental Income" form with an amount outside `0.01` to `1,000,000.00`, with more than 2 decimal places, or with a non-numeric value, THEN THE OwnerControlRoom_Screen SHALL block submission, retain the entered value, and render an inline validation error indicating the allowed amount range and decimal precision.
5. THE OwnerControlRoom_Screen SHALL render a deposit history table per property showing one row per `RentalDeposited` event sorted by timestamp descending, displaying up to 25 rows per page with pagination controls, where each row contains: epoch index, timestamp, amount in `MockUSDC`, gas method, and an on-chain badge linking to the explorer URL derived from `txHash`.
6. WHILE a deposit transaction is in flight, THE OwnerControlRoom_Screen SHALL disable the deposit form for that property AND show the contract method label `"RentalDistribution.depositRental"` adjacent to the in-flight indicator.
7. WHEN a deposit transaction resolves successfully, THE OwnerControlRoom_Screen SHALL re-fetch the deposit history for the affected property AND prepend the new epoch row within 10 seconds.
8. IF the `MockUSDC.approve` call or `RentalDistribution.depositRental` call fails, reverts, or is rejected by the wallet, THEN THE OwnerControlRoom_Screen SHALL re-enable the deposit form, retain the user-entered amount, render an inline error message indicating which contract method failed, and leave the deposit history unchanged.
9. THE OwnerControlRoom_Screen SHALL render a "Create New Property" CTA that navigates to the property creation flow.
10. IF the wallet is connected but `Web3Context.roleHint !== "Owner"`, THEN THE OwnerControlRoom_Screen SHALL render a redirect to `/investor` (or `/portfolio` if `/investor` is not mounted) without issuing any property-owner reads.
11. IF the wallet is not connected, THEN THE OwnerControlRoom_Screen SHALL render a `<ConnectGate />` empty state with a "Connect Wallet" CTA.
12. IF `GET /api/properties` returns zero properties owned by the connected account, THEN THE OwnerControlRoom_Screen SHALL render an empty state containing the "Create New Property" CTA AND SHALL NOT render any property panels or deposit forms.
13. IF `GET /api/properties` returns an error response or does not respond within 10 seconds, THEN THE OwnerControlRoom_Screen SHALL render an inline error indicating the property listing service is unavailable with a "Retry" control AND SHALL NOT render any property panels.
14. IF `GET /api/properties/:id/holders` is unreachable or does not respond within 10 seconds, THEN THE OwnerControlRoom_Screen SHALL render the holder concentration metric as "—" with an inline "Indexer offline" tooltip AND SHALL NOT block the deposit form.
15. WHILE owner-property data is loading, THE OwnerControlRoom_Screen SHALL render skeleton panels and SHALL preserve the deposit form frame.
16. THE OwnerControlRoom_Screen SHALL render the page header using glassmorphism AND SHALL render every property panel, deposit form, and history table using opaque Positivus tokens with 1px borders and 5px offset hard shadows.
17. WHERE `prefers-reduced-motion: reduce` is set, THE OwnerControlRoom_Screen SHALL disable any chart entry transitions on the holder concentration visualization AND SHALL render the final state immediately.
18. THE OwnerControlRoom_Screen SHALL expose every form input and action via keyboard with logical Tab order AND SHALL render an identical hover and focus visual treatment on every interactive control.

### Requirement 5: Activity screen enhancements

**User Story:** As any platform participant, I want a deep-linkable Activity surface with filtering, pagination, and per-row contract context, so that I can audit and share platform activity.

#### Acceptance Criteria

1. THE Activity_Screen SHALL be reachable at the route `/activity` AND SHALL also remain mountable as a right-rail on the Marketplace screen sharing the same component implementation.
2. WHEN the Activity screen mounts, THE Activity_Screen SHALL fetch transactions from `GET /api/transactions?limit=50` AND render each row with: short wallet formatted as the first 6 hex characters + `…` + the last 4 hex characters of the address; action verb (`claim` → "claimed", `buy` → "bought", `deposit` → "deposited"); amount in `MockUSDC` rounded to 6 decimal places; gas method badge; relative timestamp refreshed at least every 60 seconds; and an on-chain badge whose link target is `_blank` to the explorer URL derived from `txHash` and chain id.
3. THE Activity_Screen SHALL render a filter bar exposing: action type with default `all` and options (`claim`, `buy`, `deposit`, `all`); gas method with default `all` and options (`ugf`, `eth`, `all`); property as a multi-select sourced from `GET /api/properties` defaulting to no selection (treated as all properties); and wallet address as a free-text input accepting up to 42 characters with `^0x[a-fA-F0-9]{40}$` validation.
4. WHEN a filter is applied, THE Activity_Screen SHALL re-issue `GET /api/transactions` with the corresponding query parameters AND SHALL reflect the active filters in the URL query string so the view is shareable.
5. IF the user submits a wallet-address filter that fails the `^0x[a-fA-F0-9]{40}$` pattern, THEN THE Activity_Screen SHALL render an inline validation error adjacent to the input AND SHALL NOT issue a `GET /api/transactions` request for that filter change.
6. WHEN the user scrolls to within 200 pixels of the bottom of the visible list, THE Activity_Screen SHALL fetch the next page of up to 50 rows from `GET /api/transactions` using a cursor or offset parameter AND SHALL append the results without unmounting prior rows.
7. IF a pagination request fails or returns a non-2xx response, THEN THE Activity_Screen SHALL render a "Load more" retry control at the list's tail AND SHALL NOT remove already-rendered rows.
8. WHEN a deep link of the form `/activity?txHash=0x...` is opened AND a row matching that `txHash` is in the initial result set, THE Activity_Screen SHALL scroll the matching row into view within 1 second of mount AND highlight it with a 2-second lime-tint accent that respects `prefers-reduced-motion`.
9. IF a deep link of the form `/activity?txHash=0x...` is opened AND no matching row exists in the result set, THEN THE Activity_Screen SHALL render a non-blocking notice "Transaction not in current view" with a "Clear filters" CTA.
10. WHILE the right-rail variant is mounted on the Marketplace screen, THE Activity_Screen SHALL poll `GET /api/transactions?limit=20` every 8 seconds, SHALL prepend new rows without removing rows the user has scrolled to, AND SHALL cap the right-rail in-memory row count at 200 by trimming the oldest rows beyond that bound.
11. IF `GET /api/transactions` returns a 5xx status code OR does not resolve within 10 seconds for two consecutive attempts, THEN THE Activity_Screen SHALL render an inline "Activity feed offline" indicator, SHALL NOT block any other UI, AND SHALL retry the request every 30 seconds until a successful response is received.
12. IF the filter set returns zero results, THEN THE Activity_Screen SHALL render an empty state with copy "No matching activity" and a "Clear filters" CTA that resets every filter to its default and removes all filter parameters from the URL query string.
13. WHILE the initial transaction list is loading, THE Activity_Screen SHALL render between 5 and 10 skeleton rows matching the final row dimensions AND SHALL replace them with rendered rows within 100 milliseconds of receiving a successful response.
14. THE Activity_Screen SHALL render the route-level page header using glassmorphism AND SHALL render the row list using opaque Positivus tokens with row separators of exactly 1 pixel. The right-rail variant SHALL NOT use glassmorphism.
15. WHERE `prefers-reduced-motion: reduce` is set, THE Activity_Screen SHALL disable the new-row slide-in transition AND SHALL render new rows in their final position within one animation frame.
16. THE Activity_Screen SHALL expose every row's on-chain badge and filter control via keyboard AND SHALL render visible focus rings of at least 2 pixels on every interactive element.

### Requirement 6: Analysis screen enhancements

**User Story:** As any platform participant, I want the Analysis screen to surface live KPIs, historical rent and trade trends, and holder concentration per property, so that I can make data-driven decisions.

#### Acceptance Criteria

1. WHEN the Analysis screen mounts, THE Analysis_Screen SHALL fetch platform KPIs from `GET /api/transactions/stats` within a 5-second request timeout AND render at minimum: total volume in `MockUSDC`, total rent distributed in `MockUSDC`, distinct holders, and distinct properties.
2. THE Analysis_Screen SHALL render a time-series chart sourced from `GET /api/transactions/timeseries` plotting daily rent deposited and daily volume over a user-selectable window of exactly 7, 30, or 90 days, defaulting to 30 days on first mount.
3. THE Analysis_Screen SHALL render a holder-concentration panel per property listing the top-5 holder share percentages rounded to one decimal place, sourced from `GET /api/properties/:id/holders`. If a property has fewer than 5 holders, the panel SHALL render only the existing holders without padding.
4. THE Analysis_Screen SHALL render a leaderboard sourced from `GET /api/users/leaderboard/top` showing the top 10 wallets ranked by lifetime rent received in descending order.
5. WHEN the user changes the time-series window, THE Analysis_Screen SHALL re-issue `GET /api/transactions/timeseries` with the new window parameter, SHALL return updated chart data within 500 milliseconds, AND SHALL update the chart without unmounting unrelated panels.
6. WHEN a KPI card receives pointer hover or keyboard focus, THE Analysis_Screen SHALL reveal the underlying contract source (e.g. "Sourced from RentalDistribution + Marketplace events via indexer") within 200 milliseconds.
7. IF any analytics endpoint returns a non-success response OR does not respond within 10 seconds, THEN THE Analysis_Screen SHALL render the affected panel in an error state with a retry control, SHALL continue rendering other panels with already-fetched data, AND SHALL NOT block them from updating.
8. IF the indexer reports zero indexed events, THEN THE Analysis_Screen SHALL render an empty state on each panel with copy "No on-chain activity indexed yet".
9. WHILE analytics data is loading, THE Analysis_Screen SHALL render skeleton KPI cards and a skeleton chart matching final dimensions within a 2-pixel tolerance to prevent layout shift.
10. THE Analysis_Screen SHALL render the page header using glassmorphism AND SHALL render every KPI card, chart container, holder-concentration panel, and leaderboard table using opaque Positivus tokens with 1px borders and 5px offset hard shadows.
11. THE Analysis_Screen SHALL render every chart with a colour palette restricted to the Positivus tokens (lime, black, grey) plus at most two derived neutral tints AND SHALL provide a non-colour encoding (pattern, label, or position) for any series presented in colour.
12. WHERE `prefers-reduced-motion: reduce` is set, THE Analysis_Screen SHALL disable chart entry animations and KPI count-up animations AND SHALL render final values immediately.
13. THE Analysis_Screen SHALL expose chart window selectors and leaderboard row links via keyboard AND SHALL render visible focus rings of at least 2 pixels on every interactive element.
14. THE Analysis_Screen SHALL include a textual summary of each chart (e.g. "Rent distributed has increased X% over the selected window") inside a screen-reader-accessible region with `aria-live="polite"` that updates each time the chart's underlying data changes.

### Requirement 7: Cross-cutting design hierarchy and rollout concerns

**User Story:** As the team shipping these enhancements, I want shared rules for sequencing, accessibility, motion, glassmorphism, and Positivus token compliance, so that per-screen work composes into a coherent product.

#### Acceptance Criteria

1. THE Screen_Enhancements_Program SHALL deliver work in seven sequential phases: Phase A Marketplace, Phase B Portfolio, Phase C Claim Rent, Phase D Owner Control Room, Phase E Activity, Phase F Analysis, Phase G Cross-cutting hardening (accessibility audit, motion audit, token compliance audit).
2. WHEN a phase enters integration, THE Screen_Enhancements_Program SHALL gate the next phase's start on the prior phase passing all of: zero failing items on the manual UX checklist for that screen, zero failing tests in `npx hardhat test`, zero lint errors and zero typecheck errors in the frontend pipeline.
3. THE Screen_Enhancements_Program SHALL apply glassmorphism (backdrop-blur, translucent surfaces) ONLY to hero surfaces, page-level headers, and modal overlays. THE Screen_Enhancements_Program SHALL NOT apply glassmorphism to tables, lists, charts, forms, or any dense data surface.
4. THE Screen_Enhancements_Program SHALL render every interactive element with a visible focus ring of at least 2 pixels AND a contrast ratio of at least 3:1 against the adjacent surface measured per WCAG 2.1 SC 1.4.11 (Non-text Contrast).
5. THE Screen_Enhancements_Program SHALL match every hover-reveal affordance with a focus-equivalent affordance that (a) renders the same content as the hover state, (b) is reachable in keyboard Tab order, and (c) persists on the screen for as long as the element retains focus.
6. WHERE the user has set `prefers-reduced-motion: reduce`, THE Screen_Enhancements_Program SHALL disable parallax, count-up, shimmer, slide-in, and lift transitions on every screen in scope AND SHALL render final states within one animation frame.
7. THE Screen_Enhancements_Program SHALL restrict the Positivus token palette to lime (`#B9FF66`), black (`#191A23`), white (`#FFFFFF`), grey (`#F3F3F3`), and at most two derived neutral tints. THE Screen_Enhancements_Program SHALL NOT introduce new accent colours.
8. THE Screen_Enhancements_Program SHALL render every elevated surface with a 1px black border and a hard shadow of exactly 5px offset and 0px blur radius (no soft drop shadows) except where glassmorphism is permitted per criterion 3.
9. THE Screen_Enhancements_Program SHALL render every gas-method-bearing action with a gas-method badge derived from the `gasMethod` field returned by `UGFContext.ugfExecute` results (`ugf` → lime "Gas paid in Mock USD via UGF", `eth` → grey "Gas paid in ETH").
10. THE Screen_Enhancements_Program SHALL surface contract-method context (e.g. `RentalDistribution.claim(epochId)`) on every screen that submits a state-changing call, satisfying at least one of: (a) inline render visible without user input, (b) hover-reveal that meets the focus-equivalence rule in criterion 5, or (c) focus-reveal on the action's primary control.
11. WHEN a state-changing transaction emits a non-empty `txHash`, THE Screen_Enhancements_Program SHALL render a deep-link to a block-explorer URL constructed from that `txHash` and the active `NETWORK_CHAIN_ID` configured in `frontend/src/config/contracts.js`.
12. IF a screen's primary indexer route returns a non-2xx response, fails after 3 retry attempts spaced at exponential backoff, OR does not respond within 10 seconds, THEN THE Screen_Enhancements_Program SHALL surface a "Indexer offline — showing on-chain data" banner that does not block scrolling, focus, or interaction with the underlying screen AND SHALL fall back to direct on-chain reads via `Web3Context` for the data the screen requires.
13. THE Screen_Enhancements_Program SHALL preserve every existing route already mounted in `frontend/src/App.jsx` (`/`, `/marketplace`, `/property/:id`, `/portfolio`, `/dividends`, `/owner`, `/investor`, `/watchlist`, `/analytics`) AND SHALL NOT rename any of them as part of this spec. The new `/activity` route is additive.
14. THE Screen_Enhancements_Program SHALL NOT modify settlement-token policy: rent and primary-market purchases SHALL settle in `MockUSDC`; gas SHALL settle in `TYI_MOCK_USD` via `UGFContext`.
15. THE Screen_Enhancements_Program SHALL NOT introduce user-visible UI for the `RentalDistribution` V1 / V2 research surface; all rent flows SHALL target the default-deployed distribution as configured in `deployed-addresses.json`.

## Assumptions

This spec relies on the following preconditions remaining true. If any becomes false, the affected requirements SHALL be revisited before implementation continues.

1. `Web3Context` is mounted at the application root and exposes a usable read provider, signer (when connected), `account`, `chainId`, and `roleHint`.
2. `UGFContext` is mounted inside `Web3Provider` and exposes `ugfExecute(target, abi, fnName, args, opts?)`, `getQuote(target, abi, fnName, args)`, and `isUGFEnabled` per the hackathon spec.
3. `SmartAgentContext` is mounted and available; this spec does not require new agent capabilities but per-screen agent suggestions MAY consume it.
4. The Express + Mongoose backend is running with the routes `/api/properties`, `/api/properties/:id/holders`, `/api/transactions`, `/api/transactions/stats`, `/api/transactions/timeseries`, `/api/users`, `/api/users/leaderboard/top`, `/api/auth/nonce`, `/api/faucet/usdc`, `/api/health` reachable at `${VITE_BACKEND_URL}`.
5. MongoDB is connected and the indexer at `backend/jobs/indexer.js` is running and maintaining `Holding`, `Transaction`, and `Property` collections from `PropertyFactory` and per-property events.
6. The Solidity contracts `MockUSDC`, `PropertyToken` (ERC20Votes), `RentalDistribution` (default V1 in production, V2 deployable but not user-visible), `Marketplace`, and `PropertyFactory` are deployed at the addresses in `deployed-addresses.json` for the active chain id.
7. Settlement-token policy is fixed: `MockUSDC` for rent and primary-market purchases, `TYI_MOCK_USD` for gas only.
8. The Positivus visual language is the design baseline; this spec refines and enforces it but does not replace it.
9. The active chain id is determined by `frontend/src/config/contracts.js` and explorer URLs are derived from it. No multi-chain logic is in scope.
10. The companion documents `BACKEND_BLOCKCHAIN_PLAN.md`, `FEATURE_IDEAS.md`, `Real-Estate Project Audit.md`, and the `hackathon-zero-eth-claim` spec hold authority over any conflicting decision; this spec defers to them.
