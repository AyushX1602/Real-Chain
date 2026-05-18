# Flags

## Resolved
- ~~Repo URL unknown~~ — `https://github.com/AyushX1602/Real-Chain`.
- ~~`.env.example` placeholder secret broke fresh local Hardhat startup~~ — fixed; placeholder PRIVATE_KEY blanked.
- ~~Need verified Base Sepolia deployment inputs (RPC, deployer wallet, ETH for deployment)~~ — partially: `baseSepolia` is wired in `hardhat.config.js`. Funded wallet + actual deployment still TODO (see Open).

## Open — Tier 1 (must clear before demo can run)
- Base Sepolia deployer wallet not yet funded with testnet ETH. Faucet: https://www.alchemy.com/faucets/base-sepolia
- Contracts not yet deployed to Base Sepolia. `deployed-addresses.json` still reflects localhost.
- `frontend/src/config/contracts.js` still points at chain id `31337`. Must flip to `84532` after 1B.
- No deterministic demo-state seeding script exists yet (`scripts/seedDemo.js` planned in Phase 1E). Demo wallet currently has to be set up by hand → fragile on demo day.
- Fresh local deploy still needs owner marketplace approval before buyer primary purchases work. Roll into the seed script (Phase 1E) so this never bites again.
- Fresh local deploy does not auto-fund investor wallets with MockUSDC. Same fix.
- `OwnerDashboard.jsx` and `InvestorDashboard.jsx` do not exist yet (Phase 2A/2B).
- `@tychilabs/react-ugf` is installed in `frontend/`, but UGF SDK API surface must still be re-verified against the live README before integration (Phase 3A/3B).
- Final `TYI_MOCK_USD` route/address on Base Sepolia must be confirmed against UGF's current docs; do not trust internal notes.

## Open — Tier 2 (only relevant after Tier 1 demo runs)
- All three secondary state-changing flows (`depositRental`, `buyFromOwner`, `buyFromListing`/`cancelListing`) and the ERC-20 `approve` calls are still on the normal MetaMask path — Phase 5A unwraps them.
- No UGF on/off toggle yet (Phase 5B). Without it judges have to take "gas paid in Mock USD" on faith.
- Express backend exists but is judge-invisible. Phase 5C wires the activity feed to give it a job.
- Cost-comparison banner ("without UGF" vs "with UGF") not built (Phase 5D).
- User-visible "Dividends" string still appears across the UI; rename to "Claim Rent" pending (Phase 5E).
- No in-app faucet helper (Phase 5F). Cold-start judges have no easy on-ramp.
- "RealChain v2" naming + branding pending (Phase 5G). Hackathon scoring is partly aesthetic.

## Open — Tier 3 (stretch only)
- Embedded wallet (Privy / Web3Auth) — Phase 6A. Not started.
- Soulbound NFT claim receipt — Phase 6B. New contract `ClaimReceipt.sol` not started; would require redeploy, so do this last.
- 60–90 sec pitch video — Phase 6C. Not started.
- Live demo URL on Vercel/Netlify — Phase 6D. Not started.

## Risks (need a decision, not just a task)
- **Two "Mock USD" tokens** — our `MockUSDC` (rent settlement) vs UGF's `TYI_MOCK_USD` (gas settlement). Decision is recorded in `memory/decisions.md` 2026-05-18, but UI copy still needs to land that distinction consistently. Watch for drift in any new component.
- **Settlement-token swap** — if anyone tries to point our contracts at UGF's `TYI_MOCK_USD` for rent settlement, the existing 31 tests still pass on local Hardhat but the on-chain accounting on Base Sepolia will be inconsistent with what the UI shows. Don't do this without team sign-off.
- **UGF SDK version drift** — `HACKATHON_PLAN.txt` is internal notes, not API truth. Verify against live SDK README before each integration touch.
- **MongoDB Atlas quota** — backend uses Atlas free tier. If the activity feed gets hot during the demo, M0 connection limits could cause API blips. Acceptable risk; mention in pitch only if asked.

## Process / team
- Team ownership, project board, deployment URLs are still unknown for the most part. Persons A/B/C/D are role placeholders in `implementation_plan.md`.
- Each teammate still needs to run `graphify codex install` once locally; `.codex/hooks.json` is intentionally not shared.
- On this machine, `graphify` is not on PATH. Use `uvx --from graphifyy graphify.exe query|path|explain|update` as the working fallback.
- On this machine, Graphify Codex integration is installed and auto-runs via local `.codex/hooks.json` (machine-specific; not committed).
- Teammates must run `cd backend && npm install` after cloning.
- Frontend currently does not call backend API endpoints. Will start in Phase 5C.
- After meaningful work, every agent must append a session entry to `CLAUDE.md` and update this file. Stale flags break the next agent's planning.

## Cuts (intentional, not gaps)
- The V1/V2 distribution comparison and snapshot-attack research surface stays in the repo for the academic paper but is **not** surfaced to judges. Do not re-add it to the hackathon README, demo, or pitch video.
