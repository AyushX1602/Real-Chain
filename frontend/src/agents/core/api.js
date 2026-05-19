// ─────────────────────────────────────────────────────────────────────────────
// api.js — Shared HTTP helper for agents.
//
// Provides the timeout + JSON parsing semantics required by the screen-
// enhancements requirements (10 s default for property routes, 5 s for
// holders, etc.). Agents import this rather than calling `fetch` directly so
// timeout policy is enforced uniformly.
// ─────────────────────────────────────────────────────────────────────────────

import { BACKEND_URL } from "../../config/contracts";

const DEFAULT_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status ?? 0;
    if (cause) this.cause = cause;
  }
}

export class TimeoutError extends ApiError {
  constructor(timeoutMs) {
    super(`Request exceeded ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.status = 0;
  }
}

export async function getJson(path, { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const url = path.startsWith("http") ? path : `${BACKEND_URL}${path}`;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(new TimeoutError(timeoutMs)), timeoutMs);

  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new ApiError(`GET ${path} → ${r.status}`, { status: r.status, cause: text });
    }
    return await r.json();
  } catch (err) {
    if (err?.name === "AbortError") {
      // The abort came from our timeout (ctrl.abort(new TimeoutError(...)))
      // or from the caller. Surface a TimeoutError when it was ours.
      if (ctrl.signal.reason instanceof TimeoutError) throw ctrl.signal.reason;
      throw new ApiError("Request aborted", { status: 0, cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

export async function postJson(path, body, { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const url = path.startsWith("http") ? path : `${BACKEND_URL}${path}`;
  const ctrl = new AbortController();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(new TimeoutError(timeoutMs)), timeoutMs);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new ApiError(`POST ${path} → ${r.status}`, { status: r.status, cause: text });
    }
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// Exponential-backoff retry. Used by the indexer-fallback path defined in
// requirement R7 §12 (3 attempts, exponential backoff, then fall back).
export async function withRetry(fn, { attempts = 3, baseMs = 400, factor = 2, signal } = {}) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    if (signal?.aborted) throw new ApiError("Aborted", { status: 0 });
    try { return await fn(i); }
    catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      const delay = baseMs * (factor ** i);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastErr;
}
