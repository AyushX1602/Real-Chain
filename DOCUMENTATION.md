# RealChain v2 — Comprehensive Technical Documentation

> **Generated**: 2026-05-19 | **Repo**: [AyushX1602/Real-Chain](https://github.com/AyushX1602/Real-Chain) | **License**: See `LICENSE`

---

## 1. Project Overview

**RealChain v2** is a blockchain-based platform for **fractional real-estate ownership**. Property owners tokenize physical assets into ERC-20 ownership units (100 PROP tokens = 100% of a property), investors purchase fractions with USDC stablecoins, rental income is distributed as USDC dividends proportional to holdings, and token holders can trade on a built-in secondary marketplace.

### Core Objectives

| Objective | Description |
|-----------|-------------|
| **Fractional Ownership** | Democratize real-estate investment by splitting properties into 100 fungible ERC-20 tokens |
| **Fair Dividend Distribution** | Ensure rent payouts use historical (snapshot-safe) balances, preventing timing attacks |
| **Gasless Transactions (UGF)** | Enable users with **zero ETH** to claim rent and trade via the Universal Gas Framework, paying gas fees in a mock stablecoin |
| **Security Research** | Compare a vulnerable baseline (`BrokenRentalDistribution`) against two patched models (V1 epoch-loop, V2 constant-time) for an academic paper |
| **Role-Based UX** | Provide distinct dashboards for property owners (deposit rent, manage listings) and investors (claim rent, view portfolio) |

### Scope

- **Smart Contract Layer**: 9 Solidity contracts covering token minting, dividend distribution (V1 + V2), marketplace trading, and a research-only vulnerable baseline.
- **Frontend**: React 18 SPA with MetaMask integration, UGF gasless mode, dark/light theme, multi-agent orchestration, and analytics.
- **Backend**: Express.js API with MongoDB for property caching, transaction logging, on-chain event indexing, USDC faucet, and market data.
- **Target Network**: Base Sepolia (chain ID `84532`) for the UGF hackathon demo; also supports local Hardhat (`31337`) and Sepolia (`11155111`).

---

## 2. Tech Stack & Implementation

### 2.1 Technology Breakdown

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Smart Contracts** | Solidity | 0.8.28 | Core business logic (tokens, dividends, marketplace) |
| **Contract Framework** | Hardhat | 2.28.6 | Compilation, testing, deployment, local chain |
| **Contract Libraries** | OpenZeppelin | 5.6.1 | ERC20Votes, Ownable, ReentrancyGuard, SafeERC20 |
| **Frontend Framework** | React | 18.3.1 | Single-page application |
| **Frontend Build** | Vite | 5.4.0 | Dev server and bundler |
| **Frontend Routing** | react-router-dom | 6.27.0 | Client-side navigation |
| **Blockchain Interaction** | ethers.js | 6.13+ | Contract calls, wallet integration, event parsing |
| **Gasless SDK** | @tychilabs/react-ugf | 2.0.0 | UGF modal for gas-free transactions |
| **Embedded Wallet** | @privy-io/react-auth | 1.92.0 | Optional email-based onboarding (Tier 3) |
| **Animation** | framer-motion | 11.18.2 | UI transitions and micro-animations |
| **Backend Runtime** | Express.js | 5.2.1 | REST API server |
| **Database** | MongoDB / Mongoose | 9.6.2 | Property cache, transaction logs, holdings, user profiles |
| **Logging** | pino + pino-http | 9.14 / 10.5 | Structured JSON logging |
| **Rate Limiting** | express-rate-limit | 7.5.1 | API abuse prevention |
| **Environment** | dotenv | 16–17 | Secrets and configuration management |
| **Dev Tooling** | nodemon | 3.1.14 | Backend hot-reload |
| **Knowledge Graph** | Graphify | latest | AST-based codebase navigation and memory |

### 2.2 Technology-to-Feature Mapping

| Feature | Technologies Used |
|---------|------------------|
| Property Tokenization | Solidity, OpenZeppelin ERC20Votes, Hardhat |
| Dividend Distribution (V1) | Solidity, ERC20Votes `getPastVotes()` |
| Dividend Distribution (V2) | Solidity, cumulative reward index, `IDistributionHook` |
| Primary/Secondary Marketplace | Solidity, USDC transfers, ReentrancyGuard |
| Wallet Connection | ethers.js, MetaMask `window.ethereum`, React Context |
| Gasless Transactions | @tychilabs/react-ugf, UGF Gateway `/quote` API |
| Property Browsing (no wallet) | ethers.js `JsonRpcProvider`, React |
| On-Chain Event Indexing | ethers.js `queryFilter`, MongoDB, Node.js `setInterval` |
| Transaction Analytics | MongoDB aggregation, Express REST, React charts |
| USDC Faucet | Express route, ethers.js `Wallet`, MockUSDC `mint()` |
| Dark/Light Theme | CSS custom properties, `ThemeContext`, `localStorage` |
| Smart Agent / AI Assistant | SmartAgentContext, configurable LLM provider, browser-side API calls |
| Multi-Agent Orchestration | Custom `Orchestrator`, `AgentBus`, `BaseAgent`, per-screen agents |

---

## 3. Feature List

### 3.1 Smart Contract Features

- **F-SC01**: MockUSDC token deployment (6-decimal ERC-20, owner-mintable)
- **F-SC02**: Property tokenization (100 PROP tokens per property, ERC20Votes)
- **F-SC03**: Auto-delegation on token receipt (ensures checkpoint tracking)
- **F-SC04**: PropertyFactory registry with V1/V2 distribution mode selection
- **F-SC05**: RentalDistribution V1 — epoch-based, snapshot-safe dividend claims
- **F-SC06**: RentalDistributionV2 — O(1) constant-time claims via cumulative index
- **F-SC07**: Distribution hook system (`IDistributionHook`) for V2 transfer-time accounting
- **F-SC08**: Marketplace — primary sales (owner → investor) at fixed USDC price
- **F-SC09**: Marketplace — secondary listings (investor → investor)
- **F-SC10**: BrokenRentalDistribution — vulnerable research baseline
- **F-SC11**: ReentrancyGuard + CEI pattern on all state-changing functions

### 3.2 Frontend Features

- **F-FE01**: Landing page with animated hero and feature highlights
- **F-FE02**: Property marketplace browsing (no wallet required)
- **F-FE03**: Property detail page with buy flows (primary + secondary)
- **F-FE04**: Portfolio management (holdings, listing creation/cancellation)
- **F-FE05**: Claim Rent page with per-epoch and batch claiming
- **F-FE06**: Owner Dashboard (rent deposit, holder concentration, cadence indicator)
- **F-FE07**: Investor Dashboard (portfolio summary, pending rent, quick claim)
- **F-FE08**: MetaMask connection with network auto-switch (Hardhat/Sepolia/Base Sepolia)
- **F-FE09**: Role detection (Owner vs Investor) from on-chain property ownership
- **F-FE10**: UGF gasless mode toggle (on → gas in Mock USD; off → gas in ETH)
- **F-FE11**: UGF cost banner (side-by-side "with UGF" vs "without UGF" cost preview)
- **F-FE12**: Activity feed (recent transactions from backend)
- **F-FE13**: Analytics page (KPI tiles, holder concentration, rent leaderboard)
- **F-FE14**: Watchlist (localStorage-persisted property bookmarks)
- **F-FE15**: Faucet panel (request 100 mock USDC from backend)
- **F-FE16**: Dark/light theme with CSS custom properties and localStorage persistence
- **F-FE17**: Settings popover (theme, UGF toggle, Smart Agent config, AI assistant)
- **F-FE18**: Screen primitives (OnChainBadge, GasMethodBadge, FractionalOwnershipBar, etc.)
- **F-FE19**: Smart Agent with gas optimization suggestions and optional LLM assistant
- **F-FE20**: Multi-agent orchestration (6 screen-bound agents via hub-and-spoke bus)
- **F-FE21**: Read-only browsing via public RPC (no MetaMask needed to view properties)
- **F-FE22**: Toast notification system
- **F-FE23**: Account switcher for demo role changes

### 3.3 Backend Features

- **F-BE01**: Property CRUD with indexer-backed denormalized fields
- **F-BE02**: Transaction logging (client POST + on-chain indexer)
- **F-BE03**: Transaction query with keyset pagination, filters, and stats
- **F-BE04**: Time-series analytics (`/api/transactions/timeseries`)
- **F-BE05**: Holder queries per property (`/api/properties/:id/holders`)
- **F-BE06**: On-chain event indexer (12-second polling, chunked log scanning)
- **F-BE07**: USDC faucet with 1-hour per-wallet cooldown
- **F-BE08**: ETH/USD market price endpoint (Coingecko with 5-min cache)
- **F-BE09**: User profile tracking (wallet connect persistence)
- **F-BE10**: SIWE (Sign-In With Ethereum) authentication middleware
- **F-BE11**: Rate limiting (600 reads/min, 60 writes/min per IP)
- **F-BE12**: Health check endpoint with MongoDB/indexer status
- **F-BE13**: Graceful degradation without MongoDB
- **F-BE14**: Structured logging (pino) with health-check suppression

### 3.4 DevOps & Tooling Features

- **F-DO01**: Local Hardhat node with 20 funded accounts
- **F-DO02**: Automated deployment script (MockUSDC + Factory + 2 sample properties)
- **F-DO03**: Demo seeding script (`seedDemo.js`) for deterministic demo state
- **F-DO04**: Simulation script (`simulate.js`) — full buy→rent→claim→trade cycle
- **F-DO05**: 31 Hardhat tests (core, security, gas benchmarks, V1/V2 comparison)
- **F-DO06**: Multi-network support (localhost, Sepolia, Base Sepolia, Mumbai)
- **F-DO07**: Graphify knowledge graph with automated updates via hooks
- **F-DO08**: Git pre-commit hook for graph freshness
- **F-DO09**: npm convenience scripts (compile, test, deploy, dev servers)

---

## 4. Functional Specifications

### 4.1 Property Tokenization

**Contract**: `PropertyFactory.sol` → `PropertyToken.sol`

- **Input**: Property name (string), location (string), value in INR paise (uint256), price per token in USDC (uint256), optional V2 flag (bool)
- **Process**: Factory deploys three contracts atomically: `PropertyToken` (mints 100 PROP to caller), `RentalDistribution` (V1 or V2), `Marketplace` (with initial price). Registers the suite in an on-chain array.
- **Output**: `PropertyCreated` event with property ID, contract addresses, and owner. All 100 tokens (100 × 10¹⁸ units) are minted to the caller with auto-delegation enabled.
- **Invariant**: Total supply is always exactly 100 PROP. One token = 1% ownership.

### 4.2 Rental Distribution V1 (Epoch-Loop)

**Contract**: `RentalDistribution.sol`

**Deposit** (`depositRental`):
- **Input**: USDC amount (uint256, 6 decimals). Only callable by property owner.
- **Process**: Transfers USDC from owner to contract. Records `snapshotTime = block.timestamp - 1` to prevent same-block manipulation. Creates a new epoch entry.
- **Output**: `RentalDeposited` event.

**Claim** (`claimAll`):
- **Input**: None (uses `msg.sender`).
- **Process**: Iterates all epochs. For each unclaimed epoch, computes `share = (getPastVotes(user, snapshotTime) × epochAmount) / getPastTotalSupply(snapshotTime)`. Marks claimed. Transfers aggregate USDC.
- **Output**: `AllDividendsClaimed` event with total amount and epoch count.
- **Gas**: O(n_epochs) — grows linearly with unclaimed epochs. Formula: `85,503 + (epochs - 1) × 42,858 gas`.

### 4.3 Rental Distribution V2 (Constant-Time)

**Contract**: `RentalDistributionV2.sol`

**Deposit** (`depositRental`):
- **Process**: Updates global `accRewardPerToken += (amount × PRECISION) / totalSupply`. Tracks dust from integer division. O(1).

**Claim** (`claimAll`):
- **Process**: Accrues pending rewards (`cumulative - rewardDebt + pendingRewards`). Resets pending to 0, transfers USDC. O(1) — no epoch iteration.
- **Transfer Hooks**: `onBeforeTokenTransfer` accrues both parties; `onAfterTokenTransfer` resets debt to new cumulative. Prevents post-deposit buyers from claiming old rewards.

### 4.4 Marketplace

**Contract**: `Marketplace.sol`

**Primary Sale** (`buyFromOwner`):
- **Input**: Number of full tokens to buy (uint256).
- **Prerequisites**: Owner must have approved marketplace for PROP tokens. Buyer must have approved marketplace for USDC.
- **Process**: Pulls USDC from buyer to owner. Pushes PROP from owner to buyer.

**Secondary Listing** (`createListing`):
- **Input**: Amount (uint256), price per token in USDC (uint256).
- **Process**: Validates seller balance and marketplace approval. Creates listing struct.

**Secondary Purchase** (`buyFromListing`):
- **Process**: Marks listing inactive (CEI), then executes USDC and PROP transfers.

**Cancel** (`cancelListing`): Marks listing inactive. Seller-only.

### 4.5 UGF Gasless Flow

**Context**: `UGFContext.jsx`

- **`ugfExecute(target, abi, fnName, args)`**: Encodes the function call via `ethers.Interface.encodeFunctionData`. If UGF is enabled and chain is Base Sepolia (84532), opens the UGF modal via `openUGF({ signer, tx, destChainId })`. Otherwise falls back to `signer.sendTransaction()`.
- **`ugfApprove(tokenAddress, spender, amount)`**: Wraps ERC-20 `approve()` through `ugfExecute` so approvals are also gasless.
- **`getQuote(target, abi, fnName, args)`**: POSTs to `https://gateway.universalgasframework.com/quote` with `payment_coin: "TYI_MOCK_USD"` to get a fee estimate.
- **`logTx(payload)`**: POSTs the transaction record to the backend for the activity feed.
- **Toggle**: Persisted in `localStorage` under `realchain.ugf.enabled`. When off, all flows revert to native ETH gas.

### 4.6 On-Chain Event Indexer

**File**: `backend/jobs/indexer.js`

- **Polling**: Every 12 seconds when `ENABLE_INDEXER=true`.
- **Events Indexed**: `PropertyCreated`, `Transfer`, `RentalDeposited`, `AllDividendsClaimed`, `TokensBought`, `ListingCreated`, `ListingCancelled`.
- **Chunking**: Processes `INDEXER_CHUNK_BLOCKS` (default 10) blocks per query to respect free-tier RPC limits.
- **Checkpointing**: Per `(chainId, contractAddress, eventName)` — survives restarts.
- **Denormalization**: After event scan, reads live `totalSupply`, `balanceOf(owner)`, `pricePerToken`, `epochCount` and computes `cadenceDays` (median of last 12 deposit intervals).

### 4.7 USDC Faucet

**Route**: `POST /api/faucet/usdc`

- **Input**: `{ wallet: "0x..." }`
- **Process**: Server-side call to `MockUSDC.mint(wallet, 100e6)` using `FAUCET_PRIVATE_KEY`.
- **Rate Limit**: 1 mint per wallet per hour (in-memory map).
- **Cooldown Check**: `GET /api/faucet/usdc/:wallet` returns availability status.

### 4.8 Role Detection

**Context**: `Web3Context.jsx` → `refreshRoleHint()`

- Iterates all properties from the factory contract.
- If connected wallet matches any property's `owner` field → role = "Owner".
- Otherwise → role = "Investor".
- Navbar adapts: Dashboard link routes to `/owner` or `/investor`.

### 4.9 Multi-Agent Orchestration

**Directory**: `frontend/src/agents/`

- **Architecture**: Hub-and-spoke. `Orchestrator` + `AgentBus` route messages; agents never communicate directly.
- **Agents**: `MarketplaceAgent` (/marketplace), `PortfolioAgent` (/portfolio), `ClaimRentAgent` (/dividends), `OwnerControlRoomAgent` (/owner), `ActivityAgent` (/activity), `AnalysisAgent` (/analytics).
- **Lifecycle**: `init` → `activate` (on route match) → `deactivate` (on route leave) → `destroy`.
- **State**: Each agent has a subscriber list. Shared state (account, chainId, gas, UGF toggle) is mirrored via `AgentProvider`.

---

## 5. Workflows & User Journeys

### 5.1 Investor: Zero-ETH Rent Claim (Primary Demo Flow)

```
1. Investor opens app → Landing page
2. Clicks "Connect Wallet" → MetaMask prompt
3. App detects chain ≠ Base Sepolia → "Wrong network" button
4. Clicks "Switch" → MetaMask adds/switches to Base Sepolia (84532)
5. Web3Context derives role = "Investor" → navbar shows "Investor" badge
6. Navigates to /dividends (Claim Rent)
7. Page loads properties from factory, reads pendingDividends() per property
8. UGF toggle is ON → CostBanner fetches /quote from UGF Gateway
9. CostBanner shows: "Gas in Mock USD: $0.02 | Without UGF: $3.42 in ETH"
10. Investor clicks "Claim All Rent"
11. UGFContext encodes claimAll() calldata
12. openUGF() opens the UGF modal → user confirms in Mock USD
13. UGF sponsors + executes tx → receipt returned
14. logTx() POSTs to backend → activity feed updates
15. pendingDividends → $0.00, USDC balance increased, ETH unchanged at 0
```

### 5.2 Owner: Deposit Rental Income

```
1. Owner connects wallet → role detected as "Owner"
2. Navigates to /owner (Owner Dashboard)
3. Sees owned properties with holder concentration strip, cadence indicator
4. Enters USDC amount in deposit form (validated: 0.01 – 1,000,000)
5. If UGF on: ugfApprove() approves USDC spend via UGF modal
6. Then ugfExecute() calls depositRental(amount) via UGF
7. Epoch created on-chain, event indexed by backend
8. Dashboard refreshes: epoch count +1, last deposit timestamp updated
```

### 5.3 Token Trading (Primary + Secondary)

```
Primary Buy:
1. Investor browses /marketplace → property cards with FractionalOwnershipBar
2. Clicks property → /property/:id detail page
3. Enters token quantity, sees USDC cost
4. ugfApprove() for USDC → ugfExecute() calls buyFromOwner()
5. PROP tokens transferred to investor, USDC to owner

Secondary Listing:
1. Investor goes to /portfolio
2. Clicks "List for Sale" on a holding → enters amount + price
3. ugfApprove() for PROP tokens → ugfExecute() calls createListing()

Secondary Purchase:
1. Another investor sees listing on property detail page
2. ugfApprove() for USDC → ugfExecute() calls buyFromListing()
```

### 5.4 Data Flow Architecture

```
┌─────────────┐     ethers.js      ┌──────────────────┐
│  React SPA  │ ◄────────────────► │  Base Sepolia    │
│  (port 3000)│                    │  Smart Contracts │
│             │     fetch()        ├──────────────────┤
│             │ ◄────────────────► │  Express Backend │
└─────────────┘                    │  (port 5000)     │
                                   │    ├─ MongoDB    │
                                   │    ├─ Indexer    │
                                   │    └─ Faucet     │
                                   └──────────────────┘
                                          │
                                   UGF Gateway (quote)
```

**Read Path**: Frontend → RPC Provider → Smart Contracts (or) Frontend → Backend API → MongoDB (indexed data).

**Write Path**: Frontend → UGFContext → UGF Modal → UGF Gateway (sponsor + execute) → Smart Contract → Event emitted → Indexer picks up → MongoDB updated → Activity Feed refreshes.

### 5.5 Provider Tree (Component Hierarchy)

```
ThemeProvider
  └─ PrivyShell (optional embedded wallet)
       └─ UGFProvider (mode="testnet")
            └─ BrowserRouter
                 └─ Web3Provider (wallet, contracts)
                      └─ UGFContextProvider (gasless execution)
                           └─ SmartAgentProvider (gas optimizer, AI)
                                └─ ToastProvider
                                     └─ AgentProvider (multi-agent bus)
                                          └─ App (routes + navbar)
```

---

## 6. Feature Requirements

### 6.1 Environment Variables

| Variable | Required For | Default |
|----------|-------------|---------|
| `PRIVATE_KEY` | Contract deployment, faucet | (none) |
| `BASE_SEPOLIA_RPC_URL` | Base Sepolia operations | `https://sepolia.base.org` |
| `MONGODB_URI` | Backend database | `mongodb://localhost:27017/realchain` |
| `BACKEND_PORT` | Backend server | `5000` |
| `ENABLE_INDEXER` | On-chain event indexing | `false` |
| `FAUCET_PRIVATE_KEY` | USDC faucet minting | Falls back to `PRIVATE_KEY` |
| `VITE_NETWORK_MODE` | Frontend network selection | `baseSepolia` |
| `VITE_MOCK_USDC_ADDRESS` | Frontend USDC contract override | Hardcoded per network |
| `VITE_PROPERTY_FACTORY_ADDRESS` | Frontend factory override | Hardcoded per network |
| `VITE_BACKEND_URL` | Frontend API base URL | `http://localhost:5000` |
| `VITE_ETH_USD_RATE` | Cost banner fallback | `2000` |
| `VITE_PRIVY_APP_ID` | Embedded wallet (Tier 3) | (none — feature disabled) |
| `BASESCAN_API_KEY` | Contract verification | (none) |

### 6.2 Per-Feature Prerequisites

| Feature | Prerequisites |
|---------|--------------|
| **Property Tokenization** | Deployed MockUSDC + PropertyFactory, funded deployer wallet |
| **V1 Dividend Claims** | Property exists, owner has deposited rent, investor holds PROP tokens |
| **V2 Dividend Claims** | Property created with `useV2=true`, distribution hook set on token |
| **Primary Buy** | Owner has approved marketplace for PROP tokens, buyer has USDC |
| **Secondary Trading** | Seller has approved marketplace for PROP, listing is active |
| **UGF Gasless Mode** | Base Sepolia network (chain 84532), `TYI_MOCK_USD` balance in wallet, `@tychilabs/react-ugf` installed |
| **USDC Faucet** | `FAUCET_PRIVATE_KEY` set, faucet wallet is MockUSDC owner, Base Sepolia RPC reachable |
| **On-Chain Indexer** | `ENABLE_INDEXER=true`, MongoDB connected, `deployed-addresses.json` present |
| **Activity Feed** | Backend running, MongoDB connected, indexer enabled or client-side `logTx()` calls |
| **Analytics Page** | Backend with indexed transactions, `/api/transactions/stats` and `/timeseries` responding |
| **Cost Banner** | UGF Gateway `/quote` endpoint reachable (CORS), ETH/USD rate available |
| **Dark Mode** | No prerequisites — CSS custom properties + localStorage |
| **Smart Agent AI** | User provides API key for chosen LLM provider (OpenAI, Anthropic, etc.) in settings |
| **Embedded Wallet** | `VITE_PRIVY_APP_ID` configured, `@privy-io/react-auth` installed |
| **Contract Verification** | `BASESCAN_API_KEY` set in `.env` |

### 6.3 System Requirements

| Requirement | Specification |
|-------------|--------------|
| **Node.js** | ≥ 18 |
| **Browser** | Chrome/Firefox/Brave with MetaMask extension |
| **MongoDB** | 6.x+ (optional — backend degrades gracefully without it) |
| **Network** | Internet access for Base Sepolia RPC and UGF Gateway |
| **Wallet** | MetaMask (or Privy embedded wallet for Tier 3) |

### 6.4 Deployment Addresses (Current Base Sepolia)

| Contract | Address |
|----------|---------|
| MockUSDC | `0xc90610277191F7Dbe7Ddf18319Bd28D3aAAe9a38` |
| PropertyFactory | `0xa8bb0D4923C1aBB9294cBc115c6FF81B2DaC0168` |
| Demo Investor | `0x25e6f47Fbf5a4Fc83dE6C5D6a5dF3247Ee71c08F` |
| Demo Owner | `0xa7Fa1328E32a69C6989C4956D9C7e1f088fbBC3b` |

### 6.5 Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `RealEstatePlatform.test.js` | 17 | Core USDC flows, snapshot correctness |
| `SnapshotAttack.test.js` | 5 | Attack demo + defence proof |
| `GasBenchmark.test.js` | 3 | Gas tables for research paper |
| `DistributionV2.test.js` | 3 | V2 security, fairness, accounting |
| `FactoryDistributionMode.test.js` | 2 | V1 default + V2 mode switch |
| `V1VsV2Benchmark.test.js` | 1 | Side-by-side gas/scalability comparison |
| **Total** | **31** | All passing as of 2026-05-19 |

### 6.6 Known Limitations

- No KYC/AML compliance.
- MockUSDC is not real USDC — testnet use only.
- Fixed 100-token supply per property (ERC-1155 proposed for production scale).
- No production security audit performed.
- UGF gateway quote depends on browser CORS; deployed-browser behavior needs verification.
- Inline `style={{ color: "#191A23" }}` literals on some pages don't follow dark mode tokens yet.
- Fresh `.env.example` placeholder values can break Hardhat config if copied literally.

---

*End of document.*
