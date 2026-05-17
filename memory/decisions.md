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
