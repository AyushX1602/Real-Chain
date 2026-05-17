# Flags

- Team ownership, ~~repo URL~~, project board, and deployment URLs are still unknown.
  - **Partially resolved:** Repo is at https://github.com/AyushX1602/Real-Chain
- Fresh local deploys still need owner marketplace approval before buyer primary purchases work.
- Fresh local deploys do not automatically fund investor wallets with MockUSDC.
- ~~`.env.example` contains placeholder secret-like values that should not be copied unchanged for local Hardhat startup.~~ **FIXED**
- `agentmemory` / `mem0` are not configured; the repo now has Graphify plus markdown memory, but no chosen persistent-memory backend beyond that.
- Every teammate still needs to run `graphify codex install` once locally; `.codex/hooks.json` is intentionally not shared.
- The UGF hackathon branch is now active but not implemented yet.
- ~~Need verified Base Sepolia deployment inputs: RPC, deployer wallet, ETH for deployment.~~ **Partially resolved:** baseSepolia config added. Still need funded wallet + actual deployment.
- Need to confirm the final `TYI_MOCK_USD` route/address source during implementation.
- Need to choose the exact UGF integration surface per feature.
- Need a deterministic Base Sepolia demo-state recipe.
- Current highest-value path is `claimAll()`; broader gasless wrapping should not displace that until the demo works end-to-end.
- **NEW:** MongoDB is not installed locally. Recommend MongoDB Atlas free tier (M0): https://www.mongodb.com/atlas/database
- **NEW:** Frontend does not yet call backend API endpoints. Dashboard pages need fetch() integration.
- **NEW:** Teammates must run `cd backend && npm install` after cloning.
