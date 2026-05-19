// ─────────────────────────────────────────────────────────────────────────────
// ActivityAgent — owns the /activity screen AND the right-rail variant.
//
// Domain:  on-chain activity feed, filters, pagination, deep-linking.
// Reads:   GET /api/transactions
//
// The agent supports two modes:
//   mode "page"   — full page, infinite scroll, URL-synced filters
//   mode "rail"   — right-rail on /marketplace, polls every 8s, capped to 200 rows
//
// Other agents NEVER read activity rows directly. If they need activity
// awareness, they listen for TX_CONFIRMED on the bus. The agent itself emits
// TX_CONFIRMED when a new row enters the feed via polling.
// ─────────────────────────────────────────────────────────────────────────────

import BaseAgent from "../core/BaseAgent";
import { MSG, AGENT_IDS } from "../core/messageTypes";
import { getJson, ApiError } from "../core/api";

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;
const RAIL_POLL_MS = 8_000;
const RAIL_CAP = 200;
const PAGE_SIZE = 50;

export default class ActivityAgent extends BaseAgent {
  static id = AGENT_IDS.ACTIVITY;
  static routes = ["/activity", "/marketplace"]; // also active on /marketplace for the right rail

  getInitialState() {
    return {
      ready: false,
      loading: false,
      error: null,
      offline: false,
      mode: "rail",                       // "page" | "rail"
      rows: [],                           // newest first
      cursor: null,
      hasMore: false,
      filters: { action: "all", gasMethod: "all", property: null, wallet: "" },
      filterError: null,
      consecutiveFailures: 0,
    };
  }

  async onActivate(payload) {
    const route = (payload && payload.route) || this.shared.route;
    const mode = route === "/activity" ? "page" : "rail";
    this.setState({ mode, loading: true, error: null });
    await this._fetchInitial();
    if (mode === "rail") this._startPolling();
  }

  async onDeactivate() {
    this._stopPolling();
  }

  async onEvent(env) {
    if (env.type === MSG.REQUEST_REFRESH) await this._fetchInitial();
  }

  // ── Public commands ─────────────────────────────────────────────────────
  setFilter(patch) {
    const next = { ...this._state.filters, ...patch };
    if (typeof next.wallet === "string" && next.wallet && !ADDR_RX.test(next.wallet)) {
      this.setState({ filters: next, filterError: "Wallet must be 0x followed by 40 hex characters" });
      return;
    }
    this.setState({ filters: next, filterError: null });
    this._fetchInitial();
  }

  clearFilters() {
    this.setState({ filters: { action: "all", gasMethod: "all", property: null, wallet: "" }, filterError: null });
    this._fetchInitial();
  }

  async loadMore() {
    if (this._state.loading || !this._state.hasMore) return;
    this.setState({ loading: true });
    try {
      const params = this._buildParams({ cursor: this._state.cursor });
      const data = await getJson(`/api/transactions${params}`, { timeoutMs: 10_000 });
      const rows = Array.isArray(data) ? data : (data?.transactions || []);
      this.setState({
        rows: [...this._state.rows, ...rows],
        cursor: data?.nextCursor ?? null,
        hasMore: Boolean(data?.nextCursor) && rows.length === PAGE_SIZE,
        loading: false,
      });
    } catch (err) {
      this.setState({ loading: false, error: err?.message || "Failed to load more" });
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────
  async _fetchInitial() {
    this.setState({ loading: true, error: null });
    try {
      const params = this._buildParams({});
      const data = await getJson(`/api/transactions${params}`, { timeoutMs: 10_000 });
      const rows = Array.isArray(data) ? data : (data?.transactions || []);
      this.setState({
        rows,
        cursor: data?.nextCursor ?? null,
        hasMore: Boolean(data?.nextCursor) && rows.length === PAGE_SIZE,
        loading: false,
        ready: true,
        offline: false,
        consecutiveFailures: 0,
      });
    } catch (err) {
      const fails = this._state.consecutiveFailures + 1;
      this.setState({
        loading: false, ready: true,
        offline: fails >= 2,
        consecutiveFailures: fails,
        error: err instanceof ApiError ? err.message : "Failed to load activity",
      });
    }
  }

  _buildParams({ cursor }) {
    const f = this._state.filters;
    const limit = this._state.mode === "rail" ? 20 : PAGE_SIZE;
    const qs = new URLSearchParams({ limit: String(limit) });
    if (f.action && f.action !== "all") qs.set("action", f.action);
    if (f.gasMethod && f.gasMethod !== "all") qs.set("gasMethod", f.gasMethod);
    if (f.property) qs.set("property", f.property);
    if (f.wallet && ADDR_RX.test(f.wallet)) qs.set("wallet", f.wallet);
    if (cursor) qs.set("cursor", cursor);
    const s = qs.toString();
    return s ? `?${s}` : "";
  }

  _startPolling() {
    this._stopPolling();
    this._poll = setInterval(() => this._pollOnce(), RAIL_POLL_MS);
  }

  _stopPolling() {
    if (this._poll) { clearInterval(this._poll); this._poll = null; }
  }

  async _pollOnce() {
    try {
      const data = await getJson(`/api/transactions?limit=20`, { timeoutMs: 10_000 });
      const rows = Array.isArray(data) ? data : (data?.transactions || []);
      const known = new Set(this._state.rows.map((r) => r._id || r.txHash));
      const fresh = rows.filter((r) => !known.has(r._id || r.txHash));
      if (fresh.length === 0) return;
      const merged = [...fresh, ...this._state.rows].slice(0, RAIL_CAP);
      this.setState({ rows: merged, offline: false, consecutiveFailures: 0 });
      // Fan out a TX_CONFIRMED hint per fresh row so listeners (e.g. Marketplace
      // counters) can react without each agent re-polling.
      fresh.forEach((r) => this.dispatch(MSG.TX_CONFIRMED, {
        agent: this.id,
        txHash: r.txHash,
        propertyId: r.propertyId ?? r.property,
        gasMethod: r.gasMethod,
        action: r.action,
      }));
    } catch {
      const fails = this._state.consecutiveFailures + 1;
      this.setState({ offline: fails >= 2, consecutiveFailures: fails });
    }
  }
}
