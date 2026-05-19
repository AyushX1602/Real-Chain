# Decisions

| Date | Decision | Reason | Who |
|------|----------|--------|-----|
| 2026-05-17 | Use ERC20Votes historical balances for dividend snapshots | Prevents post-deposit buyers from claiming earlier rent | Existing project |
| 2026-05-17 | Keep V1 distribution as default and V2 as optional | V1 is simpler; V2 is better for multi-epoch claim patterns | Existing project |
| 2026-05-17 | Treat smart contracts as the backend layer | No separate API backend exists in the current repo | Codex |
| 2026-05-17 | Initialize Graphify and install the Codex hook | Future agents can query scoped graph context before broad file reads | Codex |
| 2026-05-17 | Ignore `.codex/hooks.json` but commit `graphify-out/` | Hook paths are machine-specific; graph data is team-shared context | Codex |
| 2026-05-17 | Make the UGF hackathon branch the active implementation path | It is the current judge-facing milestone | Codex |
| 2026-05-17 | Ship zero-ETH `claimAll()` before broader gasless coverage | It is the smallest complete proof for Track 3 | Codex |
| 2026-05-17 | Keep core Solidity stable during the hackathon pass | The protocol already works; the gap is network, UX, and execution plumbing | Codex |
| 2026-05-17 | Prefer `UGFContext.jsx` plus owner/investor dashboards | Separates concerns and makes the demo legible | Codex |
| 2026-05-17 | Re-verify live UGF docs before implementation | Official SDKs evolve faster than internal notes | Codex |
| 2026-05-17 | Full stack: React + Express + MongoDB + Solidity + UGF | Same JS ecosystem end-to-end; MongoDB for caching + tx logs | Antigravity |
| 2026-05-17 | Backend degrades gracefully without MongoDB | GETs return empty arrays, POSTs return 503 with hint | Antigravity |
| 2026-05-17 | requireDb middleware guards all API routes | Single point of control for DB connectivity handling | Antigravity |
| 2026-05-17 | Backend port 5000, frontend port 3000 | Standard separation; CORS enabled on backend | Antigravity |
| 2026-05-18 | Tier the hackathon build: Tier 1 mandatory → Tier 2 differentiators → Tier 3 stretch, with gates between tiers | A Tier-1-only plan ships a passing submission, not a winning one. Tiering forces differentiators in only after the spec floor is provably green | Kiro |
| 2026-05-18 | Add Phase 1E (deterministic demo-state seeding) to Tier 1 | The 60-second demo silently fails if the demo wallet is configured by hand on demo day | Kiro |
| 2026-05-18 | Settlement-token policy: our `MockUSDC` for rent, UGF's `TYI_MOCK_USD` for gas only | All RealChain contracts already speak our `MockUSDC`; UGF only touches its own gas token. Mixing them in UI copy will confuse judges | Kiro |
| 2026-05-18 | Cut the V1/V2 + snapshot-attack research surface from the hackathon submission | Hackathon scoring is "beginner-friendly + invisible UX". Research nuance is paper-relevant, distracting in a 60-second demo. Stays in the repo for the academic paper | Kiro |
| 2026-05-18 | Tier 2 wraps all four state-changing flows with UGF, not just `claimAll()` | Whole demo becomes zero-ETH; kills the "but you still need ETH for X" objection | Kiro |
| 2026-05-18 | Tier 2 ships a UGF on/off toggle | Lets judges see UGF doing the work — toggle off → claim fails (no ETH); toggle on → succeeds. Ten-second proof of thesis | Kiro |
| 2026-05-18 | The Express + MongoDB backend earns its place via the Tier 2 activity feed (Phase 5C) | Otherwise the backend is judge-invisible dead weight | Kiro |
| 2026-05-18 | Rename user-visible "Dividends" → "Claim Rent" | Hackathon explicitly asks for beginner-friendly language; "Dividends" reads as DeFi jargon | Kiro |
| 2026-05-18 | Tier 3 stretch includes embedded wallet (Privy/Web3Auth) + soulbound NFT receipts | Embedded wallet collapses the two friction points (no ETH + no MetaMask) into one email-based onboarding. Soulbound receipts also hit the Minting track | Kiro |
| 2026-05-18 | Run a design-first spec workflow next | Architecture is mostly known (UGF wrapper, role split, demo-state seeding, activity feed). Design-first is faster than requirements-first when the technical shape is clear | Kiro |
| 2026-05-18 | Use `uvx --from graphifyy graphify.exe` as Graphify fallback on this machine | `graphify` is not on PATH in the current shell, but the uvx command updates `graphify-out` successfully | Codex |
| 2026-05-18 | Install Graphify Codex hook integration for automatic graph refresh | Removes manual "run graphify update" reminders by wiring official PreToolUse hook behavior on this machine | Codex |
| 2026-05-18 | Make Graphify refresh fully automatic across IDE + git: Kiro hooks (fileEdited / fileCreated / fileDeleted / agentStop), opt-in git pre-commit, and root npm scripts (`graphify:update`/`:watch`/`:query`/`:explain`/`:path`) | The "run graphify update after each change" rule kept relying on humans/AI to remember. Wiring it into save events and commits removes the discipline tax and guarantees the graph reflects line-level state. | Kiro |
| 2026-05-19 | Use the official React UGF shape: `<UGFProvider mode="testnet">` plus `useUGFModal().openUGF(...)` | `@tychilabs/react-ugf` does not export `openUGF` at module level. The old dynamic import path silently fell back to direct signer transactions, which breaks the zero-ETH story. | Codex |
| 2026-05-19 | Default Base Sepolia frontend addresses to the recorded deployment, not localhost | `VITE_NETWORK_MODE=baseSepolia` must never point judges at Hardhat fallback addresses. Localhost defaults are now scoped to `VITE_NETWORK_MODE=local`. | Codex |
| 2026-05-19 | Route UI ERC-20 approvals through `ugfApprove()` | Approvals are state-changing transactions too. A 0-ETH investor can still fail before `buy`, `deposit`, or `list` unless the approval itself goes through UGF. | Codex |
| 2026-05-19 | Treat owner primary-supply approval as a seed/owner prerequisite, not something the buyer UI can fix | The buyer cannot approve the owner's PROP balance. The property page now surfaces the missing approval instead of sending a useless buyer-side token approval. | Codex |
| 2026-05-20 | Treat owner email accounts as admin profiles with one unique receiving wallet | Admin sessions should manage properties by an explicit wallet address, not accidentally render investor portfolio holdings from whichever demo wallet is connected. Write actions still require the connected MetaMask account to match the saved wallet. | Codex |
| 2026-05-20 | Guard every admin write by saved wallet + expected network before touching contracts | The admin workflow was failing with raw MetaMask/RPC errors when the browser wallet was on Localhost or a throttled RPC. Creation/deposit actions now stay locked until the saved admin wallet is connected on the configured chain, and property creation routes through the shared UGF/native helper. | Codex |


## 2026-05-19 — Multi-agent orchestration architecture

**Decision**: Adopt hub-and-spoke multi-agent orchestration where each of the
six in-scope screens (Marketplace, Portfolio, Claim Rent, Owner Control Room,
Activity, Analysis) is owned by exactly one specialised agent. All cross-screen
interaction routes through a single `Orchestrator` + `AgentBus`. Agents never
import or call each other directly.

**Rationale**: Screen ownership becomes greppable, the wire format is a small
set of constants in `messageTypes.js`, and a regression in one screen cannot
silently mutate another's state. The orchestrator owns the React Router sync,
service injection (Web3 / UGF / SmartAgent), and shared-state mirroring; agents
own domain logic, fetches, and contract calls.

**Implementation**: `frontend/src/agents/` with `core/` (bus, orchestrator,
provider, base agent, message types, api helper, toast bridge) and `screens/`
(one file per agent). `AgentProvider` wraps the app inside the provider tree.
`useAgent(id)` + `useAgentState(id)` hooks are the only React-side surface;
screens dispatch commands on the agent and re-render from its state snapshot.

**Tradeoffs**: Some indirection vs direct `useState` in each page. Migration
of existing pages is incremental — the agent layer mirrors page behaviour so
pages can adopt `useAgent` + `useAgentState` one at a time. `Activity.jsx` is
the reference consumer.

## 2026-05-19 — Shared screen primitives over per-screen one-offs

**Decision**: Centralise visible blockchain / tokenization markers
(`OnChainBadge`, `GasMethodBadge`, `ContractMethodBadge`,
`FractionalOwnershipBar`, `HolderCountChip`, `HolderConcentrationStrip`,
`EpochCadenceIndicator`, `KpiTile`, `IndexerStatus`, `WalletShort`) in a
single component file `frontend/src/components/ScreenPrimitives.jsx`.

**Rationale**: Every screen needs the same building blocks (link to explorer,
contract-method context, fractional ownership visualisation). One source of
truth keeps the Positivus visual language consistent (lime / black / white,
1px borders, 5px hard shadows, opaque on dense data) and avoids drift as new
screens land.

**Where they appear**: Marketplace cards (holder count, ownership-progress,
contract method), Portfolio rows (fractional ownership, gas + contract +
on-chain badges), Claim Rent (cadence + ownership + contract method), Owner
Control Room (holder concentration strip + cadence + distribution bar +
last-deposit explorer link), Activity (gas + wallet + on-chain badges),
Analysis (KPI tiles with source citation + concentration leaderboard).

**Block-explorer URL derivation**: centralised in `explorerUrlForTx` /
`explorerUrlForAddress`, keyed by `NETWORK_CHAIN_ID`. Hardhat returns null
(no explorer); Sepolia / Base Sepolia map to their respective chain explorers.

## 2026-05-19 - Landing hero ornament cleanup

**Decision**: Remove the floating `USDC settlement` badge from the landing
hero and scope hero illustration SVG sizing to `.lp-hero-illu-float > svg`.

**Rationale**: The badge read as a stray floating logo in the first viewport,
and the broad `.lp-hero-illu svg` selector could accidentally stretch inline
SVG icons inside hero overlays.

**Implementation**: `frontend/src/pages/Landing.jsx` no longer renders the
bottom `lp-hero-illu-pill`; `frontend/src/index.css` now applies full-width
hero SVG sizing only to the root illustration SVG.

## 2026-05-19 - Optional Privy SDK loading avoids top-level await

**Decision**: Load `@privy-io/react-auth` from `PrivyShell` component
lifecycle instead of awaiting the dynamic import at module top level.

**Rationale**: Vite's configured production target rejects top-level await.
Privy is optional, so the app should still build and boot when no
`VITE_PRIVY_APP_ID` is configured or the optional SDK is absent.

**Implementation**: `frontend/src/context/PrivyBridge.jsx` caches the dynamic
import promise, stores the loaded module in React state, and keeps rendering
children unchanged until the optional provider is available.

## 2026-05-19 - Email/password auth stays separate from wallet profiles

**Decision**: Implement basic email/password auth in a new
`backend/models/AuthUser.js` collection and expose JWT login/signup via
`/api/auth`, rather than overloading the existing wallet-indexed `User` model.

**Rationale**: The existing `User` model is keyed by wallet address and feeds
on-chain dashboard/activity stats. Email accounts can exist before a wallet is
connected, so a separate auth model avoids Mongo unique-index migration risk
and keeps wallet analytics untouched.

**Implementation**: Passwords are hashed with Node `crypto.scryptSync`; JWTs
are signed as HS256 using `JWT_SECRET` with a dev fallback. Frontend session
state lives in `frontend/src/context/AuthContext.jsx`, and roles map to
`owner -> /owner` and `tenant -> /tenant`.

## 2026-05-19 - Wallet refresh restores authorized MetaMask sessions

**Decision**: `Web3Context` now calls `eth_accounts` on load and hydrates the
provider/signer/account when MetaMask has already authorized the site.

**Rationale**: A connected wallet was dropping out of React state after browser
refresh even though MetaMask still knew the site permission. Silent restore
keeps the dashboard connected without prompting users again.
