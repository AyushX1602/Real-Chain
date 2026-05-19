// ─────────────────────────────────────────────────────────────────────────────
// AnalysisAgent — owns the /analytics screen.
//
// Domain:  platform KPIs, time series, holder concentration, leaderboard.
// Reads:   GET /api/transactions/stats        (5s timeout per R6 §1)
//          GET /api/transactions/timeseries   (window in {7,30,90})
//          GET /api/properties/:id/holders    (per-property concentration)
//          GET /api/users/leaderboard/top
//
// Each panel can fail independently — the agent stores a per-panel status so
// the page renders partial data instead of an all-or-nothing error.
// ─────────────────────────────────────────────────────────────────────────────

import BaseAgent from "../core/BaseAgent";
import { MSG, AGENT_IDS } from "../core/messageTypes";
import { getJson } from "../core/api";

const VALID_WINDOWS = new Set([7, 30, 90]);

export default class AnalysisAgent extends BaseAgent {
  static id = AGENT_IDS.ANALYSIS;
  static routes = ["/analytics"];

  getInitialState() {
    return {
      ready: false,
      window: 30,
      panels: {
        kpis:        { loading: true, error: null, data: null },
        timeseries:  { loading: true, error: null, data: null },
        holders:     { loading: true, error: null, data: [] }, // [{ propertyId, top5 }]
        leaderboard: { loading: true, error: null, data: [] },
      },
    };
  }

  async onActivate() {
    this._fetchAll();
  }

  async onEvent(env) {
    if (env.type === MSG.REQUEST_REFRESH) this._fetchAll();
  }

  // ── Public commands ─────────────────────────────────────────────────────
  setWindow(days) {
    if (!VALID_WINDOWS.has(days)) return;
    this.setState({ window: days });
    this._fetchTimeseries();
  }

  // ── Internals ───────────────────────────────────────────────────────────
  _fetchAll() {
    this._fetchKpis();
    this._fetchTimeseries();
    this._fetchLeaderboard();
    this._fetchHolders();
  }

  _patchPanel(name, patch) {
    this.setState((s) => ({
      panels: { ...s.panels, [name]: { ...s.panels[name], ...patch } },
      ready: true,
    }));
  }

  async _fetchKpis() {
    this._patchPanel("kpis", { loading: true, error: null });
    try {
      const data = await getJson("/api/transactions/stats", { timeoutMs: 5_000 });
      this._patchPanel("kpis", { loading: false, data });
    } catch (err) {
      this._patchPanel("kpis", { loading: false, error: err?.message || "KPIs unavailable" });
    }
  }

  async _fetchTimeseries() {
    this._patchPanel("timeseries", { loading: true, error: null });
    try {
      const data = await getJson(`/api/transactions/timeseries?window=${this._state.window}`, { timeoutMs: 10_000 });
      this._patchPanel("timeseries", { loading: false, data });
    } catch (err) {
      this._patchPanel("timeseries", { loading: false, error: err?.message || "Timeseries unavailable" });
    }
  }

  async _fetchLeaderboard() {
    this._patchPanel("leaderboard", { loading: true, error: null });
    try {
      const data = await getJson("/api/users/leaderboard/top?limit=10", { timeoutMs: 10_000 });
      const rows = Array.isArray(data) ? data : (data?.leaders || []);
      this._patchPanel("leaderboard", { loading: false, data: rows });
    } catch (err) {
      this._patchPanel("leaderboard", { loading: false, error: err?.message || "Leaderboard unavailable" });
    }
  }

  async _fetchHolders() {
    this._patchPanel("holders", { loading: true, error: null });
    try {
      const props = await getJson("/api/properties", { timeoutMs: 10_000 });
      const list = Array.isArray(props) ? props : (props?.properties || []);
      const rows = await Promise.all(list.slice(0, 25).map(async (p) => {
        try {
          const r = await getJson(`/api/properties/${p.id ?? p._id}/holders`, { timeoutMs: 10_000 });
          const holders = (r?.holders || []).slice().sort((a, b) => Number(b.balance) - Number(a.balance));
          const total = holders.reduce((s, h) => s + Number(h.balance), 0) || 1;
          const top5 = holders.slice(0, 5).map((h) => Math.round((Number(h.balance) / total) * 1000) / 10);
          return { propertyId: p.id ?? p._id, name: p.name, top5 };
        } catch {
          return { propertyId: p.id ?? p._id, name: p.name, top5: [] };
        }
      }));
      this._patchPanel("holders", { loading: false, data: rows });
    } catch (err) {
      this._patchPanel("holders", { loading: false, error: err?.message || "Holders unavailable" });
    }
  }
}
