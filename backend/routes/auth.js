const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const router = express.Router();
const { issueNonce } = require("../middleware/siwe");
const AuthUser = require("../models/AuthUser");

const JWT_ALG = "HS256";
const JWT_TTL_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_MIN_LENGTH = 6;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = new Set(["owner", "tenant"]);

function getJwtSecret() {
  return process.env.JWT_SECRET || "realchain-dev-jwt-secret-change-me";
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlJson(obj) {
  return base64url(JSON.stringify(obj));
}

function signJwt(payload) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: JWT_ALG, typ: "JWT" };
  const body = {
    ...payload,
    iat: now,
    exp: now + JWT_TTL_SECONDS,
  };
  const unsigned = `${base64urlJson(header)}.${base64urlJson(body)}`;
  const sig = crypto
    .createHmac("sha256", getJwtSecret())
    .update(unsigned)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${unsigned}.${sig}`;
}

function decodeBase64url(raw) {
  const normalized = String(raw).replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 ? "=".repeat(4 - (normalized.length % 4)) : "";
  return Buffer.from(normalized + pad, "base64").toString("utf8");
}

function verifyJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const [headerRaw, payloadRaw, sig] = parts;
  const unsigned = `${headerRaw}.${payloadRaw}`;
  const expected = crypto
    .createHmac("sha256", getJwtSecret())
    .update(unsigned)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid token signature");
  }

  const header = JSON.parse(decodeBase64url(headerRaw));
  if (header.alg !== JWT_ALG) throw new Error("Unsupported token algorithm");

  const payload = JSON.parse(decodeBase64url(payloadRaw));
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) throw new Error("Token expired");
  return payload;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function publicUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function authResponse(user) {
  const clean = publicUser(user);
  return {
    user: clean,
    token: signJwt({ sub: clean.id, email: clean.email, role: clean.role }),
    expiresIn: JWT_TTL_SECONDS,
  };
}

function requireDbReady(res) {
  if (mongoose.connection.readyState === 1) return true;
  res.status(503).json({
    error: "Database not connected",
    hint: "Start MongoDB or set MONGODB_URI before using email login.",
  });
  return false;
}

async function requireJwt(req, res, next) {
  try {
    const raw = req.header("authorization") || "";
    const token = raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
    if (!token) return res.status(401).json({ error: "Missing bearer token" });
    req.auth = verifyJwt(token);
    return next();
  } catch (err) {
    return res.status(401).json({ error: err.message || "Invalid token" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/auth/nonce — issue a single-use nonce for SIWE-style request signing.
// Frontend signs the message "RealChain SIWE: <nonce>" with the connected
// wallet, then includes the signature in subsequent protected requests.
// ─────────────────────────────────────────────────────────────────────────────

router.get("/nonce", async (req, res) => {
  try {
    const wallet = (req.query.wallet || "").toString();
    const out = await issueNonce(wallet);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message || "nonce issue failed" });
  }
});

router.post("/signup", async (req, res) => {
  if (!requireDbReady(res)) return;

  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "").trim().toLowerCase();

    if (!EMAIL_RX.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
    }
    if (!ROLES.has(role)) {
      return res.status(400).json({ error: "Role must be owner or tenant" });
    }

    const existing = await AuthUser.findOne({ email });
    if (existing) return res.status(409).json({ error: "Email is already registered" });

    const user = await AuthUser.create({
      email,
      role,
      passwordHash: hashPassword(password),
      lastLoginAt: new Date(),
    });

    return res.status(201).json(authResponse(user));
  } catch (err) {
    return res.status(500).json({ error: err.message || "Signup failed" });
  }
});

router.post("/login", async (req, res) => {
  if (!requireDbReady(res)) return;

  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!EMAIL_RX.test(email) || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await AuthUser.findOne({ email });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    user.lastLoginAt = new Date();
    await user.save();

    return res.json(authResponse(user));
  } catch (err) {
    return res.status(500).json({ error: err.message || "Login failed" });
  }
});

router.get("/me", requireJwt, async (req, res) => {
  if (!requireDbReady(res)) return;

  try {
    const user = await AuthUser.findById(req.auth.sub);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Profile lookup failed" });
  }
});

module.exports = router;
