const mongoose = require("mongoose");

const AuthUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["owner", "tenant"],
    required: true,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

AuthUserSchema.index({ role: 1 });

module.exports = mongoose.model("AuthUser", AuthUserSchema);
