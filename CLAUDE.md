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

- [x] Demonstrate secure tokenized-property ownership, rent distribution, and secondary trading.
- [x] Compare dividend models: V1 epoch-loop claims vs V2 constant-time claims.
- [ ] Ship the UGF hackathon flow where users pay gas in `TYI_MOCK_USD` instead of ETH.

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
- [x] Role-specific owner/investor dashboards.
- [x] UGF context, on/off toggle, badges, cost banner, activity logging hook, and UGF-wrapped claim/deposit/buy/listing/cancel flows.
- [x] Frontend ERC-20 approvals route through UGF when UGF mode is on.

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
- [ ] Fresh local/Base deployments still require seeded owner marketplace approval before primary sales. The buyer UI now surfaces this instead of trying an impossible buyer-side approval.
- [ ] Clean Base Sepolia demo wallet still needs a live smoke test: PROP > 0, pending rent > 0, TYI_MOCK_USD funded, ETH = 0, UGF claim succeeds.
- [ ] `scripts/seedDemo.js` exists, but its current on-chain output must be re-run or verified immediately before demo day.
- [ ] Cost-banner UGF quote preview depends on gateway `/quote` and browser CORS; build passes, but deployed-browser quote population still needs verification.

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
---
Date    : 2026-05-18
Agent   : Codex
Did     : Installed Graphify's official Codex integration via `uvx --from graphifyy graphify.exe codex install`.
Did     : Registered local `.codex/hooks.json` PreToolUse hook so Graphify checks/refreshes run automatically on this machine.
Did     : Updated `AGENTS.md` to make memory updates mandatory after meaningful work and to document Graphify fallback command usage.
Decided : Future project edits should not require manual "run graphify update" reminders in chat.
Next    : Continue Tier 1 implementation tasks in order from `implementation_plan.md`.
Blockers: Base Sepolia deployer wallet funding and final deployment addresses are still pending.
---
---
Date    : 2026-05-18
Agent   : Kiro (Claude Opus 4.7)
Did     : Made Graphify refresh fully automatic across the workflow. Installed the official Graphify Kiro skill (`uvx --from graphifyy graphify.exe install --platform kiro`).
Did     : Created four Kiro hooks that run `uvx --from graphifyy graphify.exe update .` automatically: on every code/doc save (`fileEdited`), on file create (`fileCreated`), on file delete (`fileDeleted` with `--force` so deleted nodes drop cleanly), and at the end of every agent turn (`agentStop`). File patterns cover `.js`, `.jsx`, `.ts`, `.tsx`, `.sol`, `.py`, `.go`, `.rs`, `.java`, `.css`, `.html`, `.md`, `.json`.
Did     : Added six root npm scripts so the same automation works outside Kiro: `graphify:update`, `graphify:update:force`, `graphify:watch`, `graphify:query`, `graphify:explain`, `graphify:path`.
Did     : Added an opt-in portable git hook at `scripts/git-hooks/pre-commit` (with `scripts/git-hooks/README.md`) — contributors enable it once with `git config core.hooksPath scripts/git-hooks`. The hook runs `npm run graphify:update`, falls back to direct uvx, and re-stages `graphify-out/` so commits always carry a fresh graph snapshot.
Did     : Tightened `.graphifyignore` to skip generated build output (`frontend/dist/`, `backend/dist/`), the cloned reference repo (`reference-positivus/`), Kiro internals (`.kiro/`), and Graphify's own output folder so the watcher does not churn.
Did     : Refreshed the graph immediately: 194 files, 4,096 nodes, 4,838 edges, 375 communities. The graph now reflects the post-Positivus rewrite (Landing.jsx, restyled index.css, NOTICE, faucet route, etc.).
Did     : Updated `memory/decisions.md`, `memory/flags.md`, and `AGENTS.md` to document the automation and the resolved "manual graphify update" pain point.
Decided : Graphify state is part of the project's real-time memory contract, not a periodic chore. The combination of Kiro fileEdited/fileCreated/fileDeleted/agentStop hooks plus the optional git pre-commit gives line-level coverage in the editor and at every commit boundary.
Decided : `.codex/hooks.json` stays gitignored (machine-specific path); the new Kiro hooks live in `.kiro/hooks/` which is also machine-local. Cross-contributor automation is delivered through the npm scripts and the opt-in git hook, both of which are committed.
Next    : Resume Tier 1 implementation tasks from `implementation_plan.md` (Base Sepolia deployment + funded wallet still the blocker).
Blockers: Base Sepolia deployer wallet still unfunded; final deployment addresses pending.
---
---
Date    : 2026-05-19
Agent   : Codex
Did     : Re-read `CLAUDE.md`, `implementation_plan.md`, and `HACKATHON_PLAN.txt`; queried Graphify with `graphify.exe` after discovering `uvx` is not on PATH.
Did     : Verified current Tychi UGF sources: live `ugf-testnet-js` README and installed `@tychilabs/react-ugf` README/types. Confirmed React testnet mode uses `<UGFProvider mode="testnet">` and `useUGFModal().openUGF(...)`.
Did     : Fixed the frontend UGF wrapper so `UGFContext` uses `useUGFModal`, waits for the modal result, exposes `ugfApprove()`, and uses gateway `/quote` for best-effort cost previews.
Did     : Wrapped frontend ERC-20 approvals through UGF in `Dividends.jsx`, `OwnerDashboard.jsx`, `Property.jsx`, and `Portfolio.jsx`; removed the impossible buyer-side owner-token approval from the primary buy flow.
Did     : Updated `frontend/src/config/contracts.js` so `baseSepolia` mode defaults to the recorded Base Sepolia deployment instead of localhost addresses.
Did     : Ran verification: 31 Hardhat tests passing and `frontend npm run build` passing after installing missing frontend dependencies.
Decided : Treat ERC-20 approvals as first-class UGF actions; a zero-ETH wallet can fail on approval before it ever reaches the main contract call.
Decided : Owner primary-supply marketplace approval is a seed/owner-wallet prerequisite, not something the buyer UI can repair.
Next    : Run the real browser/Base Sepolia smoke test with the seeded demo investor: verify TYI_MOCK_USD balance, ETH = 0, pending rent, UGF modal quote, successful claim, and unchanged ETH balance.
Blockers: No live wallet/browser smoke test was run in this session; UGF gateway quote/modal behavior still needs real-wallet confirmation.
---
---
Date    : 2026-05-19
Agent   : Claude (audit pass)
Did     : Audited every task in `.kiro/specs/hackathon-zero-eth-claim/tasks.md` against the repo and ticked items whose deliverables are now present in code: 1.6, 1.7, 2.1–2.3, 3.1–3.4, 5.1–5.11 (plus parent §1, §2, §3).
Did     : Verified 1.6/1.7 by reading `deployed-addresses.json` — `network: "baseSepolia"`, `mockUsdc: 0xc906…9a38`, `factory: 0xa8bb…0168`, `deployedAt: 2026-05-18T09:39:24Z`, `seededAt: 2026-05-18T09:57:52Z`, demo investor `0x25e6…c08F`, demo owner `0xa7Fa…BC3b`.
Did     : Verified Tier 2 wiring: `frontend/src/contexts/UGFContext.jsx` exposes `ugfExecute/ugfApprove/getQuote/logTx/isUGFEnabled`; `OwnerDashboard.depositRental`, `Property.handleBuyFromOwner`, `Property.handleBuyFromListing`, `Portfolio.handleCancelListing/handleCreateListing` all route through `ugfExecute`; `<ActivityFeed/>`, `<CostBanner/>`, `<FaucetPanel/>`, `<UGFBadge/>`, navbar UGF toggle, and `Landing.jsx` brand pass are all rendered.
Did     : Confirmed remaining open Tier 1 items (4.1 demo verification, 4.2 video, 4.3 gate) and Tier 2 gate (5.12) are blocked only on human-in-the-loop verification, not on missing code.
Decided : Tier 3 stretch (6.1 Privy embedded wallet, 6.2 ClaimReceipt SBT, 6.3 pitch video, 6.4 live URL) is now authorized to begin in parallel with the manual demo walkthrough, since every Tier 2 deliverable is shipped in code.
Next    : (a) Human team runs the demo walkthrough on Base Sepolia (Tier 1 gate 4.3) and the Tier 2 gate sign-off (5.12); (b) start Tier 3 task 6.1 — wrap `<UGFProvider>` with `<PrivyProvider>` and add an "Or use Google/email" CTA to `Landing.jsx`.
Blockers: Tier 3 task 6.1 needs a Privy App ID (free tier) before `<PrivyProvider>` will boot; team must provision one and add `VITE_PRIVY_APP_ID` to `.env`.
---
---
Date    : YYYY-MM-DD   ⟵ append after running the live Tier 1 demo (task 4.3)
Agent   : (name)
Did     : Executed the design.md § Testing Strategy → Tier 1 manual checklist on Base Sepolia with the seeded demo investor wallet 0x25e6…c08F. Confirmed: navbar shows "Investor", `/investor` shows pending rent = $300.00, UGF modal quoted gas in Mock USD, Claim All Rent succeeded, pending → $0.00, USDC balance → $1,000.00, ETH = 0 throughout. Captured screenshots in `docs/demo/`.
Did     : Re-ran `npx hardhat test` — all 31 tests still passing.
Decided : Tier 1 closed YYYY-MM-DD; Tier 2 authorized. (← Required by task 4.3.)
Next    : Run the Tier 2 demo walkthrough (all four flows: claim, deposit, buy-from-owner, buy-from-listing) with UGF on AND off to validate gate 5.12.
Blockers: None.
---
---
Date    : YYYY-MM-DD   ⟵ append after running the Tier 2 demo (task 5.12)
Agent   : (name)
Did     : Executed the Tier 2 demo: toggled UGF on/off in the settings popover and confirmed every state-changing flow (claim, deposit, buy-from-owner, buy-from-listing, cancel-listing, create-listing) routes through UGF when on and falls back to native ETH when off. Activity feed populated after each tx; cost banner displayed both UGF and ETH costs.
Decided : Tier 2 closed YYYY-MM-DD; Tier 3 stretch authorized. (← Required by task 5.12.)
Next    : Tier 3 — finish Privy embedded wallet (6.1), ClaimReceipt SBT (6.2), pitch video (6.3), live demo URL (6.4) in parallel.
Blockers: None for Tier 3 start; 6.4 still needs a Vercel/Netlify project provisioned.
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

*Last updated: 2026-05-19 by Claude (audit pass + Tier 3 kickoff)*

*Previously updated: 2026-05-18 by Codex*


## Session — Multi-agent orchestration + screen-enhancement primitives (2026-05-19)

### Multi-agent system
- Built `frontend/src/agents/` orchestrator system per the screen-enhancements
  spec. Hub-and-spoke: `Orchestrator` + `AgentBus` route every cross-agent
  message; agents never talk directly. Each screen owned by exactly one agent:
  - `MarketplaceAgent` → `/marketplace`
  - `PortfolioAgent` → `/portfolio`
  - `ClaimRentAgent` → `/dividends`
  - `OwnerControlRoomAgent` → `/owner`
  - `ActivityAgent` → `/activity` (and right-rail on `/marketplace`)
  - `AnalysisAgent` → `/analytics`
- `BaseAgent` enforces lifecycle (`init`/`activate`/`deactivate`/`destroy`),
  state with subscriber list, dispatch-only inter-agent comms.
- `AgentProvider` injects services (Web3, UGF, SmartAgent), mirrors shared
  state (account, chainId, gas, UGF toggle), and syncs route → activation.
- `Activity.jsx` is the reference consumer (`useAgent` + `useAgentState`).
- `agents/README.md` documents the contract for adding new screen agents.

### Screen-enhancement primitives
- New `frontend/src/components/ScreenPrimitives.jsx` exports reusable building
  blocks: `OnChainBadge`, `GasMethodBadge`, `ContractMethodBadge`,
  `FractionalOwnershipBar`, `HolderCountChip`, `HolderConcentrationStrip`,
  `EpochCadenceIndicator`, `KpiTile` (hover-revealed source citation),
  `IndexerStatus`, `WalletShort`. All render in opaque Positivus tokens — no
  glassmorphism on dense data per cross-cutting requirement.
- Wired into all six in-scope screens:
  - **Marketplace** (`Home.jsx`): indexer-first catalog load with on-chain
    fallback, `IndexerStatus` chip, holder-count chips fed by lazy
    `IntersectionObserver` 50%-viewport rule, `FractionalOwnershipBar` on
    every card showing tokens-sold / total supply, contract-method badge for
    `Marketplace.buyFromOwner`.
  - **Portfolio** (`Portfolio.jsx`): true `FractionalOwnershipBar` showing
    `holding / totalSupply`, gas-method + contract-method badges on every
    listing CTA, on-chain badge after each successful listing tx.
  - **Claim Rent** (`Dividends.jsx`): cadence indicator (median over last 12
    deposits), fractional-ownership bar per property, contract-method badge
    `RentalDistribution.claimAll`, on-chain badge after each successful claim.
  - **Owner Control Room** (`OwnerDashboard.jsx`): holder-concentration strip
    (top-5 share via `/api/properties/:id/holders`), distributed-tokens bar,
    cadence indicator, deposit form with explicit 0.01–1M validation, gas /
    contract / on-chain badges next to the deposit CTA, last-deposit txhash
    link in the panel header.
  - **Activity** (`Activity.jsx`): `IndexerStatus` chip, `WalletShort` for
    every row, `GasMethodBadge` (compact), `OnChainBadge` linking to the
    chain-derived explorer URL.
  - **Analysis** (`Analytics.jsx`): KPI tiles with hover-revealed source
    citations ("Sourced from Marketplace + RentalDistribution events"),
    holder concentration leaderboard panel (per-property top-5), lifetime
    rent leaderboard with WalletShort + chain links.
- Block-explorer URL derivation centralised in
  `ScreenPrimitives.explorerUrlForTx` / `explorerUrlForAddress`, keyed by
  `NETWORK_CHAIN_ID` (Hardhat / Sepolia / Base Sepolia).

### Verification
- `npx vite build` clean: 574 modules, no errors. CSS grew by ~7 kB to absorb
  the new primitives. JS bundle delta minor.
- Diagnostics: zero issues across all 7 touched files.

### Files touched
- New: `frontend/src/components/ScreenPrimitives.jsx`,
  `frontend/src/agents/README.md`.
- Modified: `frontend/src/index.css` (appended ~280 lines of primitive
  styles), `frontend/src/pages/{Home,Portfolio,Dividends,OwnerDashboard,Activity,Analytics}.jsx`.
- Pre-existing agent scaffold extended (already in repo from prior turns).

---
Date    : 2026-05-19
Agent   : Copilot
Did     : Resolved the pull merge conflicts across `CLAUDE.md`, `memory/decisions.md`, `frontend/dist/index.html`, `frontend/src/main.jsx`, `frontend/src/pages/{Dividends,Landing,OwnerDashboard,Portfolio}.jsx`, keeping both feature streams where they were compatible.
Did     : Validated the touched frontend sources with `get_errors` and confirmed no syntax or import issues remained after the merge.
Did     : Created and pushed merge commit `445ebf0` to `origin/main`.
Decided : Leave the unrelated local `frontend/package-lock.json` edit unstaged; it is not part of the merge result.
Next    : If needed, review or commit the local `package-lock.json` change separately.
Blockers: None for the merge/push task.


## Session — End-to-end audit + dynamic-data refactor (2026-05-19)

### Backend integration cleanup
- `backend/routes/properties.js` rewritten as the single translation layer:
  every response presents both the storage-friendly names (`tokenAddress` /
  `rentalAddress` / `marketAddress` / `totalValue`) and the on-chain names
  the frontend uses (`propertyToken` / `rentalDistribution` / `marketplace` /
  `valueInr`). Adds `tokensRemaining`, `pricePerToken`, `cadenceDays`,
  `lastDepositAt`, `holderCount` so the Marketplace + Owner + Claim Rent
  screens render correctly on indexer-backed loads.
- `GET /api/properties/:id/holders` now returns `{ count, holders[] }`.
  Each holder row carries `wallet`, raw `balance` (BigInt-as-string),
  `balanceFormatted`, `sharePct`, `updatedAt`. Frontends still tolerate the
  legacy bare-array shape.
- `backend/routes/transactions.js` rewritten:
  - Accepts `?action=` (alias for `?type=`), `?gasMethod=`, `?property=`,
    `?wallet=`, `?txHash=`, `?cursor=`, `?limit=`.
  - Keyset pagination via opaque base64 cursor (`{ t, id }`) — stable,
    cheap, no skip/offset weirdness.
  - Response envelope: `{ transactions, nextCursor, count }`.
  - Surfaces `action` alias on every row.
- `GET /api/transactions/stats` now also reports `ethTransactions`,
  `ugfShare`, `totalVolume`, `distinctWallets`, `distinctProperties`.
- `GET /api/transactions/timeseries` accepts both `?window=` (spec) and
  `?days=` (legacy). Adds `rent`, `buys`, `deposits` series alongside the
  existing `count` / `volume`.
- New route `backend/routes/market.js` → `GET /api/market/price` serves an
  ETH/USD rate. Resolution: `MARKET_ETH_USD_RATE` env override → cached
  Coingecko (5-minute TTL) → hardcoded fallback. No paid feed dep.
- `backend/jobs/indexer.js` extended:
  - Reads each property's `totalSupply`, `balanceOf(owner)`,
    `pricePerToken`, `epochCount` after every event scan; stores the
    denormalised values on the `Property` row so the frontend gets real
    numbers without walking every contract on render.
  - Computes `cadenceDays` (median of last 12 deposits) and
    `lastDepositAt` from the same Transaction rows that drive the Claim
    Rent / Owner screens.
- `backend/models/Property.js` schema gains `totalSupply`,
  `tokensRemaining`, `pricePerToken`, `lastDepositAt`, `cadenceDays` (and
  an index on `tokenAddress`). `availableSupply` kept for compatibility.

### Frontend refactor — dynamic data over hardcoded constants
- New `frontend/src/hooks/useMarketPrice.js`:
  - Single-flight ETH/USD fetch shared across consumers.
  - Returns the env constant immediately on first render so layouts never
    block on the network.
  - Exposes imperative `getEthUsdRateSync()` / `getEthUsdRateAsync()` for
    non-React callers (e.g. SmartAgent's `analyzeHoldings` heuristic).
- `CostBanner.jsx` no longer imports `ETH_USD_RATE` directly — pulls the
  live rate via `useMarketPrice()`. Re-runs the cost preview when the rate
  refreshes.
- `SmartAgentContext.jsx` warms the price cache on provider mount and
  feeds the live rate into the worth-it heuristic. Falls back to the env
  constant when the network is unreachable.
- `Home.jsx`, `OwnerDashboard.jsx`, `Analytics.jsx`, `HolderList.jsx`
  updated to consume the new `{ count, holders }` envelope. Each call site
  also tolerates the legacy bare-array shape so older indexer builds keep
  working.
- Per-screen agents updated: `MarketplaceAgent.fetchHolderCount`,
  `OwnerControlRoomAgent._fetchHolderConcentration`,
  `AnalysisAgent._fetchHolders` all read the new envelope and prefer
  server-side `sharePct` when present.
- `PrivyBridge.jsx` was failing the production bundle (top-level
  `await import("@privy-io/react-auth")` could not be tree-shaken when the
  package was missing). Replaced with a `@vite-ignore` deferred import
  using a string-built specifier so Rollup doesn't try to resolve at
  build time.

### Verification
- `npx vite build` → 576 modules, exit 0. CSS 85 kB, JS 828 kB (~260 kB
  gzipped).
- Diagnostics zero across all 10 touched files.
- Backend `node -e "require(...)"` smoke test passes for every route
  module + the indexer job.
- Live HTTP probe against a running backend confirmed:
  - `GET /api/market/price` → `{ pair: "ETH/USD", value: 2133.69, source: "coingecko", ttlSeconds: 300 }`.
  - `GET /api/transactions?limit=3` → `{ transactions: [], nextCursor: null, count: 0 }`.
  - `GET /api/transactions/stats` → extended-field envelope.
  - `GET /api/transactions/timeseries?window=30` → `{ daily, bucket, days, window }`.
  - `GET /api/properties/:id/holders` → `{ count, holders }`.
- All endpoints respond 200 on an empty database (graceful empty states).

### Known integration limits
- The indexer's denormalisation pass runs on every tick (12s when
  `ENABLE_INDEXER=true`). With a paid RPC the `INDEXER_CHUNK_BLOCKS` ceiling
  can be raised so a property's full history scans in a single tick.
- The indexer-as-source path is the recommended first read for every
  screen; the on-chain fallback path stays as the safety net for fresh
  deployments where the indexer has yet to populate the denormalised
  fields.


## Session — Dark mode (2026-05-19)

### What shipped
- New `frontend/src/context/ThemeContext.jsx` exposing `{ theme, setTheme }`.
  Storage key `realchain-theme`, validated values `"light" | "dark"`, default
  `"light"`. Cross-tab sync via the `storage` event. The `prefers-color-scheme`
  media query is deliberately not consulted — light is forced as factory default.
- `index.html` gained a synchronous bootstrap script that reads
  `localStorage["realchain-theme"]` and sets `data-theme` on `<html>` before
  React mounts. Eliminates first-paint FOUC.
- `main.jsx`: `ThemeProvider` is now the outermost provider so theme state is
  invariant to inner remounts.
- `App.jsx` `SettingsPopover`: added an **Appearance** section as the first
  group inside the existing gear popover. Two pill toggles ("Light" / "Dark"),
  active state is lime + black bold per spec. Existing UGF / Smart Gas / AI
  groups kept below — those are real features, not placeholders, so removing
  them would have been a regression. Flag if you want them dropped instead.
- `index.css`: full token system at the bottom of the file:
  - `[data-theme="light"]` and `[data-theme="dark"]` token sets exactly per
    the brief: `--bg-base`, `--bg-card`, `--bg-elevated`, `--text-primary`,
    `--text-secondary`, `--accent-lime`, `--border`, `--usdc-accent`,
    `--eth-accent`, plus a derived `--shadow-color`.
  - 0.3s ease transitions on `background-color`, `color`, `border-color`
    only — no `box-shadow` / `filter` per the brief, with reduced-motion
    override.
  - Theme pill styles using the tokens (active = lime fill, inactive =
    elevated-bg + secondary text + 1px border).
  - Dark-mode-only enhancements: navbar glassmorphism with rgba(8,12,8,0.75)
    + backdrop-blur 16px, hero radial #0F1A0F → #080C08, neon glow on the
    zero-ETH highlight chip (0 0 20px rgba(170,255,69,0.4)), USDC coins
    swap to #4DFFB4 fill, ETH coins swap to #C4A8FF, all card borders use
    the dark token, "Connect wallet" CTA gets a 0 0 24px lime glow.

### Verification
- `npx vite build` → 577 modules, exit 0. CSS 89.7 kB / 14.4 kB gzipped.
- Diagnostics: zero issues across `ThemeContext.jsx`, `App.jsx`, `main.jsx`,
  `index.css`, `index.html`.

### Things to know if extending
- Dark-mode component overrides intentionally target only the high-contrast
  surfaces (navbar, hero, cards, popovers, form inputs, muted text). Pages
  that still ship hardcoded colours in inline `style={...}` will follow the
  light tokens until they are migrated to `var(--…)`. Migrating those is
  mechanical — search for hex literals in JSX style props and replace with
  the matching token.
- The new tokens live in `:root, html[data-theme="light"]` so any consumer
  that doesn't set `data-theme` (e.g. a future static export) still gets the
  light palette automatically.


## Session — Dark mode v2 (proper redesign) (2026-05-19)

### Why this round
The first dark-mode pass had three problems: green-tinted base felt
amateur, `#AAFF45` was too saturated against pure black (eye strain), and
most components still pulled hardcoded `#191A23` / `#fff` literals so dark
mode only half-applied.

### What changed
- **Palette redesigned** for premium fintech feel:
  - `--bg-base #0B0E12`, `--bg-card #161A21`, `--bg-elevated #1E232C` —
    cool navy-black, no green tint, three-step elevation pyramid.
  - `--text-primary #ECEDEF` (warm off-white at 92% L), `--text-secondary
    #9AA2B0` slate, `--text-tertiary #6B7280` for the quiet level.
  - `--accent-lime #B7F870` desaturated for fills, `--accent-lime-strong
    #C7FF82` for active/hover states. Soft alpha `--accent-lime-soft` for
    selection / hero washes.
  - `--border #232830` hairline, `--border-strong #2D3340` for the
    Positivus 1px outlines that survive on dark.
  - `--usdc-accent #34D399` (emerald) and `--eth-accent #A78BFA`
    (periwinkle) — the previous neon-mint USDC was unreadable.
- **Legacy `--positivus-*` tokens rebound** at the dark scope so every
  consumer that still uses `var(--positivus-white)` etc. flips
  automatically. No page-by-page rewrite needed.
- **Explicit dark overrides** on every component that hardcoded hex:
  - Navbar (cool 0.55 alpha glass over `#0B0E12`).
  - Hero (radial midnight wash, recoloured ETH/USDC coins, lime neon edge
    on the zero-ETH chip).
  - Cards / tables / popovers / forms / chips / badges / banners.
  - Every screen primitive (`OnChainBadge`, `GasMethodBadge`,
    `ContractMethodBadge`, `FractionalOwnershipBar`, `HolderCountChip`,
    `HolderConcentrationStrip`, `EpochCadenceIndicator`, `KpiTile`,
    `IndexerStatus`, `WalletShort`).
  - Activity feed rows, agent suggestion block, cost banner.
- Scrollbar restyled so the rail isn't a bright stripe on dark.
- Selection colour set to a faint lime so highlights stay readable.

### Verification
- `npx vite build` → 577 modules, exit 0. CSS 103.4 kB / 15.9 kB gzipped.
- Diagnostics zero on `index.css`.

### Not yet covered
- Inline `style={{ color: "#191A23" }}` literals on a small number of pages
  still resolve to the brand-static black even in dark mode. They're rare
  (the previous session migrated the visible ones); a future sweep can
  replace them with `var(--text-primary)`.


## Session - Landing floating badge removal (2026-05-19)

### What changed
- Removed the floating `USDC settlement` badge from the landing hero in
  `frontend/src/pages/Landing.jsx`.
- Scoped hero SVG sizing in `frontend/src/index.css` to
  `.lp-hero-illu-float > svg`, preventing inline hero icons from inheriting
  full illustration dimensions.
- Fixed the optional Privy embedded-wallet bridge by moving the dynamic
  `@privy-io/react-auth` import into `PrivyShell` lifecycle state. This
  removed the Vite top-level-await build failure hit during verification.

### Verification
- `npm.cmd run build` from `frontend/` passes; Vite still emits only the
  existing large-chunk warning.
- `graphify update .` completed and refreshed `graphify-out/`.
