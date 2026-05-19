# Flags

## Resolved
- ~~Repo URL unknown~~ - `https://github.com/AyushX1602/Real-Chain`.
- ~~`.env.example` placeholder secret broke fresh local Hardhat startup~~ - fixed; placeholder `PRIVATE_KEY` blanked.
- ~~Graphify refresh required manual `graphify update` calls~~ - automated 2026-05-18 via Kiro hooks, optional git pre-commit, and root npm scripts.
- ~~Contracts not yet deployed to Base Sepolia / frontend still pointed at local fallbacks~~ - `deployed-addresses.json` records Base Sepolia MockUSDC `0xc90610277191F7Dbe7Ddf18319Bd28D3aAAe9a38` and Factory `0xa8bb0D4923C1aBB9294cBc115c6FF81B2DaC0168`; `frontend/src/config/contracts.js` now defaults to those in `baseSepolia` mode.
- ~~`OwnerDashboard.jsx` and `InvestorDashboard.jsx` do not exist~~ - both role dashboards exist and are routed from `App.jsx`.
- ~~UGF SDK API surface unverified before integration~~ - rechecked 2026-05-19 against Tychi's live `ugf-testnet-js` README and installed `@tychilabs/react-ugf` README/types. React UGF uses `<UGFProvider mode="testnet">` and `useUGFModal().openUGF(...)`.
- ~~ERC-20 approve calls were direct signer transactions~~ - all frontend `.approve()` calls were removed from `frontend/src`; approvals now route through `UGFContext.ugfApprove()`.
- ~~UGF on/off toggle missing~~ - settings popover exposes the UGF toggle and `UGFBadge` / `CostBanner` react to it.
- ~~Landing hero showed an oversized floating "USDC settlement" logo~~ - removed the bottom hero badge from `Landing.jsx` and scoped hero SVG sizing so inline icons no longer inherit full-illustration dimensions.
- ~~Frontend build failed on `PrivyBridge.jsx` top-level await~~ - optional Privy SDK loading now happens inside `PrivyShell` lifecycle state, so Vite builds for the configured browser target.
- ~~Owner/admin login could still expose the investor portfolio surface~~ - owner email sessions now route to `/admin`, owner wallet sessions redirect away from `/portfolio`, and the admin dashboard filters owned properties by a saved receiving wallet.
- ~~Admin property creation could hit raw Localhost/MetaMask RPC failures~~ - admin writes now require the saved wallet and expected chain, the dashboard exposes a network-repair button, property creation uses `ugfExecute()`, and background gas/balance polling ignores wrong-wallet networks.

## Open - Tier 1 (must clear before demo can run)
- Live Base Sepolia clean-wallet smoke test still has not been run in this session. Must prove: demo investor has PROP > 0, pending rent > 0, TYI_MOCK_USD for gas, and exactly 0 ETH before clicking claim.
- `scripts/seedDemo.js` exists and records demo addresses, but its current Base Sepolia output must be re-run or verified before demo day: owner marketplace approval, investor MockUSDC, investor PROP balance, rent epoch, pending dividends, and final ETH sweep to 0.
- Final `TYI_MOCK_USD` faucet/balance path must be checked in the actual demo wallet. UGF docs confirm the settlement coin, but the wallet still needs funds from https://universalgasframework.com/faucets.
- Browser-level UGF modal behavior still needs manual verification. Build passes, but only a wallet session can prove modal quote/payment/execute/confirm in the real app, especially the admin `createProperty` path after the latest UGF routing.

## Open - Tier 2 (only relevant after Tier 1 demo runs)
- Confirm every Tier 2 state-changing flow from a 0-ETH wallet in-browser: `depositRental`, `buyFromOwner`, `buyFromListing`, `createListing`, and `cancelListing`. Code paths are UGF-wrapped, but manual chain proof is still pending.
- Express backend activity feed exists but should be smoke-tested with MongoDB online and offline. It is not yet proven as judge-ready.
- Cost-comparison banner is built, but UGF quote preview depends on the gateway `/quote` response and browser CORS. Confirm it populates in the deployed browser.
- User-visible "Dividends" string should be re-grepped before submission. The route/file name can stay, but visible copy should read "Claim Rent".
- In-app faucet helper exists, but cold-start judge flow still needs testing with the real demo wallet and current faucet URLs.
- "RealChain v2" naming + branding pending (Phase 5G). Hackathon scoring is partly aesthetic.

## Open - Tier 3 (stretch only)
- Embedded wallet (Privy / Web3Auth) - Phase 6A. Not started.
- Soulbound NFT claim receipt - Phase 6B. New contract `ClaimReceipt.sol` not started; would require redeploy, so do this last.
- 60-90 sec pitch video - Phase 6C. Not started.
- Live demo URL on Vercel/Netlify - Phase 6D. Not started.

## Open - Auth / rent-payer flow
- Email/password auth now exists (`/api/auth/signup`, `/login`, `/me`) but needs a manual browser smoke test with MongoDB online: create owner/admin, save a receiving wallet, create rent-payer, reload, verify JWT restore and role redirects.
- `JWT_SECRET` is blank in `.env.example`; set a long random secret before any shared deployment. The backend has a dev fallback only for local work.
- The rent-payer dashboard transfers MockUSDC directly to the selected property owner and logs it as a `deposit` activity. It does not call `RentalDistribution.depositRental()`, which is still owner-only by contract design.

## Risks (need a decision, not just a task)
- **Two "Mock USD" tokens** - our `MockUSDC` is rent settlement; UGF's `TYI_MOCK_USD` is gas settlement. This is decided, but UI copy must keep the distinction sharp.
- **Settlement-token swap** - if anyone points the RealChain contracts at UGF's `TYI_MOCK_USD` for rent settlement, the UI/accounting story becomes inconsistent. Do not do this without team sign-off.
- **UGF SDK version drift** - `HACKATHON_PLAN.txt` is internal notes, not API truth. Last checked 2026-05-19: React wrapper exposes `UGFProvider` / `useUGFModal`, and testnet mode is Base Sepolia + `TYI_MOCK_USD`. Recheck before demo-day changes.
- **MongoDB Atlas quota** - backend uses Atlas free tier. If the activity feed gets hot during the demo, M0 connection limits could cause API blips. Acceptable risk; mention in pitch only if asked.
- **Frontend dependency hygiene** - `npm install` on 2026-05-19 restored the missing `framer-motion` dependency and produced a passing Vite build, but npm reported 7 moderate audit findings. Do not run `npm audit fix --force` casually because it may make breaking changes.

## Process / team
- Team ownership, project board, deployment URLs are still unknown for the most part. Persons A/B/C/D are role placeholders in `implementation_plan.md`.
- Each teammate still needs to install Graphify once locally; `.codex/hooks.json` is intentionally not shared.
- On this machine, `graphify.exe` is on PATH at `C:\Users\ayush\AppData\Local\Programs\Python\Python311\Scripts\graphify.exe`; `uvx` is not on PATH. Use `graphify.exe query|path|explain|update` here unless PATH changes.
- On this machine, Graphify Codex integration is installed and auto-runs via local `.codex/hooks.json` (machine-specific; not committed).
- Four Kiro IDE hooks refresh `graphify-out/` automatically on save/create/delete/agent-stop for machines with those hooks installed. Other contributors can opt in via Kiro or `git config core.hooksPath scripts/git-hooks`.
- Teammates must run `cd backend && npm install` after cloning.
- After meaningful work, every agent must append a session entry to `CLAUDE.md` and update this file. Stale flags break the next agent's planning.
- `frontend/package-lock.json` has an unrelated local modification from `npm i`; it was intentionally left unstaged during the merge/push task.

## Cuts (intentional, not gaps)
- The V1/V2 distribution comparison and snapshot-attack research surface stays in the repo for the academic paper but is not surfaced to judges. Do not re-add it to the hackathon README, demo, or pitch video.


## Resolved (2026-05-19, late session)
- ~~Landing recent-activity table threw "Encountered two children with the same key" warning when backend returned multiple rows sharing one txHash~~ - `Landing.jsx` row key now composes `${_id || txHash || "row"}-${i}` so duplicates can't collide. `ActivityFeed.jsx` still uses the old `txHash || _id || i` pattern; flag if a similar warning appears there.
