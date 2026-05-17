const mongoose = require("mongoose");

const PropertySchema = new mongoose.Schema({
  propertyId:         { type: Number, required: true, unique: true },
  name:               { type: String, required: true },
  location:           { type: String, required: true },
  totalValue:         { type: Number, default: 0 },
  tokenAddress:       { type: String, required: true },
  rentalAddress:      { type: String, required: true },
  marketAddress:      { type: String, required: true },
  owner:              { type: String, required: true },  // wallet address
  totalSupply:        { type: Number, default: 100 },
  availableSupply:    { type: Number, default: 100 },
  epochCount:         { type: Number, default: 0 },
  totalRentDeposited: { type: Number, default: 0 },      // USDC in 6 decimals
  useV2:              { type: Boolean, default: false },
  chainId:            { type: Number, default: 84532 },   // Base Sepolia
}, {
  timestamps: true,
});

module.exports = mongoose.model("Property", PropertySchema);
