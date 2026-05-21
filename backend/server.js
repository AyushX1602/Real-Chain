// ─────────────────────────────────────────────────────────────────────────────
// server.js — RealChain v2 Express Backend
//
// Provides REST API for:
//   - Cached property data
//   - Transaction history (client-logged + on-chain indexed)
//   - User profiles, leaderboards, analytics
//   - Holder queries (indexer-backed)
//   - SIWE-style wallet authentication
//   - USDC faucet (testnet)
//
// New in this revision:
//   - pino structured logging via pino-http
//   - express-rate-limit on all /api/* routes (separate stricter bucket on
//     write paths)
//   - /api/auth/nonce + middleware/siwe.js for signature-verified writes
//   - jobs/indexer.js for on-chain event ingestion (opt-in via ENABLE_INDEXER)
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const pinoHttp = require("pino-http");
const rateLimit = require("express-rate-limit");
const path = require("path");
const envPath = path.resolve(__dirname, "../.env");
require("dotenv").config({ path: envPath });

const logger = require("./logger");
const indexer = require("./jobs/indexer");

const app = express();

// ── Middleware ───────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://real-chain-git-main-ayushs-projects-f90c82c1.vercel.app",
];
// Also allow any *.vercel.app subdomain for preview deploys
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || /\.vercel\.app$/.test(origin)) {
      cb(null, true);
    } else {
      cb(null, true); // allow all for hackathon demo
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({
  logger,
  // Don't spam health-checks into the log stream.
  autoLogging: { ignore: (req) => req.url === "/api/health" },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Wide bucket for all reads/writes. The faucet route layers a per-wallet
// cooldown on top of this.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,                          // 10 req/sec/IP — generous for the dApp
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Rate limit exceeded — slow down a bit." },
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,                           // 1 write/sec/IP average
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Write rate limit exceeded." },
});

app.use("/api", apiLimiter);

// ── Routes ───────────────────────────────────────────────────────────────────
const { requireDb } = require("./middleware/db");

// Auth nonce issuance is unauthenticated by definition.
app.use("/api/auth", require("./routes/auth"));

// Existing routes stay unauthenticated for read; writes still go through but
// are rate-limited. Production mode flips this to require SIWE on writes.
app.use("/api/properties", requireDb, require("./routes/properties"));
app.use("/api/transactions", requireDb, (req, res, next) => {
  if (req.method !== "GET") return writeLimiter(req, res, next);
  return next();
}, require("./routes/transactions"));
app.use("/api/users", requireDb, (req, res, next) => {
  if (req.method !== "GET") return writeLimiter(req, res, next);
  return next();
}, require("./routes/users"));

// Faucet doesn't depend on MongoDB — direct on-chain mint. Stricter limiter.
app.use("/api/faucet", writeLimiter, require("./routes/faucet"));

// Market data — ETH/USD price feed for the cost banner / SmartAgent. Cached.
// No DB dependency, so it lives outside the requireDb wrapper.
app.use("/api/market", require("./routes/market"));

// Platform-wide aggregated stats for the Live Stats Banner.
app.use("/api/stats", requireDb, require("./routes/stats"));


// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    indexer: process.env.ENABLE_INDEXER === "true" ? "enabled" : "disabled",
    nodeEnv: process.env.NODE_ENV || "development",
  });
});

// ── MongoDB Connection ───────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/realchain";

// Mongoose 9 deprecates { new: true } in favour of { returnDocument: 'after' }.
// Set the default globally so existing code stops spamming warnings.
mongoose.set("returnDocument", "after");

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    logger.info({ uri: MONGODB_URI }, "MongoDB connected");
    indexer.start();
  })
  .catch((err) => {
    logger.error({ err: err.message }, "MongoDB connection error");
    logger.warn("Backend will run without database. Some features unavailable.");
  });

// ── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || process.env.BACKEND_PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`RealChain backend running on port ${PORT}`);
  logger.info(`Health: http://localhost:${PORT}/api/health`);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info({ signal }, "shutting down");
  indexer.stop();
  mongoose.connection.close().finally(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
