const mongoose = require("mongoose");

/**
 * Middleware that checks if MongoDB is connected.
 * If not, returns an appropriate response instead of crashing.
 * GET requests return empty arrays; POST/PUT return 503.
 */
function requireDb(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    if (req.method === "GET") {
      // For reads, return empty results gracefully
      return res.json([]);
    }
    return res.status(503).json({
      error: "Database not connected",
      hint: "Start MongoDB or set MONGODB_URI in .env to a MongoDB Atlas connection string",
    });
  }
  next();
}

module.exports = { requireDb };
