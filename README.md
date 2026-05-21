<div align="center">

# 🏢 RealChain

### Tokenized Real Estate · Zero-ETH Claims · Gasless on Base Sepolia

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://real-chain-git-main-ayushs-projects-f90c82c1.vercel.app)
[![Network](https://img.shields.io/badge/Network-Base_Sepolia-0052FF?style=for-the-badge&logo=ethereum)](https://sepolia.basescan.org)
[![License](https://img.shields.io/badge/License-Apache_2.0-green?style=for-the-badge)](LICENSE)

**Buy fractional property tokens · Earn USDC rent every epoch · Claim with zero ETH**

Gas is paid in Mock USD via the **Universal Gas Framework (UGF)** — no native ETH required.

Built by **TEAM SPIRIT**

</div>

---

## 🎯 The Problem

Traditional real estate requires **full property purchase**, is **illiquid** (can't sell a fraction), and rent collection is **manual and opaque**. Blockchain tokenization solves these — but introduces a **new barrier**: every transaction requires ETH for gas, shutting out users who only hold stablecoins.

**RealChain eliminates both barriers** — fractional ownership AND gasless transactions.

---

## 💡 How It Works

1. **Owner tokenises a property** → PropertyFactory deploys PropertyToken (100 ERC-20Votes), RentalDistribution, and Marketplace in one atomic transaction.
2. **Investors buy tokens with USDC** → Primary market (from owner) or secondary market (peer-to-peer).
3. **Owner deposits monthly rent** → Contract snapshots every holder's balance at `block.timestamp - 1` (prevents post-deposit theft).
4. **Investors claim their share** → `claimAll()` uses `ERC20Votes.getPastVotes()` to calculate the exact pro-rata amount.
5. **Gas paid in Mock USD** → Every transaction routes through UGF. No ETH needed in the wallet.
6. **Trade anytime** → List tokens on the secondary marketplace at any price.

---

## 🏗️ Architecture

```
Frontend (React 18 + Vite)
    ├── Landing page with video hero
    ├── Marketplace (browse + buy)
    ├── Owner Control Room (deposit rent, manage properties)
    ├── Investor Dashboard (portfolio, claim rent)
    ├── Activity feed (real-time on-chain events)
    ├── Analytics (KPIs, charts, leaderboard)
    ├── Multi-agent orchestrator (per-screen agents)
    └── Dark mode + theme system

Smart Contracts (Solidity 0.8.28 on Base Sepolia)
    ├── MockUSDC (6-decimal stablecoin)
    ├── PropertyFactory (deploys 3 contracts per property)
    ├── PropertyToken (ERC-20Votes, auto-delegation)
    ├── RentalDistribution V1 (epoch-loop, O(n) gas)
    ├── RentalDistribution V2 (accumulator, O(1) gas)
    └── Marketplace (primary + secondary trading)

Backend (Express + MongoDB)
    ├── REST API (properties, transactions, users, analytics)
    ├── On-chain indexer (12s polling, event-driven)
    ├── ETH/USD price feed (Coingecko cached)
    ├── SIWE authentication
    └── Rate limiting + structured logging

Universal Gas Framework
    └── Gasless relay — settles gas in TYI_MOCK_USD
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MetaMask browser extension
- MongoDB (local or Atlas)

### Option A — Local Hardhat (offline development)

```bash
# Install dependencies
npm install
cd frontend && npm install --legacy-peer-deps && cd ..
cd backend && npm install && cd ..

# Terminal 1 — Start local blockchain
npx hardhat node

# Terminal 2 — Deploy + seed
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/mintUsdc.js --network localhost
npx hardhat run scripts/seedDemo.js --network localhost

# Terminal 3 — Backend
cd backend && node server.js

# Terminal 4 — Frontend
cd frontend && npm run dev
```

Open http://localhost:3000. Add Hardhat Local to MetaMask (Chain ID: 31337, RPC: http://127.0.0.1:8545).

### Option B — Base Sepolia (live testnet)

Contracts are already deployed. Just start the backend + frontend:

```bash
# Terminal 1 — Backend
cd backend && node server.js

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open http://localhost:3000. Switch MetaMask to Base Sepolia (Chain ID: 84532).

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `PRIVATE_KEY` | Deployer wallet private key |
| `BASE_SEPOLIA_RPC_URL` | Alchemy/Infura RPC URL |
| `VITE_MOCK_USDC_ADDRESS` | Deployed MockUSDC address |
| `VITE_PROPERTY_FACTORY_ADDRESS` | Deployed PropertyFactory address |
| `VITE_NETWORK_MODE` | `local` or `baseSepolia` |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `ENABLE_INDEXER` | `true` to enable on-chain event indexer |

---

## 🧪 Testing

```bash
# Run all 31 smart contract tests
npx hardhat test

# Key test suites:
# - RealEstatePlatform.test.js  (17 tests — full platform lifecycle)
# - SnapshotAttack.test.js      (5 tests — security proof)
# - GasBenchmark.test.js        (3 tests — gas measurements)
# - DistributionV2.test.js      (3 tests — V2 invariants)
# - FactoryDistributionMode.test.js (2 tests — V1/V2 factory flag)
# - V1VsV2Benchmark.test.js    (1 test — side-by-side comparison)
```

---

## 🔒 Security Innovation

**The snapshot attack problem:**
Naive dividend contracts use `balanceOf(user)` at claim time. An attacker can buy tokens *after* rent is deposited and steal a share they never earned.

**RealChain's fix:**
- Record `block.timestamp - 1` as `snapshotTime` when rent is deposited
- Use `ERC20Votes.getPastVotes(user, snapshotTime)` instead of `balanceOf()`
- Attacker held 0 tokens at snapshot → gets 0 USDC
- Proven in `test/SnapshotAttack.test.js`

---

## ⚡ Key Features

| Feature | Description |
|---|---|
| Fractional ownership | Buy from 1 token — own a slice of any property |
| USDC rent distribution | Automated epoch-based, snapshot-secured |
| Zero-ETH gasless | UGF wraps every tx — gas in Mock USD |
| Secondary marketplace | Peer-to-peer token trading |
| Multi-agent system | Per-screen agents with hub-and-spoke orchestrator |
| Smart Agent | Heuristic gas optimizer + optional local LLM |
| On-chain indexer | 12s polling, MongoDB-backed analytics |
| Dark mode | Full theme system with token-based design |
| Role-based dashboards | Owner control room + investor portfolio |
| Live activity feed | Real-time transaction stream |
| Auth system | Email/password + wallet signature (SIWE) |
| PWA support | Installable, offline-capable shell |

---

## 📁 Project Structure

```
Real-Chain/
├── contracts/          # Solidity smart contracts
├── test/               # Hardhat test suites (31 tests)
├── scripts/            # Deploy, mint, seed scripts
├── frontend/
│   ├── src/
│   │   ├── agents/     # Multi-agent orchestrator system
│   │   ├── components/ # Shared UI components
│   │   ├── context/    # React contexts (Web3, UGF, Theme, Auth)
│   │   ├── hooks/      # Custom hooks
│   │   ├── pages/      # Route pages
│   │   └── config/     # Contract addresses + ABIs
│   └── public/         # Static assets (video, icons, SW)
├── backend/
│   ├── routes/         # Express API routes
│   ├── models/         # Mongoose schemas
│   ├── middleware/     # Auth, DB gate
│   └── jobs/           # On-chain indexer
├── .env                # Environment variables (gitignored)
├── hardhat.config.js   # Hardhat configuration
└── deployed-addresses.json  # Contract addresses (auto-generated)
```

---

## 🌐 Deployed Contracts (Base Sepolia)

| Contract | Address |
|---|---|
| MockUSDC | `0xc90610277191F7Dbe7Ddf18319Bd28D3aAAe9a38` |
| PropertyFactory | `0xa8bb0D4923C1aBB9294cBc115c6FF81B2DaC0168` |

---

## 📜 License

[Apache 2.0](LICENSE)

---

<div align="center">

**Built with ❤️ by TEAM SPIRIT**

[Live Demo](https://real-chain-git-main-ayushs-projects-f90c82c1.vercel.app) · [Base Sepolia Explorer](https://sepolia.basescan.org)

</div>
