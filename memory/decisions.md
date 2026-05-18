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
