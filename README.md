# RealChain v2 — Tokenized Real Estate Investment Platform

> Blockchain-based prototype for fractional real estate ownership, USDC-based rental distribution, and secondary market trading. Built for academic research on smart contract security and gas scalability.

## Architecture

```
real-estate-platform/
├── contracts/
│   ├── MockUSDC.sol                  # Simulated stablecoin (6 decimals)
│   ├── PropertyToken.sol             # ERC-20Votes — 100 tokens = 100% ownership
│   ├── PropertyFactory.sol           # Registry: optional V1/V2 distribution mode per property
│   ├── RentalDistribution.sol        # USDC epoch-based pull dividends (snapshot-safe)
│   ├── RentalDistributionV2.sol      # USDC cumulative-index model (O(1) claims)
│   ├── RentalDistributionV2Deployer.sol # Helper to keep factory below EVM code-size limit
│   ├── Marketplace.sol               # USDC fixed-price primary + secondary market
│   └── BrokenRentalDistribution.sol  # [RESEARCH] Vulnerable baseline for comparison
├── scripts/
│   ├── deploy.js                     # Deploy MockUSDC + Factory + 2 sample properties
│   └── simulate.js                   # Full end-to-end demo (buy → rent → claim → trade)
├── test/
│   ├── RealEstatePlatform.test.js    # 17 core tests (USDC + snapshot correctness)
│   ├── SnapshotAttack.test.js        # 5 security tests (attack demo + defence proof)
│   └── GasBenchmark.test.js          # 3 benchmark tests (gas tables for research paper)
│   ├── DistributionV2.test.js        # 3 property proofs (security, fairness, accounting)
│   ├── FactoryDistributionMode.test.js # 2 tests (V1 default + optional V2 mode)
│   └── V1VsV2Benchmark.test.js       # Side-by-side V1 vs V2 gas/scalability tables
└── frontend/                         # React + Vite + ethers.js v6
    └── src/
        ├── config/contracts.js       # ← Paste deployed addresses here
        ├── context/Web3Context.jsx   # Read-only + MetaMask provider
        └── pages/                    # Home, Property, Portfolio, Dividends
```

## Smart Contracts

| Contract | Purpose |
|---|---|
| `MockUSDC` | Mintable 6-decimal stablecoin for local/testnet use |
| `PropertyToken` | ERC-20Votes token. 100 PROP = 100% property. Auto-delegates for checkpointing. |
| `PropertyFactory` | Deploys Token + Distribution(V1/V2) + Marketplace per property. On-chain registry. |
| `RentalDistribution` | Owner deposits USDC as rent. Holders claim proportional share using **historical balance at deposit time** (snapshot-safe). |
| `RentalDistributionV2` | Owner deposits USDC into cumulative index. Holders claim in **O(1)** regardless of epoch count. |
| `Marketplace` | Buy from owner (primary) or list/buy from holders (secondary). All prices in USDC. |
| `BrokenRentalDistribution` | **Research baseline only.** Uses live balance — vulnerable to snapshot timing attack. |

---

## Local Setup (Recommended)

### Prerequisites
- Node.js ≥ 18
- MetaMask browser extension

### 1. Install dependencies
```bash
npm install
```

### 2. Start the local Hardhat node (Terminal 1)
```bash
.\node_modules\.bin\hardhat node
```
This gives you 20 funded test accounts and prints their private keys.

### 3. Deploy contracts (Terminal 2)
```bash
.\node_modules\.bin\hardhat run scripts/deploy.js --network localhost
```
Optional mode switch:
```bash
$env:DISTRIBUTION_MODE="v2"; .\node_modules\.bin\hardhat run scripts/deploy.js --network localhost
```
Use `v1` (default) or `v2`.

Copy the printed `MockUSDC` and `Factory` addresses.

### 4. Update frontend config
Edit `frontend/src/config/contracts.js`:
```js
export const NETWORK_CHAIN_ID = 31337; // Hardhat local

export const CONTRACT_ADDRESSES = {
  mockUsdc:        "0x...",  // paste MockUSDC address
  propertyFactory: "0x...",  // paste Factory address
};
```

### 5. Configure MetaMask
- Add network manually:
  - Network Name: `Hardhat Local`
  - RPC URL: `http://127.0.0.1:8545`
  - Chain ID: `31337`
  - Currency: `ETH`
- Import a test account using one of the private keys printed by `hardhat node`

### 6. Start the frontend (Terminal 3)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

> **Properties appear without MetaMask.** Connect MetaMask only when you want to buy/claim/list.

---

## Sepolia Testnet Deployment

### 1. Configure environment
```bash
cp .env.example .env
```
Edit `.env` with your Alchemy key and wallet private key.

### 2. Get Sepolia ETH
- Faucet: [sepoliafaucet.com](https://sepoliafaucet.com)
- You also need Sepolia ETH for gas fees.

### 3. Deploy
```bash
.\node_modules\.bin\hardhat run scripts/deploy.js --network sepolia
```

### 4. Verify on Etherscan (optional)
```bash
.\node_modules\.bin\hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### 5. Update frontend
```js
// frontend/src/config/contracts.js
export const NETWORK_CHAIN_ID = 11155111; // Sepolia
export const LOCAL_RPC_URL = "https://rpc.sepolia.org"; // or Alchemy URL
export const CONTRACT_ADDRESSES = {
  mockUsdc:        "0x...",
  propertyFactory: "0x...",
};
```

---

## Running Tests

```bash
# All tests
.\node_modules\.bin\hardhat test

# Core functionality (17 tests)
.\node_modules\.bin\hardhat test test/RealEstatePlatform.test.js

# Security: Snapshot timing attack demo (5 tests)
.\node_modules\.bin\hardhat test test/SnapshotAttack.test.js

# Gas benchmark — produces research paper tables (3 tests)
.\node_modules\.bin\hardhat test test/GasBenchmark.test.js

# V2 security/fairness/accounting proofs
.\node_modules\.bin\hardhat test test/DistributionV2.test.js

# Factory mode switch (default V1 + optional V2)
.\node_modules\.bin\hardhat test test/FactoryDistributionMode.test.js

# V1 vs V2 benchmark tables
.\node_modules\.bin\hardhat test test/V1VsV2Benchmark.test.js
```

Expected output: **31 passing**

---

## Research Findings

### Security: Snapshot Timing Attack

The `BrokenRentalDistribution` contract calculates dividends using the **live** token balance at claim time. This allows:

1. **Attacker buys tokens AFTER rent deposit** → claims dividends they never earned
2. **Legitimate holder sells BEFORE claiming** → loses earned dividends

`RentalDistribution` fixes this using `ERC20Votes.getPastVotes(user, depositTimestamp - 1)`.

| Actor | BrokenRD (vulnerable) | FixedRD (patched) |
|---|---|---|
| Alice (held 30 tokens at deposit, sold after) | **0 USDC ← robbed** | 300 USDC ✓ |
| Carol (held 0 tokens at deposit, bought after) | **300 USDC ← stolen** | 0 USDC ✓ |

### Scalability: Gas Cost Analysis

`claimAll()` gas formula (1 investor):
```
Gas = 85,503 + (epochs − 1) × 42,858
USD ≈ $3.42 + (epochs − 1) × $1.71   [at 20 gwei, ETH=$2000]
```

| Epochs | Gas Used | Est. Cost |
|---|---|---|
| 1 | 85,503 | $3.42 |
| 6 | 243,483 | $9.74 |
| 12 | 433,060 | $17.32 |
| 24 | 812,216 | $32.49 |
| 48 | 1,570,535 | $62.82 |

**Creating a property** costs ~$156 (deploys 3 contracts). This is a known bottleneck — ERC-1155 is the proposed mitigation at scale.

### V1 vs V2 Selection Guide (Research-Ready)

Use this decision rule from benchmarked gas constants:

```
Choose V2 if:
N_claims * (V1_claim_gas(E) - V2_claim_gas)
  > N_deposits * 30,546 + N_transfers * 47,607
```

Where:
- `E` = expected epochs accumulated between claims
- `V1_claim_gas(E) ~= 102,625 + (E - 1) * 42,880`
- `V2_claim_gas ~= 137,616`
- `30,546` = V2 extra gas per deposit vs V1
- `47,607` = V2 extra gas per transfer (hook overhead)

Practical interpretation:
- Pick **V1** for low-epoch, transfer-heavy properties (frequent trading, frequent claims).
- Pick **V2** when claims usually span multiple epochs (roughly `E >= 2-3`) or when supporting smaller investors over long horizons.

---

## Contract Design Notes

- **Pull-based distribution**: No push loops → O(1) per deposit, O(n_epochs) per claim
- **ERC20Votes checkpointing**: `getPastVotes(user, snapshotTime)` for historical balances
- **USDC settlement**: Stable-value rent deposits allow epoch-to-epoch yield comparison
- **ReentrancyGuard**: All state-changing marketplace and distribution functions
- **CEI pattern enforced**: State updated before all external calls

## Constraints (Prototype)
- No KYC / AML
- MockUSDC is not real USDC — for testnet use only
- Fixed 100-token supply (ERC-1155 proposed for production scale)
- No production security audit
