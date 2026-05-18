# Team & AI Memory — RealChain v2

> Read this file before changing the project. It is the durable map of what exists, what is planned, and what should not be accidentally rediscovered from scratch.

---

## How to use this file

For AI agents:
- Read this file before making changes.
- If `graphify-out/graph.json` exists, query it before reading broad swaths of raw files.
- If Graphify has not been initialized yet, inspect the smallest relevant files directly and note the gap in `memory/flags.md`.
- After meaningful work, append a session entry below.
- Never treat planned work as shipped work.

For new contributors:
- Read **Project Overview**, **What's Built**, and **What's Remaining** first.
- For local startup, use the commands in `README.md`.

---

## Project overview

```text
Project Name   : RealChain v2
Description    : A blockchain prototype for fractional real-estate ownership. Property owners tokenize assets into ERC-20 ownership units, investors buy them with USDC, rent is distributed as USDC dividends, and holders can trade through a built-in marketplace.
Stack          : Solidity 0.8.28 + OpenZeppelin 5.6 + Hardhat + ethers.js 6 + React 18 + Vite
Repo           : TBD
Staging URL    : None configured
Production URL : None configured
Started        : May 2026 (inferred from repository docs)
```

### Goals
- [x] Demonstrate secure tokenized-property ownership, rent distribution, and secondary trading.
- [x] Compare dividend models: V1 epoch-loop claims vs V2 constant-time claims.
- [ ] Ship the UGF hackathon flow where users pay gas in `TYI_MOCK_USD` instead of ETH.
- [ ] Non-goal for the current prototype: production KYC/AML, real USDC settlement, or audited production deployment.

### Active milestone

**UGF Hackathon — Track 3 (Wallet & Agents / "reward claim")**

The authoritative plan is `implementation_plan.md`. It is now organized into three tiers:

| Tier | Scope | Gate to next tier |
|------|-------|-------------------|
| **Tier 1 — Mandatory** (Phases 1–4) | Base Sepolia deploy, role-based dashboards, UGF-wrapped `claimAll()`, demo recording | Phase 4A end-to-end test passes |
| **Tier 2 — Differentiators** (Phase 5) | Wrap all four state-changing flows with UGF, on/off toggle, activity feed, cost banner, rename "Dividends" → "Claim Rent", faucet helper, brand pass | 5A + 5B + 5C + 5D + 5E green |
| **Tier 3 — Stretch** (Phase 6) | Embedded wallet (Privy/Web3Auth), soulbound NFT receipts, pitch video, live demo URL | n/a |

North star demo (still the same):
1. Investor wallet has token holdings, pending rent, some `TYI_MOCK_USD`, and **0 ETH**.
2. Investor opens the app on Base Sepolia.
3. Investor clicks **Claim All Rent**.
4. UGF prices, settles, and executes the transaction.
5. Dividends arrive while the user never acquires or spends native ETH.

Cuts (decided 2026-05-18): the V1/V2 + snapshot-attack research story stays in the repo for the academic paper but is NOT surfaced in the hackathon README, demo, or pitch. The hackathon submission is ruthlessly scoped to "zero-ETH rent claims with UGF".

---

## Team

| Name | Role | Owns | Contact |
|------|------|------|---------|
| TBD | TBD | TBD | TBD |

**AI agents in this repo:** none implemented as product features. Codex/Claude/Cursor-style assistants may work on the repo, but there is no `agents/` runtime subsystem today.

---

## Architecture

```text
User / MetaMask
      ↓
React + Vite frontend
      ↓ ethers.js
Hardhat local chain or configured EVM network
      ↓
PropertyFactory
  ├── PropertyToken (ERC20Votes ownership)
  ├── RentalDistribution V1 or V2
  └── Marketplace
      ↓
MockUSDC settlement token
```

There is no separate traditional backend server in the current repository. The smart contracts are the backend layer.

**Update (2026-05-17 evening):** An Express.js + MongoDB backend was added at `backend/` to provide REST API caching, transaction logging, and analytics. The architecture is now:

```text
User / MetaMask
      ↓
React + Vite frontend (port 3000)
      ↓ ethers.js        ↓ fetch()
Blockchain (Base Sepolia)   Express backend (port 5000)
      ↓                         ↓
Smart Contracts            MongoDB (realchain db)
```

### Key files

| File/Folder | Purpose |
|-------------|---------|
| `contracts/PropertyFactory.sol` | Deploys and registers each property suite |
| `contracts/PropertyToken.sol` | ERC20Votes ownership token with historical balances |
| `contracts/RentalDistribution.sol` | V1 snapshot-safe dividend distribution |
| `contracts/RentalDistributionV2.sol` | V2 accumulator-based constant-time claims |
| `contracts/Marketplace.sol` | Primary and secondary token sales |
| `scripts/deploy.js` | Deploys MockUSDC, factory, and sample properties |
| `scripts/simulate.js` | End-to-end local demo flow |
| `frontend/src/context/Web3Context.jsx` | Wallet/network/contracts bridge for the UI |
| `frontend/src/config/contracts.js` | Frontend network constants, addresses, ABIs |
| `test/` | Functional, security, and gas benchmark coverage |
| `HACKATHON_PLAN.txt` | Active UGF/Base Sepolia implementation brief; not yet implemented |
| `backend/server.js` | Express API server — property cache, tx logs, user profiles |
| `backend/models/` | Mongoose schemas: Property, Transaction, User |
| `backend/routes/` | REST endpoints: /api/properties, /api/transactions, /api/users |

### Central components

Graphify was generated on 2026-05-17. The current report is intentionally doc-heavy because this repo contains long planning/explanation files, so use targeted queries for code questions rather than treating the top global nodes as the whole architecture.

Code-centric anchors from direct inspection:
- `PropertyFactory.sol` — creates the contract graph for every property.
- `PropertyToken.sol` — anchors ownership history used by dividend logic.
- `Web3Context.jsx` — central frontend integration point for wallet, network, and contract access.
- `RentalDistribution.sol` / `RentalDistributionV2.sol` — define the project’s core economic behavior.

---

## What's built

### Core protocol
- [x] `MockUSDC` test token with 6 decimals.
- [x] `PropertyToken` with ERC20Votes checkpoints and auto-delegation.
- [x] `PropertyFactory` with selectable V1/V2 distribution deployment.
- [x] `RentalDistribution` V1 with snapshot-safe dividend claims.
- [x] `RentalDistributionV2` with constant-time claims and transfer hooks.
- [x] `Marketplace` for primary and secondary sales.
- [x] Intentional vulnerable baseline `BrokenRentalDistribution` for research comparison.

### Scripts and local runtime
- [x] Local Hardhat workflow.
- [x] `deploy.js` creates MockUSDC, factory, and two sample properties.
- [x] `simulate.js` runs a full buy → rent → claim → trade demo.
- [x] Local deployment verified on 2026-05-17.

### Tests
- [x] 31 tests passing as of 2026-05-17.
- [x] Snapshot timing attack demonstrated and blocked.
- [x] V1/V2 gas benchmark suite present.

### Frontend
- [x] Property browsing.
- [x] Property detail page with buy flows.
- [x] Portfolio page.
- [x] Dividends page with claim and owner deposit UI.
- [x] MetaMask connection, network switching, role hinting, and read-only browsing.

---

## What's remaining

See `implementation_plan.md` for the full tiered backlog. Summary:

| Priority | Tier | Task | Owner | Notes |
|----------|------|------|-------|-------|
| High | T1 / Phase 1 | Add Base Sepolia deploy + seed deterministic demo state | Person A | `baseSepolia` config already added; deployment + seed script still TODO |
| High | T1 / Phase 2 | Build `OwnerDashboard.jsx` + `InvestorDashboard.jsx` + role-based routing | Persons B & C | Judges should land on a role-specific dashboard |
| High | T1 / Phase 3 | Install `@tychilabs/react-ugf`, build `UGFContext`, UGF-wrap `claimAll()` | Person D | Core hackathon requirement |
| High | T1 / Phase 4 | E2E test from clean state + record 60-sec demo | All | Demo script in `HACKATHON_PLAN.txt` |
| Medium | T2 / Phase 5A | UGF-wrap `depositRental`, `buyFromOwner`, `buyFromListing`, `cancelListing`, `approve` | B + C + D | Whole demo becomes zero-ETH |
| Medium | T2 / Phase 5B | UGF on/off toggle (proves the thesis live) | D | Toggling off → claim fails (no ETH) |
| Medium | T2 / Phase 5C | Activity feed via existing Express + MongoDB backend | A | Gives the backend a visible job |
| Medium | T2 / Phase 5D | Side-by-side cost banner ("without UGF" vs "with UGF") | C | Makes the value prop unmissable |
| Medium | T2 / Phase 5E | Rename user-visible "Dividends" → "Claim Rent" | B | Beginner-friendly language |
| Medium | T2 / Phase 5F | In-app faucet helper (Mock USD + USDC + demo wallet drop-in) | A | Removes friction for cold judges |
| Medium | T2 / Phase 5G | Brand pass: name, logo, landing screen | All | Hackathon scoring is partly aesthetic |
| Low | T3 / Phase 6A | Embedded wallet (Privy / Web3Auth) | C | Email-only onboarding |
| Low | T3 / Phase 6B | Soulbound NFT receipt per claim | D | Hits Minting track too |
| Low | T3 / Phase 6C | 60–90 sec pitch video | All | Most submissions ship without one |
| Low | T3 / Phase 6D | Live demo URL on Vercel/Netlify | A | Custom subdomain |

### Known bugs / gaps
- [ ] Fresh `.env.example` placeholders are unsafe for local startup if copied literally: a fake `PRIVATE_KEY` causes Hardhat config validation to fail. Blank local values work.
- [ ] Fresh local deployment does not automatically approve the marketplace from the owner for primary sales.
- [ ] `frontend/src/pages/Property.jsx` tries to solve missing owner approval from the connected buyer wallet, which cannot approve on behalf of the owner.
- [ ] Fresh local deployment does not auto-distribute MockUSDC to demo investor wallets, so buying requires manual funding or a faucet flow.
- [ ] `HACKATHON_PLAN.txt` describes Base Sepolia + UGF work that has not yet been implemented.
- [ ] Hackathon deployment inputs are not yet configured: Base Sepolia RPC/deployer key, deployed addresses, and the final `TYI_MOCK_USD` route/address source still need verification during implementation.
- [ ] A deterministic Base Sepolia demo-state setup is not yet documented: property deployed, investor funded, tokens purchased, rent deposited, pending dividends present, investor ETH balance at zero.

---

## Hackathon implementation brief

> Authoritative version: `implementation_plan.md`. The summary below mirrors it.

### What must ship in Tier 1
- Base Sepolia support in Hardhat and frontend network config (`baseSepolia` is already wired; deployment is not).
- Deterministic demo-state seeding script (`scripts/seedDemo.js` or a deploy.js extension): one investor wallet ends with PROP tokens, pending USDC rent, and ETH=0.
- Role-specific dashboards: `OwnerDashboard.jsx`, `InvestorDashboard.jsx`, role-based routing.
- UGF-wrapped `claimAll()` with visible "Gas paid in Mock USD" badge and a quoted cost preview.
- A judge-ready demo path proving the investor can claim with **0 ETH**.

### What ships in Tier 2 (only after Tier 1 is green)
- All four state-changing flows wrapped with UGF (claim, deposit, primary buy, secondary buy).
- UGF on/off toggle that lets judges see the system fail without UGF.
- Activity feed driven by the Express + MongoDB backend.
- Cost banner showing "without UGF" vs "with UGF" side by side.
- "Dividends" renamed to "Claim Rent" everywhere user-visible.
- In-app faucet helper.
- Branding: name, logo, landing screen.

### What ships in Tier 3 (only if time remains)
- Embedded wallet (email login → smart wallet → UGF claim).
- Soulbound NFT claim receipts.
- 60–90 second pitch video.
- Live demo URL with custom subdomain.

### What stays stable
- Core Solidity contracts and the existing 31 Hardhat tests through Tier 1 + Tier 2.
- `claimAll()` is the first UGF target. Do not let secondary actions outrun the centerpiece.
- The V1/V2 / snapshot-attack research surface stays in the repo but is NOT surfaced in the hackathon submission.

### Verified UGF implementation facts
- Official testnet SDK: `@tychilabs/ugf-testnet-js`.
- Official React wrapper: `@tychilabs/react-ugf`, exposing `UGFProvider` and `useUGFModal().openUGF(...)`.
- Testnet route: Base Sepolia (`84532`) with settlement coin `TYI_MOCK_USD`.
- Lifecycle: authenticate → quote → settle → sponsor/execute → confirm.
- Before coding, re-check the live SDK README. Internal notes are not the source of truth.

### Settlement-token policy (resolved 2026-05-18)
- **Rent settlement**: our `MockUSDC` contract (all RealChain contracts already speak it).
- **Gas settlement**: UGF's `TYI_MOCK_USD` (separate token, only touched by the UGF flow).
- UI copy MUST distinguish them: "Receive USDC" (rent) vs "Pay gas in Mock USD" (UGF fee).

### Preferred implementation shape
- New `frontend/src/context/UGFContext.jsx` owns UGF setup and execution helpers (including a generic `ugfExecute()` for Tier 2).
- New `OwnerDashboard.jsx` owns rent-deposit / owned-property flows.
- New `InvestorDashboard.jsx` owns portfolio summary and the UGF-powered claim flow.
- `App.jsx` owns role-based routing.
- `Web3Context.jsx` remains the generic wallet/network/contracts layer (no UGF coupling).
- Backend stays at `backend/` and earns its keep via the Tier 2 activity feed (Phase 5C).

### Definition of done — Tier 1
- `hardhat.config.js` supports `baseSepolia`. ✅ already done.
- Contracts deployed to Base Sepolia; addresses reflected in `frontend/src/config/contracts.js`.
- `scripts/seedDemo.js` (or equivalent) leaves a known wallet with: PROP tokens > 0, pending dividends > 0, ETH = 0.
- Frontend connects/switches to Base Sepolia.
- Owner and investor see different dashboards.
- Investor claim flow succeeds from a wallet with **zero ETH** and shows Mock-USD gas messaging.
- The demo can be re-run twice from the documented seed script without manual surgery.

### Definition of done — Tier 2
- All four state-changing user flows succeed with ETH = 0.
- The UGF toggle visibly causes claim to fail when off and succeed when on.
- Activity feed updates within ~10s of any UGF tx.
- Cost banner appears on every gasless button with both numbers populated.
- The user-visible string "Dividends" appears nowhere.

### Definition of done — Tier 3
- Email-only login can complete a claim with no MetaMask.
- Each successful claim leaves a non-transferable receipt NFT in the investor's wallet.
- Pitch video is uploaded and linked from the README.
- Live demo URL is reachable from a clean browser with no extensions.

---

## Agent context rules

1. Prefer the smallest trustworthy source that answers the question.
2. If `graphify-out/graph.json` exists, query it before broad file reads.
3. Do not duplicate logic until checking whether it already exists.
4. Record durable architectural decisions in `memory/decisions.md`.
5. Record uncertainty, missing dependencies, or unresolved risks in `memory/flags.md`.
6. Append meaningful work to the session log below.
7. Do not silently turn roadmap text into implementation claims.

---

## Key decisions and why

| Date | Decision | Reason | Who |
|------|----------|--------|-----|
| 2026-05-17 | Use ERC20Votes historical balances for dividend snapshots | Prevents buyers after rent deposit from stealing earlier dividends | Existing project |
| 2026-05-17 | Keep V1 as default and make V2 optional | V1 is simpler; V2 wins when claims span multiple epochs | Existing project |
| 2026-05-17 | Treat the contract layer as the backend in the local app | No separate API server exists in the repo | Codex |
| 2026-05-17 | Blank local `.env` secrets until real credentials exist | Placeholder private keys break Hardhat startup and are not valid secrets | Codex |
| 2026-05-17 | Initialize Graphify for the repo and install the Codex hook | Enables scoped codebase queries before broad file reads | Codex |
| 2026-05-17 | Make the UGF hackathon flow the active implementation branch | It is now the clearest product milestone and judge-facing story | Codex |
| 2026-05-17 | Treat zero-ETH dividend claiming as the minimum winning scope | The reward-claim demo is the core Track 3 proof | Codex |
| 2026-05-17 | Prefer `UGFContext.jsx` plus separate role dashboards | Keeps UGF isolated and gives judges a cleaner role-specific UX | Codex |
| 2026-05-17 | Use current official UGF docs as the API source of truth | SDK details are live; internal notes must not drift into false certainty | Codex |

---

## Memory layer setup

### Current status
- Graphify: initialized on 2026-05-17. Outputs live in `graphify-out/`.
- `memory/decisions.md`: present.
- `memory/flags.md`: present.
- Cross-session memory packages such as `agentmemory` or `mem0`: not configured.

### Team-sharing rule
- Commit the shared memory artifacts: `CLAUDE.md`, `AGENTS.md`, `.graphifyignore`, `memory/`, and `graphify-out/`.
- Do **not** share `.codex/hooks.json`; it contains a machine-specific executable path and is ignored in git.
- Each teammate should install their own local Codex hook once:

```bash
pip install graphifyy
graphify codex install
```

That gives every teammate's AI the same repo graph while letting each machine keep its own local Graphify executable path.

### Graphify commands

```bash
graphify query "how does dividend distribution work?"
graphify path "PropertyFactory" "Marketplace"
graphify explain "Web3Context"
graphify update .
```

Recommended ignore targets already captured in `.graphifyignore`:
- `node_modules/`
- `artifacts/`
- `cache/`
- runtime logs

---

## Session log

```text
---
Date    : 2026-05-17
Agent   : Codex
Did     : Created `.env` from `.env.example`; blanked placeholder secrets so local Hardhat can boot.
Did     : Installed root dependencies, started the local Hardhat node, deployed contracts to `localhost`, and wrote `deployed-addresses.json`.
Did     : Updated `frontend/src/config/contracts.js` with the fresh local MockUSDC and PropertyFactory addresses.
Did     : Verified the current suite: 31 Hardhat tests passing.
Did     : Added project memory scaffolding: `CLAUDE.md`, `.graphifyignore`, `memory/decisions.md`, and `memory/flags.md`.
Decided : Current local architecture is frontend + smart-contract backend; no separate API backend exists in this repo.
Next    : Decide whether the next branch is local-demo polish or the hackathon path: Base Sepolia + UGF + role-specific dashboards.
Blockers: Team metadata is unknown; Graphify is not initialized; fresh local demo still needs owner approval and investor USDC funding.
---
---
Date    : 2026-05-17
Agent   : Codex
Did     : Installed the Codex Graphify integration, which expanded `AGENTS.md` with graph-first instructions and a PreToolUse hook.
Did     : Built `graphify-out/graph.json`, `graph.html`, and `GRAPH_REPORT.md` using the current AST-only Graphify workflow.
Did     : Verified the graph with `graphify query "how does dividend distribution work?"`.
Decided : Use Graphify for scoped repository navigation; keep `agentmemory` / `mem0` unconfigured until the team chooses a concrete persistent-memory stack.
Next    : Decide whether to improve the local demo flow or begin the Base Sepolia + UGF hackathon branch.
Blockers: Team metadata is unknown; fresh local demo still needs owner approval and investor USDC funding.
---
---
Date    : 2026-05-17
Agent   : Codex
Did     : Added `.codex/hooks.json` to `.gitignore` because it contains a user-specific local Graphify path.
Did     : Documented the team-sharing rule: commit Graphify outputs and shared memory files, but let each teammate install their own local Codex hook.
Decided : Shared graph data belongs in the repo; machine-specific hook configuration does not.
Next    : Keep `graphify-out/` updated after code changes so teammates and their AI tools inherit the latest repo map.
Blockers: None for Graphify sharing; teammates still need a one-time local `graphify codex install`.
---
---
Date    : 2026-05-17
Agent   : Codex
Did     : Promoted the UGF hackathon plan into the active implementation branch inside `CLAUDE.md` and `AGENTS.md`.
Did     : Added the judge-facing north star, phased build order, preferred file shape, and definition of done for Base Sepolia + UGF work.
Did     : Recorded verified UGF implementation facts so future agents distinguish `TYI_MOCK_USD`, `@tychilabs/ugf-testnet-js`, and `@tychilabs/react-ugf`.
Decided : Build the reward-claim path first, keep core Solidity stable, and isolate UGF logic in a dedicated frontend context.
Next    : Start Phase 1: Base Sepolia configuration, deployment inputs, and contract-address plumbing.
Blockers: Need verified deployment credentials, final Base Sepolia addresses, and a reproducible demo-state setup.
---
---
Date    : 2026-05-17 (evening)
Agent   : Antigravity
Did     : Added Base Sepolia (chain 84532) to `hardhat.config.js` with RPC and etherscan config.
Did     : Fixed `.env.example` PRIVATE_KEY placeholder that broke Hardhat on fresh copy.
Did     : Added 8 convenience scripts to root `package.json` (compile, test, node, deploy:local, deploy:base, simulate, dev:frontend, dev:backend).
Did     : Scaffolded Express.js backend at `backend/` with server.js, 3 Mongoose models (Property, Transaction, User), 3 route files (properties, transactions, users), and requireDb middleware for graceful MongoDB-offline handling.
Did     : Installed backend dependencies (express, mongoose, ethers, dotenv, cors, morgan, nodemon).
Did     : Curl-tested all 12 API endpoints — all pass (GETs return empty arrays when DB offline, POSTs return 503 with helpful hint).
Did     : Updated `.env` and `.env.example` with BASE_SEPOLIA_RPC_URL, MONGODB_URI, BACKEND_PORT, BASESCAN_API_KEY.
Did     : Added `backend/node_modules/` to `.gitignore`.
Did     : Pushed all code to `main` branch on GitHub (https://github.com/AyushX1602/Real-Chain), deleted `master` branch.
Decided : Tech stack finalized as React + Express + MongoDB + Solidity + UGF.
Decided : Backend degrades gracefully without MongoDB — no hard dependency for local development.
Next    : Build OwnerDashboard.jsx, InvestorDashboard.jsx, install UGF SDK, and get testnet ETH for Base Sepolia deployment.
Blockers: MongoDB not installed locally (Atlas free tier recommended). Base Sepolia deployer wallet not yet funded.
---
---
Date    : 2026-05-18
Agent   : Kiro (Claude Opus 4.7)
Did     : Read the official problem statement (`hackathon_ps.pdf`) end-to-end and confirmed the hackathon scoring is "beginner-friendly + onchain action that normally breaks because of gas".
Did     : Audited the gap between `implementation_plan.md` (which only covered Tier 1) and what would actually win: identified Tier 2 differentiators (wrap all flows, UGF toggle, activity feed, cost banner, rename, faucet, brand) and Tier 3 stretch (embedded wallet, NFT receipt, pitch video, live URL).
Did     : Rewrote `implementation_plan.md` into a tiered build (Tier 1 mandatory → Tier 2 differentiators → Tier 3 stretch) with explicit gates between tiers, parallel timeline, and per-person deliverables across all three tiers.
Did     : Added Phase 1E ("deterministic demo-state seeding") as a Tier 1 task because the 60-second demo silently breaks if the demo wallet is set up by hand on demo day.
Did     : Updated `CLAUDE.md`: rewrote Active Milestone, What's Remaining, and Hackathon Implementation Brief to reflect the tiered plan + settlement-token policy.
Did     : Updated `AGENTS.md` with the tier-gate rule, the settlement-token policy, and the cut decision about the V1/V2 research surface.
Decided : Settlement-token policy — our `MockUSDC` for rent, UGF's `TYI_MOCK_USD` for gas only. UI copy must distinguish them.
Decided : Cut the V1/V2 + snapshot-attack research story from the hackathon-visible surface (README, demo, pitch). It stays in the repo for the academic paper.
Decided : Tiers MUST ship in order. Tier 2 starts only after Phase 4A is green. Tier 3 starts only after 5A/B/C/D/E are green.
Next    : Run a design-first spec workflow to formalize the architecture (UGF wrapper layer, role split, demo-state seeding, activity feed) before coding — design.md → requirements.md → tasks.md.
Blockers: Same as previous entry — Base Sepolia deployer wallet still unfunded; MongoDB not yet provisioned (Atlas free tier recommended).
---
---
Date    : 2026-05-18
Agent   : Codex
Did     : Ran Graphify update for this repository and rebuilt `graphify-out/graph.json`, `graphify-out/graph.html`, and `graphify-out/GRAPH_REPORT.md`.
Did     : Confirmed `graphify` is not available directly on PATH in this shell.
Did     : Used the working fallback command `uvx --from graphifyy graphify.exe update .` to keep graph memory current.
Decided : Keep using the uvx Graphify fallback on this machine unless PATH is fixed.
Next    : Continue Tier 1 implementation tasks in order from `implementation_plan.md`.
Blockers: Base Sepolia deployer wallet funding and final deployment addresses are still pending.
---
```

---

## New chat quickstart

```text
Read CLAUDE.md in full. Then:
1. If `graphify-out/graph.json` exists, query it for the relevant question.
2. Read `HACKATHON_PLAN.txt`.
3. Check the latest Session Log entry's `Next` field.
4. Tell me what you understand about the project, the hackathon target, and the most sensible next task.
Do not write code until you confirm the intended direction.
```

---

## Links

| Resource | URL |
|----------|-----|
| GitHub repo | https://github.com/AyushX1602/Real-Chain |
| Design docs | `PROJECT_EXPLAINED.txt`, `README.md`, `HACKATHON_PLAN.txt` |
| Backend API | `http://localhost:5000/api/health` |
| Frontend | `http://localhost:3000` |
| Staging env | None configured |

---

*Last updated: 2026-05-18 by Codex*
