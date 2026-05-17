# Flags

- Team ownership, repo URL, project board, and deployment URLs are still unknown.
- Fresh local deploys still need owner marketplace approval before buyer primary purchases work.
- Fresh local deploys do not automatically fund investor wallets with MockUSDC.
- `.env.example` contains placeholder secret-like values that should not be copied unchanged for local Hardhat startup.
- `agentmemory` / `mem0` are not configured; the repo now has Graphify plus markdown memory, but no chosen persistent-memory backend beyond that.
- Every teammate still needs to run `graphify codex install` once locally; `.codex/hooks.json` is intentionally not shared.
- The UGF hackathon branch is now active but not implemented yet.
- Need verified Base Sepolia deployment inputs: RPC, deployer wallet, ETH for deployment, and final deployed contract addresses.
- Need to confirm the final `TYI_MOCK_USD` route/address source during implementation instead of relying on loose “Mock USD” wording.
- Need to choose the exact UGF integration surface per feature: React modal wrapper for frontend UX, low-level testnet SDK only if needed.
- Need a deterministic Base Sepolia demo-state recipe: owner property, investor token holdings, rent deposited, pending dividends, investor with positive `TYI_MOCK_USD` and zero ETH.
- Current highest-value path is `claimAll()`; broader gasless wrapping should not displace that until the demo works end-to-end.
