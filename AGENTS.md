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

The current implementation target is the UGF hackathon flow in `HACKATHON_PLAN.txt`.

Rules for future agents:
- Read `CLAUDE.md` and `HACKATHON_PLAN.txt` before hackathon work.
- Before UGF-specific code, verify the current official Tychi/UGF SDK docs rather than coding from memory.
- The minimum winning demo is: an investor with **0 ETH** claims dividends on Base Sepolia while gas is settled in `TYI_MOCK_USD`.
- Implement `claimAll()` first. Treat `buyFromOwner()`, `depositRental()`, and `buyFromListing()` as secondary until the claim path works end-to-end.
- Keep the core Solidity contracts and local tests unchanged unless integration proves a change is necessary.
- Prefer a separate `UGFContext.jsx` and role-specific dashboards so UGF concerns do not dissolve into generic wallet state.
