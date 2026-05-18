# Agent entry point

Read `CLAUDE.md` in full before making changes. It is the canonical project memory file for this repository.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Active hackathon branch

The current implementation target is the UGF hackathon flow. The authoritative plan is `implementation_plan.md` (tiered: Tier 1 mandatory → Tier 2 differentiators → Tier 3 stretch). `HACKATHON_PLAN.txt` is the UX/demo brief. `../hackathon_ps.pdf` is the official problem statement.

Rules for future agents:
- Read `CLAUDE.md`, `implementation_plan.md`, and `HACKATHON_PLAN.txt` before hackathon work.
- Treat `implementation_plan.md` as the single source of truth for **what** to build and **in what order**. Do not rewrite the tiered structure; layer new tasks onto it.
- Tiers MUST ship in order. Do NOT start Tier 2 (Phase 5) until Phase 4A passes end-to-end. Do NOT start Tier 3 (Phase 6) until 5A/5B/5C/5D/5E are green.
- Before any UGF-specific code, verify the current official Tychi/UGF SDK docs and READMEs rather than coding from memory.
- The minimum winning demo (Tier 1): an investor with **0 ETH** claims dividends on Base Sepolia while gas is settled in `TYI_MOCK_USD`.
- Settlement-token policy: our `MockUSDC` for rent settlement, UGF's `TYI_MOCK_USD` for gas only. UI copy must distinguish them.
- Implement `claimAll()` first (Phase 3). Wrap `buyFromOwner()`, `depositRental()`, and `buyFromListing()` only in Tier 2 (Phase 5A).
- Keep core Solidity contracts and the existing 31 tests unchanged through Tier 1 + Tier 2. New contracts (e.g. `ClaimReceipt.sol` in 6B) only land in Tier 3.
- Prefer a separate `UGFContext.jsx` and role-specific dashboards so UGF concerns do not dissolve into generic wallet state.
- The V1/V2 distribution and snapshot-attack research surface stays in the repo for the academic paper but is **not** surfaced in the hackathon README, demo, or pitch video.
- After meaningful work, append a session entry to `CLAUDE.md` and update `memory/decisions.md` / `memory/flags.md` so the next agent (and the rest of the team) starts from a current map.
