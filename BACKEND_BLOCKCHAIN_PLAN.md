# Backend & Blockchain Implementation Plan

> Last updated: 2026-05-19
>
> This document is the canonical plan for the off-chain backend and on-chain
> contracts of RealChain. Frontend specifics live in
> [`implementation_plan.md`](./implementation_plan.md) and
> [`FEATURE_IDEAS.md`](./FEATURE_IDEAS.md). This file is grounded in the
> repository as it stands today, not in aspiration. Where something is
> aspirational it is marked **(future)**.
>
> **Companion document — required reading**:
> [`Real-Estate Project Audit.md`](./Real-Estate%20Project%20Audit.md)
> is the historical audit + planning + research-paper conversation log
> that produced everything in this repo. Anything in that file is
> authoritative for **why** decisions were made; this file is
> authoritative for **how** the system is built and operated today.
> Any agent working on this repo should treat the audit doc as the
> background and this doc as the working contract.

## 0. Relationship to `Real-Estate Project Audit.md`

The audit document is the long-form record of how RealChain went from a
flawed first draft to its current shape. It contains:

- The original blunt review that flagged the snapshot timing bug,
  missing frontend, and ETH-as-rent-currency problem
- The fix narrative (ERC20Votes adoption, USDC switch, V2 design)
- The research-paper framing decisions (Track 4 vs Track 3, ICBDS,
  V1/V2 selection rule)
- The hackathon scoping conversation that led to UGF integration and the
  role-split dashboards
- The verbatim demo scripts and viva talking points

This implementation plan inherits every accepted decision from that
audit. Where the two documents disagree, **this file wins for
operational intent** (because it tracks the live repo state) and the
audit wins for **historical rationale** (because it explains why a
decision was made). Specifically:

| Audit decision | Where it lives in this plan |
|----------------|-----------------------------|
| Drop the live-balance dividend math; adopt ERC20Votes snapshots | §2.3 (V1 design), §2.4 (security mitigations) |
| Switch settlement currency from ETH to USDC | §2.1 (`MockUSDC`), §3.3 (transactions schema) |
| Build V2 as an O(1) accumulator alternative to V1 | §2.3, §9 (contract size constraint via deployer indirection) |
| Two distribution modes selectable per property | §2.3, §6.7 (upgrade path discussion) |
| Add an Express + MongoDB backend that earns its keep through the activity feed and analytics | §3 in full |
| Frontend has separate role-aware dashboards (Owner / Investor) and is not a single page for both roles | §1 architecture diagram, §4 walk-throughs, also enforced by `frontend/src/App.jsx` routes |
| Wrap state-changing flows with UGF so investors can pay gas in Mock USD | §4.1 (claim flow), §6.5 (sponsor wallet) |
| Cut the V1/V2 + snapshot-attack research surface from the hackathon README/demo, keep it for the academic paper | §2.3 (V2 marked research-only), §10 (contributor onboarding) |
| Use `uvx --from graphifyy graphify.exe` as the Graphify command on this machine | §10 (contributor checklist) |
| Memory hygiene: append session log to `CLAUDE.md`, update `memory/decisions.md` and `memory/flags.md` after meaningful work | §7.2 (PR checklist), §10 |

If you change the architecture in a way that contradicts an audit
decision, do **all** of the following:

1. Update this plan in the relevant section.
2. Add a row to `memory/decisions.md` explaining the reversal.
3. Append a session entry to `CLAUDE.md`.
4. Note that the audit doc is now stale on that specific point — but
   leave it in place as historical record.

## 1. Snapshot of the system today

```
                ┌──────────────────────────┐
                │  React + Vite frontend   │
                │  port 3000               │
                │  Web3Context · UGFContext│
                │  · SmartAgentContext     │
                └─────┬────────────────┬───┘
                      │ ethers.js v6   │ fetch()
                      ▼                ▼
        ┌──────────────────┐   ┌────────────────────────┐
        │ Base Sepolia     │   │ Express API            │
        │ (chain id 84532) │   │ port 5000              │
        │ (and localhost   │   │ Mongoose · CORS · Morgan│
        │  for hardhat)    │   └─────────┬──────────────┘
        └─────┬────────────┘             │
              │                          ▼
   ┌──────────┴──────────┐         ┌────────────────┐
   │ MockUSDC            │         │ MongoDB        │
   │ PropertyFactory ───►│         │ realchain db   │
   │  ├ PropertyToken    │         │  • properties  │
   │  ├ RentalDistribV1  │         │  • transactions│
   │  └ Marketplace      │         │  • users       │
   │ (per property)      │         └────────────────┘
   └─────────────────────┘
```

### What ships today

| Layer | What's real | Where |
|-------|-------------|-------|
| Contracts | 9 Solidity files, OZ 5.6, Solidity 0.8.28, evmVersion `cancun`, optimizer 200 runs | `contracts/` |
| Tests | 6 test suites covering core flows, V1 vs V2, snapshot attack, gas benchmarks | `test/` |
| Scripts | `deploy.js`, `seedDemo.js`, `simulate.js` | `scripts/` |
| Backend | Express + Mongoose, four route modules, one middleware, three models | `backend/` |
| Build/dev tooling | `npm run` scripts wired through root `package.json` | `package.json` |
| Memory layer | Graphify graph + Kiro hooks + git pre-commit | `graphify-out/`, `.kiro/hooks/`, `scripts/git-hooks/` |

The dApp is functional end-to-end on a local Hardhat node. Base Sepolia is
configured but unfunded as of this snapshot.

---

## 2. Smart contract architecture

### 2.1 Contract inventory

| Contract | LoC | Purpose | Notes |
|----------|----:|---------|-------|
| `MockUSDC.sol` | 31 | 6-decimal stablecoin used for rent + secondary purchases | Test-only; `mint()` is `onlyOwner` (deployer signs the faucet route) |
| `PropertyToken.sol` | 127 | ERC-20 share token per property | Inherits `ERC20Votes` so we get historical balance checkpoints for free |
| `PropertyFactory.sol` | 128 | Deploys the per-property contract trio and registers metadata | Selectable V1 / V2 distribution |
| `Marketplace.sol` | 189 | Primary (owner → buyer) + secondary (peer-to-peer) sales in USDC | One marketplace per property |
| `RentalDistribution.sol` | 184 | V1 epoch-loop dividend distribution (default) | Snapshot-safe via ERC20Votes `getPastVotes` |
| `RentalDistributionV2.sol` | 261 | V2 accumulator-based constant-time claims | Research surface only; not the hackathon target |
| `RentalDistributionV2Deployer.sol` | 31 | Indirection layer to keep factory size under contract size limit | Pure deploy helper |
| `IDistributionHook.sol` | 12 | Interface for the V2 transfer hook | Lets `PropertyToken` call into the active distribution |
| `BrokenRentalDistribution.sol` | 88 | Intentionally vulnerable baseline for the snapshot-attack research | Never deployed in production paths |

### 2.2 Per-property graph

Every property mint deploys three contracts and binds them together:

```
PropertyFactory.createProperty(name, location, valueInr, pricePerToken)
  │
  ├── new PropertyToken(name, "PROP-N", totalSupply = 100e18)
  │     • ERC20Votes auto-delegate
  │     • Mint full supply to property owner
  │
  ├── new RentalDistribution(usdc, propertyToken, owner)  ← V1 default
  │     • or RentalDistributionV2 via the V2 deployer
  │     • PropertyToken's transfer hook calls into the active dist
  │
  └── new Marketplace(usdc, propertyToken, owner, pricePerToken)
        • Primary buys pull from owner allowance
        • Listings sit in the marketplace until filled or cancelled
```

Storage layout per property is the address triplet
`{propertyToken, rentalDistribution, marketplace}` plus metadata.

### 2.3 V1 vs V2 distribution

V1 — the default and hackathon target — is **epoch-driven**:

1. Owner deposits rent → new epoch with a `(totalAmount, snapshotTime)` pair
2. `claimEpoch(i)` reads the user's `getPastVotes(snapshotTime)`, computes
   pro-rata share, transfers USDC, marks `claimed[i][user] = true`
3. `claimAll()` loops every unclaimed epoch in one transaction

V2 — research surface — is **accumulator-driven**:

1. A monotonically increasing `accRewardPerShare` value tracks lifetime
   accruals
2. Each user has a `userRewardDebt` checkpoint
3. Claims are constant-time regardless of epoch count
4. `PropertyToken.transfer` calls `IDistributionHook.beforeTokenTransfer`
   so V2 can settle pending rewards before the balance changes

V2 is interesting academically but has been **explicitly cut from the
hackathon submission** to keep the demo story crisp. It stays in the repo
for the paper.

### 2.4 Security and trust assumptions

| Concern | Mitigation today | Where it's tested |
|---------|------------------|--------------------|
| Snapshot timing attack (buy after deposit, claim early epoch) | ERC20Votes historical balances; `getPastVotes(snapshotTime)` | `test/SnapshotAttack.test.js` |
| Re-entrancy on USDC transfer | OZ `ReentrancyGuard` on every state-changing distribution call; CEI ordering | `test/RealEstatePlatform.test.js` |
| Integer overflow | Solidity 0.8.28 built-in checks | n/a |
| Owner-only deposit / role drift | OZ `Ownable` per RentalDistribution; owner is the property owner from factory | covered in functional tests |
| Front-running secondary purchases | Listings priced in 6dp USDC, buyer pays exact price; no MEV-sensitive math | n/a |
| Malicious factory deploy | Anyone can call `createProperty`; demo design choice. **(future)**: gate with role |

### 2.5 Known constraints

- **Contract size limit hit during V2 wiring** — solved via
  `RentalDistributionV2Deployer.sol` indirection. Future expansion (e.g. a
  governor) must check the factory's bytecode size budget before merging.
- **`MockUSDC.mint()` is `onlyOwner`** — the faucet route signs as the
  deployer, so this works on testnet without anyone else being able to
  mint. **(future)** in production this becomes a real USDC integration
  with no `mint`.
- **No upgradeability** — contracts are immutable. To roll a fix, deploy
  a new property and migrate manually. Acceptable for the prototype scope.

---

## 3. Backend architecture (Express + MongoDB)

### 3.1 Process model

- Single Node process, port 5000, no clustering
- CORS open (testnet demo); morgan dev-format logger
- Mongo connect via `mongoose.connect(process.env.MONGODB_URI)` with a
  graceful-degradation middleware (`backend/middleware/db.js`):
  - GET requests that arrive while Mongo is offline return `[]`
  - POST/PUT requests return 503 with a hint
- Health probe at `GET /api/health` reports timestamp and Mongo state

### 3.2 Route surface (current)

| Method | Path | Module | Purpose |
|--------|------|--------|---------|
| GET | `/api/health` | `server.js` | Process + Mongo status |
| GET | `/api/properties` | `routes/properties.js` | List all cached properties |
| GET | `/api/properties/:id` | `routes/properties.js` | Single property by id |
| POST | `/api/properties/sync` | `routes/properties.js` | Pull latest state from on-chain factory and upsert into Mongo |
| GET | `/api/properties/owner/:wallet` | `routes/properties.js` | Properties owned by a wallet |
| GET | `/api/transactions` | `routes/transactions.js` | Filterable activity feed (`?wallet=&type=&limit=`) |
| POST | `/api/transactions` | `routes/transactions.js` | Log a confirmed receipt; bumps user aggregates |
| GET | `/api/transactions/stats` | `routes/transactions.js` | Global aggregates |
| GET | `/api/transactions/stats/:wallet` | `routes/transactions.js` | Per-wallet aggregates |
| GET | `/api/transactions/timeseries` | `routes/transactions.js` | Daily/hourly buckets for `/analytics` |
| POST | `/api/users/connect` | `routes/users.js` | Upsert wallet on connect |
| GET | `/api/users/:wallet` | `routes/users.js` | User profile |
| GET | `/api/users/leaderboard/top` | `routes/users.js` | Top investors by total claimed |
| POST | `/api/faucet/usdc` | `routes/faucet.js` | Mint 100 USDC (rate-limited per wallet) |
| GET | `/api/faucet/usdc/:wallet` | `routes/faucet.js` | Cooldown introspection |

### 3.3 Data model

```text
properties (Mongoose)
  propertyId (Number, unique)         ← matches on-chain index
  name, location, totalValue
  tokenAddress, rentalAddress, marketAddress, owner (lowercased)
  totalSupply, availableSupply
  epochCount, totalRentDeposited
  useV2 (Boolean), chainId            ← currently 84532

transactions
  txHash (unique)                     ← idempotent inserts
  type ∈ {buy, sell, deposit, claim, listing, cancel}
  from (lowercased)
  propertyId, amount (USDC), tokenAmount (PROP)
  gasMethod ∈ {eth, ugf}
  gasCostUsd (number)
  status, chainId, createdAt

users
  wallet (unique, lowercased)
  role ∈ {owner, investor, unknown}
  lastConnected
  totalClaimed, totalInvested, totalDeposited, txCount
```

Indexes: `transactions{from, type}`, `transactions{propertyId}`,
unique on `txHash`, `wallet`, `propertyId`.

### 3.4 Off-chain ↔ on-chain integration strategy

The contracts are the source of truth. The backend is a **cache and
analytics layer**, never an authority. Three flows:

1. **Frontend reads** — bypass the backend, talk to chain directly via
   `ethers.JsonRpcProvider` (read-only) or `BrowserProvider` (write). The
   marketplace listing, property page, portfolio, dividends, owner dashboard,
   and investor dashboard all hydrate from chain.

2. **Frontend writes** — the call goes on-chain via UGF or signer. Once
   the receipt confirms, the frontend `POST`s a summary to
   `/api/transactions`. No backend signature, no on-chain writes from the
   server (except faucet — see below).

3. **Server writes** (faucet only) — `POST /api/faucet/usdc` builds an
   `ethers.Wallet` from `FAUCET_PRIVATE_KEY` (or `PRIVATE_KEY`) and calls
   `MockUSDC.mint(to, 100e6)`. Rate-limited to one mint per wallet per
   hour via an in-memory Map.

There is **no event indexer running**. Where the backend needs aggregate
data (counts, sums, leaderboard, holders), it computes from the
`transactions` collection. The trade-off: if a transaction never gets
POSTed (e.g. user closes the tab during the receipt), it will be missing
from the feed even though it succeeded on-chain. **(future)** swap the
client-side log call for a dedicated indexer (see §6.3).

### 3.5 Trust boundary

| Source | Trust level | Why |
|--------|-------------|-----|
| Chain reads | Authoritative | Block-final |
| `POST /api/transactions` body | Untrusted | Anyone can POST a fake receipt |
| `POST /api/users/connect` body | Untrusted | Anyone can claim any wallet |
| `POST /api/faucet/usdc` body | Constrained | Address validated, rate-limited |

The backend currently does not verify that a posted `txHash` actually
exists. That's fine for an analytics feed (worst case the dashboard shows
sample-looking rows) but it must NOT be relied on for any payout decision.
**(future)** add a verification job that re-reads each posted hash on the
next minute boundary and either marks it `confirmed` or deletes it.

---

## 4. Data flow walk-throughs

### 4.1 Investor claim, gasless via UGF

```
1. UI:   user clicks "Claim All Rent"
2. UI:   UGFContext.ugfExecute(rentalDistribution, abi, "claimAll", [])
3. SDK:  UGF SDK quotes gas, settles in TYI_MOCK_USD, submits sponsored tx
4. UI:   receipt awaited via the read provider
5. UI:   logTx({ txHash, type: "claim", from, propertyId, amount, gasMethod: "ugf" })
6. API:  POST /api/transactions
        ↓ (requireDb)
        Transaction.create({...})
        User.findOneAndUpdate({ wallet }, { $inc: { txCount, totalClaimed }, $set: { lastConnected } }, { upsert: true })
7. UI:   refreshUsdcBalance()  -- pulls new balance from chain
8. UI:   ActivityFeed picks up the row on its next 8s poll
```

### 4.2 Owner deposits rent

```
1. UI:   owner enters USDC amount
2. UI:   approve(rentalDistribution, amount) → MetaMask popup
3. UI:   UGFContext.ugfExecute(rentalDistribution, abi, "depositRental", [amount])
4. CHN:  RentalDistribution opens a new epoch with totalAmount + snapshotTime
5. UI:   logTx({ type: "deposit", ... })
6. API:  Transaction insert + User aggregate bump
```

### 4.3 Backend sync (manual)

```
1. CLI:  POST /api/properties/sync (admin tool, no auth — testnet only)
2. API:  reads deployed-addresses.json
3. API:  ethers.Contract(factory).getPropertiesCount()
4. API:  for each i: factory.properties(i)
5. API:  Property.findOneAndUpdate({ propertyId: i }, doc, { upsert: true, new: true })
6. API:  responds with the synced list
```

### 4.4 Smart Agent gas optimizer

```
1. UI:   SmartAgentContext polls provider.getFeeData() every 20s
2. UI:   maintains a 1h rolling history; computes "low/normal/high"
3. UI:   AgentSuggestions renders heuristic suggestions on /investor
4. UI (optional): user submits a question → askAgent({ question, holdings, suggestions })
5. UI:   browser → OpenAI / Anthropic / Gemini / OpenRouter directly
6. UI:   answer rendered in Positivus-styled bubble
```

The LLM call **never goes through our backend**. Keys live in the user's
own browser localStorage and travel directly to the chosen provider.
This is documented in the settings popover with an explicit warning.

---

## 5. Security and operations

### 5.1 Secrets and config

The repo's `.env.example` covers every variable the system reads:

| Variable | Used by | Notes |
|----------|---------|-------|
| `PRIVATE_KEY` | Hardhat, faucet | Never commit; bare 64 hex, no `0x` |
| `BASE_SEPOLIA_RPC_URL` | Hardhat, frontend, backend | Default `https://sepolia.base.org` |
| `MONGODB_URI` | Backend | Falls back to `mongodb://localhost:27017/realchain` |
| `BACKEND_PORT` | Backend | Default 5000 |
| `VITE_NETWORK_MODE` | Frontend | `local` or `baseSepolia` |
| `VITE_MOCK_USDC_ADDRESS` | Frontend, faucet route | Pasted post-deploy |
| `VITE_PROPERTY_FACTORY_ADDRESS` | Frontend | Pasted post-deploy |
| `VITE_BACKEND_URL` | Frontend | Default `http://localhost:5000` |
| `VITE_ETH_USD_RATE` | Frontend cost banner | Static rate; default 2000 |
| `BASESCAN_API_KEY` | Hardhat verify | Optional |
| `DEMO_INVESTOR_PRIVATE_KEY` | `seedDemo.js` | Demo only |
| `BASE_SEPOLIA_GAS_DUST_ADDRESS` | `seedDemo.js` | Receives leftover ETH so demo wallet ends at 0 |

`.env` is gitignored. `.env.example` is the team handoff. Keys flagged
above must never be checked in.

### 5.2 Rate limiting + abuse

- Faucet has an in-memory cooldown (`COOLDOWN_MS = 60 * 60 * 1000`). On
  process restart the map clears, which is acceptable for a testnet demo
  but **(future)** would move to Redis or a Mongo-backed counter.
- No global rate limit middleware yet. **(future)** wrap with
  `express-rate-limit` (1k requests/minute per IP) before any public
  deployment.

### 5.3 Input validation

- Wallet addresses — regex `^0x[a-fA-F0-9]{40}$` in the faucet route.
  Other routes accept any string and lowercase it (acceptable for a
  cache, not safe for write-side).
- Numeric query params clamped (`limit` capped at 200,
  `days` clamped 1–365).
- Mongoose enum guards on `type`, `gasMethod`, `status`, `role`.

### 5.4 Failure modes the system already handles

| Scenario | Behaviour |
|----------|-----------|
| Mongo offline | GET routes return `[]`, POST routes return 503 with hint |
| RPC blip during gas polling | SmartAgentContext keeps the last value, retries every 20s |
| UGF SDK fails to load | UGFContext falls back to `signer.sendTransaction` |
| Frontend cannot reach backend | ActivityFeed shows "feed offline", landing trust-strip flips to "API offline" |
| Faucet without `PRIVATE_KEY` | Returns 503 with a clear hint; UI shows "Faucet unavailable" |

### 5.5 Logging and observability

Today: morgan dev format only. **(future)** structured JSON logging
(pino) shipped to a log aggregator + Mongo slow-query log; metrics on
`/api/transactions` insert latency and on-chain RPC error rate.

---

## 6. Future architecture (what we'd add for v1.0)

### 6.1 Event indexer

Replace the client-side `logTx` posting with a backend job that polls
`provider.queryFilter` for the relevant events and writes them to Mongo:

| Event | Source contract | Becomes |
|-------|-----------------|---------|
| `PropertyCreated` | `PropertyFactory` | Property document |
| `RentalDeposited` | `RentalDistribution` | Transaction `type=deposit` |
| `AllDividendsClaimed` | `RentalDistribution` | Transaction `type=claim` |
| `TokensBought` | `Marketplace` | Transaction `type=buy` |
| `ListingCreated` / `ListingCancelled` | `Marketplace` | Transactions `type=listing/cancel` |

Implementation: a separate `backend/jobs/indexer.js` running on a 12s
interval. Persists last-scanned block in Mongo. Uses `getLogs` with the
event topic filter (already used client-side in `HolderList.jsx`, so the
pattern is proven). Replaces the unverified client POST entirely.

### 6.2 Authenticated write routes

For the routes that today take an unauthenticated wallet body:

- `POST /api/users/connect` — require a SIWE (Sign-In With Ethereum)
  signature in the request, verify server-side with `ethers.verifyMessage`
- `POST /api/transactions` — once §6.1 ships, deprecate the public endpoint.

### 6.3 Holder index

`HolderList.jsx` rebuilds balances from the Transfer log on every page
view. Cheap on testnet, painful at scale. The indexer also persists a
`Holding` collection: `{ propertyId, wallet, balance, updatedAt }`,
upserted on every Transfer event. Frontend reads from a new
`GET /api/properties/:id/holders?limit=10` endpoint.

### 6.4 Push notifications

- Email via Resend, SMS via Twilio
- Triggers: new rent epoch on a held property, listing filled, governance
  proposal opened
- Hooks into the indexer in §6.1 — no need for client-side push.
- Opt-in stored in `User.notifyPrefs`

### 6.5 Sponsor wallet for auto-claim and referrals

A separate signer (`SPONSOR_PRIVATE_KEY`) can call `claimAll` on opted-in
users' behalf via UGF. **High-blast-radius**: this signer must be:

- Stored in a managed secret store, not `.env`
- Allow-listed at the contract level (currently anyone can call `claimAll`
  for themselves, but a forwarder would need an explicit `claimFor(user)`
  call which we don't have today)
- Audited end-to-end before turning on

### 6.6 Multi-chain

Already partially scaffolded — `Web3Context` has a network switcher and
`hardhat.config.js` knows about Sepolia, Base Sepolia, and Mumbai. Full
multi-chain expansion needs:

- Per-chain `deployed-addresses.json` files
- A `chainId` foreign key on every Mongo doc (already in the schema)
- A network selector in the navbar
- Per-chain RPCs in env

### 6.7 Upgrade path for contracts

Today: immutable. **(future):**

- Wrap each property's contracts in OZ `TransparentUpgradeableProxy`
- Or migrate to a "v2 factory" and require existing properties to opt in

This is a one-week effort and is **not** in the hackathon scope.

---

## 7. Development lifecycle

### 7.1 Local dev (per-machine)

```
# 1. Hardhat node
npm run node                 # in terminal 1

# 2. Deploy contracts to localhost
npm run deploy:local         # in terminal 2 — writes deployed-addresses.json

# 3. Backend
cd backend && npm run dev    # in terminal 3 — port 5000

# 4. Frontend
cd frontend && npm run dev   # in terminal 4 — port 3000

# 5. Optional: simulate a full flow
npm run simulate
```

`MetaMask` should be pointed at `http://127.0.0.1:8545`, chain id 31337.
Import a Hardhat test account from terminal 1.

### 7.2 Branching and code review

- `main` is protected (when GitHub branch protection is configured).
- Feature branches: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`.
- Every PR must:
  1. Pass `npm test` (Hardhat suite)
  2. Pass `npm run build` from `frontend/`
  3. Update `memory/decisions.md` if the change is architectural
  4. Update `memory/flags.md` if it leaves anything pending
  5. Append a session entry to `CLAUDE.md` if the work is meaningful
  6. Trigger a Graphify rebuild (the Kiro hook does this automatically;
     CI also runs `npm run graphify:update` to keep the committed graph
     fresh)

### 7.3 Continuous integration **(future)**

A GitHub Actions workflow should run on every PR:

```yaml
name: ci
on: [pull_request]
jobs:
  contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test                  # 31 hardhat tests
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd backend && npm ci
      - run: cd backend && node -e "require('./server.js'); setTimeout(()=>process.exit(0), 1500);"
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
```

### 7.4 Release checklist

Before pushing a tag:

- [ ] All Hardhat tests pass
- [ ] `npm run build` clean for `frontend/`
- [ ] `node -e "require('./server.js')"` boots cleanly with `Mongo connected` log
- [ ] `.env.example` covers any new variable introduced this cycle
- [ ] `memory/decisions.md` and `memory/flags.md` reflect reality
- [ ] `CLAUDE.md` session log appended
- [ ] `graphify update .` clean — committed graph reflects current code
- [ ] A fresh clone can run §7.1 end-to-end without hidden dependencies
- [ ] `NOTICE` and `LICENSE` updated if new third-party assets landed
- [ ] If contracts changed: redeploy to Base Sepolia, update
      `deployed-addresses.json` and the relevant `VITE_*_ADDRESS` env
      variables, post the new addresses in the team channel

---

## 8. Deployment roadmap

Three deployment targets, each with their own checklist.

### 8.1 Tier 0 — Local Hardhat (today, working)

Defaults preserved in `frontend/src/config/contracts.js` so a fresh
`VITE_NETWORK_MODE=local` clone runs against localhost addresses without
any env config.

### 8.2 Tier 1 — Base Sepolia (target for hackathon)

Steps in order:

1. Fund the `PRIVATE_KEY` deployer wallet via the Coinbase or Alchemy
   Base Sepolia faucet
2. `npm run deploy:base` — deploys MockUSDC + factory + 1–2 sample
   properties; writes `deployed-addresses.json`
3. Copy printed addresses into the root `.env`:
   - `VITE_MOCK_USDC_ADDRESS=...`
   - `VITE_PROPERTY_FACTORY_ADDRESS=...`
4. `npm run seed:base` — runs `scripts/seedDemo.js` to leave a known
   investor wallet with PROP tokens, pending USDC rent, and ETH = 0
5. `npx hardhat verify --network baseSepolia <addr> ...` for each contract
6. Deploy the backend to a Node-friendly host (Render / Railway / Fly).
   Set `MONGODB_URI` to a free-tier MongoDB Atlas cluster
7. Deploy the frontend to Vercel / Netlify with the env block from step 3
8. Smoke-test the demo on the production URL with a clean browser

### 8.3 Tier 2 — Mainnet **(future, out of scope for the hackathon)**

This is intentionally not on the immediate roadmap. Before mainnet:

- Replace `MockUSDC` with real USDC and audit the swap
- External audit of the four primary contracts
- Insurance for sponsor-wallet auto-claim
- Legal review of the fractional-ownership pitch (jurisdiction-dependent)
- Add real KYC/KYB at the owner mint flow

---

## 9. Risks and open questions

| Risk | Likelihood | Impact | Mitigation |
|------|:----------:|:------:|------------|
| UGF SDK API drift | Medium | Medium | Re-verify against live README before each integration touch; UGFContext already falls back to direct signer |
| `MockUSDC.mint` accidentally shipped to mainnet | Low | High | Rename the contract, gate it behind `OnlyOwner`, or fork into a separate testnet artifact before the prod path opens |
| Client-posted `/api/transactions` rows are unverified | Medium | Low | Replace with §6.1 indexer; today, treat the analytics feed as best-effort |
| Faucet rate-limit lost on backend restart | Low | Low | Move cooldown state to Mongo when 6.1 lands |
| Contract size limit when adding governance | Medium | Medium | Stick to the deployer-indirection pattern used by V2; check size budget before merging |
| Single-key signer for faucet | Low | Medium | Acceptable for testnet; for prod migrate to a managed KMS |
| RPC outage cascades into UI hangs | Low | Low | Read provider already retries; SmartAgent gas pill silently keeps last value |

---

## 10. Quick reference for new contributors

> Onboarding contract: read this section first.

1. Read `CLAUDE.md` and `AGENTS.md`. They are project memory.
2. Read [`Real-Estate Project Audit.md`](./Real-Estate%20Project%20Audit.md) once
   end-to-end. It explains **why** the architecture is the way it is — the
   snapshot bug, the ETH→USDC switch, the V1/V2 split, the hackathon scoping,
   the research-paper framing decisions, and the role-split dashboards. This
   plan is authoritative for **how**; the audit is authoritative for **why**.
3. If `graphify-out/graph.json` exists, query it for relevant questions
   before broad file reads. The Kiro hooks keep it current automatically.
4. When you change code:
   - Local Hardhat tests must still pass
   - Frontend build must still pass
   - Backend must still boot
   - Update `memory/decisions.md` and `memory/flags.md` if the change is
     non-trivial
   - Append a session entry to `CLAUDE.md`
5. Don't commit `.env`, `deployed-addresses.json` (yes it's tracked, but
   only with localhost defaults), or any LLM API key.
6. If you add a backend route, register it in:
   - `backend/server.js` (mount path)
   - this document's §3.2
   - whichever frontend page actually consumes it
7. If you add a contract, register it in:
   - `scripts/deploy.js` and `scripts/seedDemo.js` if it's part of the
     core deploy flow
   - `frontend/src/config/contracts.js` ABI block
   - this document's §2.1

---

*Owners: Aaradhy + the AI agent currently driving this repo. Update this
file whenever the architecture genuinely shifts; never use it for
aspiration, only for reality plus clearly-marked future work.*
