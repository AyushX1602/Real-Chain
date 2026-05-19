// ─────────────────────────────────────────────────────────────────────────────
// indexer.js — periodic chain-event scanner.
//
// Scans the relevant log topics from each property's contract trio, persists
// authoritative records into Mongo, and replaces the unauthenticated client
// POST flow for analytics. Runs as a setInterval inside the same Node process
// as the API server (fine for our scale; spin out into a worker dyno later).
//
// Runs every 12 seconds when ENABLE_INDEXER=true and Mongo is connected.
//
// Indexed events:
//   PropertyFactory.PropertyCreated       → Property row
//   PropertyToken.Transfer                → Holding rows + transfer count
//   RentalDistribution.RentalDeposited    → Transaction(type=deposit)
//   RentalDistribution.AllDividendsClaimed→ Transaction(type=claim)
//   Marketplace.TokensBought              → Transaction(type=buy)
//   Marketplace.ListingCreated            → Transaction(type=listing)
//   Marketplace.ListingCancelled          → Transaction(type=cancel)
//
// Checkpointing is per (chainId, contractAddress, eventName) so any single
// event can be re-indexed independently without losing the others.
// ─────────────────────────────────────────────────────────────────────────────

const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");
const mongoose = require("mongoose");

const Property = require("../models/Property");
const Transaction = require("../models/Transaction");
const Holding = require("../models/Holding");
const IndexerCheckpoint = require("../models/IndexerCheckpoint");
const logger = require("../logger");

const POLL_MS = 12_000;
const CHUNK_BLOCKS = Number(process.env.INDEXER_CHUNK_BLOCKS) || 10; // tuned for Base Sepolia free-tier RPC (10-block cap); raise on paid RPC
const ZERO = ethers.ZeroAddress;

const ABI_FACTORY = [
  "event PropertyCreated(uint256 indexed propertyId,string name,address propertyToken,address rentalDistribution,address marketplace,address owner)",
  "function getPropertiesCount() view returns (uint256)",
  "function properties(uint256) view returns (string name,string location,uint256 valueInr,address propertyToken,address rentalDistribution,address marketplace,address owner)",
];
const ABI_TOKEN = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];
const ABI_RENTAL = [
  "event RentalDeposited(uint256 indexed epochIndex,uint256 amount,uint256 timestamp)",
  "event AllDividendsClaimed(address indexed user,uint256 totalAmount,uint256 epochCount)",
  "function epochCount() view returns (uint256)",
];
const ABI_MARKET = [
  "event TokensBought(address indexed buyer,address indexed seller,uint256 tokenAmount,uint256 usdcCost)",
  "event ListingCreated(uint256 indexed listingId,address indexed seller,uint256 amount,uint256 pricePerToken)",
  "event ListingCancelled(uint256 indexed listingId,address indexed seller)",
  "function pricePerToken() view returns (uint256)",
];

function loadDeployedAddresses() {
  const p = path.resolve(__dirname, "../../deployed-addresses.json");
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { logger.warn({ err: e.message }, "indexer: deployed-addresses parse failed"); return null; }
}

function getProvider() {
  const url = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  return new ethers.JsonRpcProvider(url);
}

async function getCheckpoint(chainId, addr, event) {
  const row = await IndexerCheckpoint.findOne({
    chainId, contractAddress: addr.toLowerCase(), eventName: event,
  });
  return row?.lastBlock ?? 0;
}
async function setCheckpoint(chainId, addr, event, block) {
  await IndexerCheckpoint.findOneAndUpdate(
    { chainId, contractAddress: addr.toLowerCase(), eventName: event },
    { lastBlock: block },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// Generic chunked log scanner. Calls `handler(log)` for every event found,
// persists the new checkpoint after each chunk so a crash mid-scan resumes
// from the last successful chunk rather than the start.
async function scanLogs(provider, contract, eventName, fromBlock, latest, handler, ctx) {
  let cursor = fromBlock;
  while (cursor <= latest) {
    const to = Math.min(cursor + CHUNK_BLOCKS - 1, latest);
    let logs = [];
    try {
      logs = await contract.queryFilter(eventName, cursor, to);
    } catch (e) {
      logger.warn({ event: eventName, range: [cursor, to], err: e.message }, "indexer: queryFilter failed; retry next tick");
      return; // bail out; next tick will retry the same range
    }
    for (const log of logs) {
      try { await handler(log, ctx); }
      catch (e) { logger.warn({ event: eventName, txHash: log.transactionHash, err: e.message }, "indexer: handler failed"); }
    }
    await setCheckpoint(ctx.chainId, contract.target, eventName, to);
    cursor = to + 1;
  }
}

async function upsertTransfer(log, ctx) {
  const { propertyId } = ctx;
  const from = log.args.from.toLowerCase();
  const to   = log.args.to.toLowerCase();
  const val  = BigInt(log.args.value);

  // Mints (from = 0) credit only `to`. Burns (to = 0) debit only `from`.
  if (from !== ZERO) {
    const cur = await Holding.findOne({ propertyId, wallet: from });
    const next = (BigInt(cur?.balance || "0") - val).toString();
    await Holding.findOneAndUpdate(
      { propertyId, wallet: from },
      { balance: next, chainId: ctx.chainId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  if (to !== ZERO) {
    const cur = await Holding.findOne({ propertyId, wallet: to });
    const next = (BigInt(cur?.balance || "0") + val).toString();
    await Holding.findOneAndUpdate(
      { propertyId, wallet: to },
      { balance: next, chainId: ctx.chainId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

async function upsertTransaction(doc) {
  // Idempotent on txHash because of the unique index — duplicate inserts
  // are silently ignored, which lets the indexer be restarted at will.
  try { await Transaction.create(doc); }
  catch (e) {
    if (e.code === 11000) return; // duplicate key — already indexed
    throw e;
  }
}

async function indexFactory(provider, factoryAddr, chainId) {
  const factory = new ethers.Contract(factoryAddr, ABI_FACTORY, provider);
  const latest = await provider.getBlockNumber();
  const from = await getCheckpoint(chainId, factoryAddr, "PropertyCreated");
  await scanLogs(provider, factory, "PropertyCreated", from, latest, async (log) => {
    const { propertyId, name, propertyToken, rentalDistribution, marketplace, owner } = log.args;
    let location = "";
    let valueInr = 0;
    try {
      const p = await factory.properties(propertyId);
      location = p.location;
      valueInr = Number(p.valueInr);
    } catch { /* tolerate read failure; metadata can be filled by /sync later */ }
    await Property.findOneAndUpdate(
      { propertyId: Number(propertyId) },
      {
        propertyId: Number(propertyId),
        name,
        location,
        totalValue: valueInr,
        tokenAddress: propertyToken,
        rentalAddress: rentalDistribution,
        marketAddress: marketplace,
        owner: owner.toLowerCase(),
        chainId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }, { chainId });
}

async function indexProperty(provider, doc, chainId) {
  const ctx = { chainId, propertyId: doc.propertyId };
  const token = new ethers.Contract(doc.tokenAddress, ABI_TOKEN, provider);
  const rental = new ethers.Contract(doc.rentalAddress, ABI_RENTAL, provider);
  const market = new ethers.Contract(doc.marketAddress, ABI_MARKET, provider);
  const latest = await provider.getBlockNumber();

  // Holdings ─ Transfer events
  const fromT = await getCheckpoint(chainId, doc.tokenAddress, "Transfer");
  await scanLogs(provider, token, "Transfer", fromT, latest, upsertTransfer, ctx);

  // Rent deposits
  const fromD = await getCheckpoint(chainId, doc.rentalAddress, "RentalDeposited");
  await scanLogs(provider, rental, "RentalDeposited", fromD, latest, async (log) => {
    await upsertTransaction({
      txHash: log.transactionHash,
      type: "deposit",
      from: doc.owner,
      propertyId: doc.propertyId,
      amount: Number(log.args.amount) / 1e6,
      gasMethod: "eth", // unknown from on-chain alone; client log can override later
      status: "confirmed",
      chainId,
    });
  }, ctx);

  // Claims
  const fromC = await getCheckpoint(chainId, doc.rentalAddress, "AllDividendsClaimed");
  await scanLogs(provider, rental, "AllDividendsClaimed", fromC, latest, async (log) => {
    await upsertTransaction({
      txHash: log.transactionHash,
      type: "claim",
      from: log.args.user.toLowerCase(),
      propertyId: doc.propertyId,
      amount: Number(log.args.totalAmount) / 1e6,
      gasMethod: "eth",
      status: "confirmed",
      chainId,
    });
  }, ctx);

  // Marketplace events
  const fromB = await getCheckpoint(chainId, doc.marketAddress, "TokensBought");
  await scanLogs(provider, market, "TokensBought", fromB, latest, async (log) => {
    await upsertTransaction({
      txHash: log.transactionHash,
      type: "buy",
      from: log.args.buyer.toLowerCase(),
      propertyId: doc.propertyId,
      amount: Number(log.args.usdcCost) / 1e6,
      tokenAmount: Number(ethers.formatEther(log.args.tokenAmount)),
      gasMethod: "eth",
      status: "confirmed",
      chainId,
    });
  }, ctx);

  const fromL = await getCheckpoint(chainId, doc.marketAddress, "ListingCreated");
  await scanLogs(provider, market, "ListingCreated", fromL, latest, async (log) => {
    await upsertTransaction({
      txHash: log.transactionHash,
      type: "listing",
      from: log.args.seller.toLowerCase(),
      propertyId: doc.propertyId,
      amount: 0,
      tokenAmount: Number(ethers.formatEther(log.args.amount)),
      gasMethod: "eth",
      status: "confirmed",
      chainId,
    });
  }, ctx);

  const fromX = await getCheckpoint(chainId, doc.marketAddress, "ListingCancelled");
  await scanLogs(provider, market, "ListingCancelled", fromX, latest, async (log) => {
    await upsertTransaction({
      txHash: log.transactionHash,
      type: "cancel",
      from: log.args.seller.toLowerCase(),
      propertyId: doc.propertyId,
      amount: 0,
      gasMethod: "eth",
      status: "confirmed",
      chainId,
    });
  }, ctx);

  // ── Denormalised property snapshot ─────────────────────────────────────
  // Tokens-remaining + price-per-token are read live each tick so the
  // Marketplace card / Owner panel always render fresh values without the
  // frontend having to walk every contract.
  try {
    const [totalSupplyRaw, ownerBalanceRaw, pricePerTokenRaw] = await Promise.all([
      token.totalSupply(),
      token.balanceOf(doc.owner),
      market.pricePerToken().catch(() => 0n),
    ]);
    const totalSupply = Number(ethers.formatEther(totalSupplyRaw));
    const ownerSupply = Number(ethers.formatEther(ownerBalanceRaw));
    const tokensRemaining = Math.max(0, totalSupply - ownerSupply);
    const pricePerToken = Number(pricePerTokenRaw) / 1e6;

    // Pull rent aggregates from the rows we just persisted so cadence /
    // last-deposit projections come straight off the same source of truth
    // the Claim Rent / Owner screens already consume.
    const [recentDeposits, totalRentRow, epochCountVal] = await Promise.all([
      Transaction.find({ propertyId: doc.propertyId, type: "deposit" })
        .sort({ createdAt: -1 })
        .limit(12),
      Transaction.aggregate([
        { $match: { propertyId: doc.propertyId, type: "deposit" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      rental.epochCount().then((n) => Number(n)).catch(() => null),
    ]);

    let cadenceDays = null;
    let lastDepositAt = null;
    if (recentDeposits.length >= 1) {
      lastDepositAt = recentDeposits[0].createdAt;
    }
    if (recentDeposits.length >= 2) {
      const sorted = [...recentDeposits].sort((a, b) => a.createdAt - b.createdAt);
      const gaps = [];
      for (let k = 1; k < sorted.length; k++) {
        gaps.push((sorted[k].createdAt - sorted[k - 1].createdAt) / 86_400_000);
      }
      gaps.sort((a, b) => a - b);
      cadenceDays = Math.max(1, Math.round(gaps[Math.floor(gaps.length / 2)]));
    }

    await Property.findOneAndUpdate(
      { propertyId: doc.propertyId },
      {
        totalSupply,
        availableSupply: tokensRemaining,
        tokensRemaining,
        pricePerToken,
        epochCount: epochCountVal ?? doc.epochCount ?? 0,
        totalRentDeposited: totalRentRow[0]?.total || 0,
        lastDepositAt,
        cadenceDays,
      },
      { new: true }
    );
  } catch (err) {
    logger.debug({ propertyId: doc.propertyId, err: err.message }, "indexer: snapshot read failed");
  }
}

async function tick() {
  const addrs = loadDeployedAddresses();
  if (!addrs?.factory) {
    logger.debug("indexer: deployed-addresses.json missing factory; skipping tick");
    return;
  }
  const provider = getProvider();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  await indexFactory(provider, addrs.factory, chainId);

  const properties = await Property.find({ chainId });
  for (const p of properties) {
    // eslint-disable-next-line no-await-in-loop
    await indexProperty(provider, p, chainId);
  }
}

let timer = null;
function start() {
  if (timer) return;
  if (process.env.ENABLE_INDEXER !== "true") {
    logger.info("indexer: disabled (set ENABLE_INDEXER=true to enable)");
    return;
  }
  if (mongoose.connection.readyState !== 1) {
    logger.warn("indexer: Mongo not connected; will retry when DB comes up");
  }
  logger.info("indexer: starting (poll every " + (POLL_MS / 1000) + "s)");
  const loop = async () => {
    try {
      if (mongoose.connection.readyState === 1) await tick();
    } catch (e) {
      logger.error({ err: e.message }, "indexer: tick failed");
    } finally {
      timer = setTimeout(loop, POLL_MS);
    }
  };
  timer = setTimeout(loop, 1500); // small initial delay so the API binds first
}

function stop() {
  if (timer) { clearTimeout(timer); timer = null; }
}

module.exports = { start, stop, tick };
