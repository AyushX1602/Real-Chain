const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// IndexerCheckpoint — one row per (chainId, contractAddress, eventName).
// Records the last block we've finished scanning so the indexer can resume
// after a restart without rescanning the entire log history.
// ─────────────────────────────────────────────────────────────────────────────

const IndexerCheckpointSchema = new mongoose.Schema({
  chainId:         { type: Number, required: true },
  contractAddress: { type: String, required: true, lowercase: true },
  eventName:       { type: String, required: true },
  lastBlock:       { type: Number, required: true, default: 0 },
}, {
  timestamps: true,
});

IndexerCheckpointSchema.index(
  { chainId: 1, contractAddress: 1, eventName: 1 },
  { unique: true }
);

module.exports = mongoose.model("IndexerCheckpoint", IndexerCheckpointSchema);
