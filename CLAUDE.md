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

**UGF Hackathon / Track 3 — Wallet and Agents**

North star demo:
1. Investor wallet has token holdings, pending rent, some `TYI_MOCK_USD`, and **0 ETH**.
2. Investor opens the app on Base Sepolia.
3. Investor clicks **Claim All Dividends**.
4. UGF prices, settles, and executes the transaction.
5. Dividends arrive while the user never acquires or spends native ETH.

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

| Priority | Task | Owner | Notes |
|----------|------|-------|-------|
| High | Phase 1 — Add Base Sepolia deployment support and deploy the protocol there | TBD | Needed before the public demo |
| High | Phase 2 — Build owner/investor dashboards and role-based navigation | TBD | Judges should land on role-specific UX |
| High | Phase 3 — Integrate UGF for `claimAll()` first | TBD | Core hackathon requirement / minimum winning scope |
| Medium | Phase 3 stretch — Wrap `buyFromOwner()`, `depositRental()`, and `buyFromListing()` | TBD | Only after dividend claims work |
| Medium | Phase 4 — Polish the 60-second demo path and record proof | TBD | Gas-in-Mock-USD messaging, modal, zero-ETH proof |
| Medium | Make fresh local demo fully interactive without manual setup | TBD | See known bugs/gaps |
| Low | Add repo URL, team ownership, staging/production metadata | TBD | Human-owned information |

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

### What must ship
- Base Sepolia support in Hardhat and frontend network config.
- Role-specific dashboards:
  - `OwnerDashboard.jsx`
  - `InvestorDashboard.jsx`
- UGF transaction path for `claimAll()` with visible “gas paid in Mock USD” messaging and a quote/cost preview.
- A judge-ready demo path proving the investor can claim with **0 ETH**.

### What should stay stable
- Core Solidity contracts unless the integration reveals a hard blocker.
- Existing local Hardhat tests and the V1/V2 research surface.
- `claimAll()` as the first UGF target; do not let secondary actions outrun the centerpiece.

### Verified UGF implementation facts
- The official testnet SDK is `@tychilabs/ugf-testnet-js`.
- Its testnet route is Base Sepolia (`84532`) with settlement coin `TYI_MOCK_USD`.
- Its lifecycle is: authenticate → quote → settle → sponsor/execute → confirm.
- The official React wrapper is `@tychilabs/react-ugf`, exposing `UGFProvider` and `useUGFModal().openUGF(...)`.
- Before coding, re-check the current official UGF SDK docs and repo READMEs; the hackathon plan is an internal brief, not the source of truth for API details.

### Preferred implementation shape
- New `frontend/src/context/UGFContext.jsx` owns UGF setup and execution helpers.
- New `OwnerDashboard.jsx` owns rent deposit / owned-property flows.
- New `InvestorDashboard.jsx` owns portfolio summary and the UGF-powered claim flow.
- `App.jsx` owns role-based routing.
- `Web3Context.jsx` remains the generic wallet/network/contracts layer.

### Definition of done
- `hardhat.config.js` supports `baseSepolia`.
- Frontend can connect/switch to Base Sepolia.
- Contracts are deployed and addresses are reflected in frontend config.
- Owner and investor see different dashboards.
- Investor claim flow succeeds from a wallet with zero ETH and shows Mock-USD gas messaging.
- The demo can be run twice from documented steps without reconstructing hidden setup knowledge.

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
| Project board | TBD |
| Design docs | `PROJECT_EXPLAINED.txt`, `README.md`, `HACKATHON_PLAN.txt` |
| Staging env | None configured |

---

*Last updated: 2026-05-17 by Codex*
