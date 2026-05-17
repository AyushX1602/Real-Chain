// ─────────────────────────────────────────────────────────────────────────────
// server.js — RealChain v2 Express Backend
//
// Provides REST API for:
//   - Cached property data (faster than on-chain reads)
//   - Transaction history logging
//   - User profiles and analytics
//   - Blockchain data sync service
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config({ path: "../.env" });

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ── Routes ───────────────────────────────────────────────────────────────────
const { requireDb } = require("./middleware/db");
app.use("/api/properties", requireDb, require("./routes/properties"));
app.use("/api/transactions", requireDb, require("./routes/transactions"));
app.use("/api/users", requireDb, require("./routes/users"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// ── MongoDB Connection ───────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/realchain";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log(`✅ MongoDB connected: ${MONGODB_URI}`))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    console.log("⚠️  Backend will run without database. Some features unavailable.");
  });

// ── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.BACKEND_PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 RealChain backend running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});
