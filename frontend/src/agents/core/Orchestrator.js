// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator — the single coordinator.
//
// Owns:
//   • Agent registry (id → agent instance)
//   • Lifecycle: init, activate, deactivate, suspend, resume, destroy
//   • Routing: maps current route → active agent set
//   • Inter-agent comms: every envelope flows through here
//   • Shared state: wallet, chainId, role, gas state, UGF toggle, current route
//
// Owns NOTHING else. The orchestrator must remain free of domain logic — it
// does not decide whether a property is buyable, whether an LLM call should
// run, etc. Those decisions live inside the screen agents.
//
// React-safe: the orchestrator is plain JS. A thin React provider
// (AgentProvider.jsx) hands it the wallet/UGF/SmartAgent values and exposes
// hooks for screen components to subscribe to agent state.
// ─────────────────────────────────────────────────────────────────────────────

import AgentBus from "./AgentBus";
import { AGENT_STATUS } from "./BaseAgent";
import { MSG, ORCHESTRATOR_ID } from "./messageTypes";

const DEFAULT_SHARED_STATE = Object.freeze({
  route:      "/",
  account:    null,
  chainId:    null,
  roleHint:   null,
  isUGFEnabled: true,
  gasNowGwei: null,
  gasState:   "unknown",
  isCorrectNetwork: true,
});

export default class Orchestrator {
  constructor({ bus, debug = false } = {}) {
    this.bus = bus || new AgentBus({ debug });
    this._agents = new Map();          // id → agent instance
    this._agentRoutes = new Map();     // id → string[]
    this._activeIds = new Set();
    this._destroyed = false;
    this._sharedState = { ...DEFAULT_SHARED_STATE };
    this._services = {};               // ethers / api adapters injected at startup
    this._subs = new Set();             // shared-state subscribers
    this._eventLog = [];                // ring buffer for diagnostics
    this._maxLog = 100;

    // The orchestrator is itself a participant on the bus so it can observe
    // every cross-agent message and forward addressed envelopes to the right
    // agent. The wildcard listener is the spine of hub-and-spoke routing.
    this._unBus = this.bus.on("*", (env) => this._route(env));
  }

  // ── Registration ────────────────────────────────────────────────────────
  register(agent, { routes } = {}) {
    if (this._destroyed) throw new Error("Orchestrator is destroyed");
    if (!agent || typeof agent.id !== "string") {
      throw new Error("Orchestrator.register requires an agent with a string id");
    }
    if (this._agents.has(agent.id)) {
      throw new Error(`Agent already registered: ${agent.id}`);
    }
    this._agents.set(agent.id, agent);
    const r = routes ?? agent.constructor?.routes ?? [];
    this._agentRoutes.set(agent.id, Array.isArray(r) ? r.slice() : []);
  }

  agent(id) { return this._agents.get(id) || null; }
  list() { return Array.from(this._agents.values()); }

  // ── Service injection (called once at startup by AgentProvider) ─────────
  setServices(services) {
    this._services = Object.freeze({ ...services });
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────
  async initAll() {
    if (this._destroyed) throw new Error("Orchestrator is destroyed");
    const ctx = this._buildContext();
    for (const agent of this._agents.values()) {
      if (agent.status === AGENT_STATUS.CREATED) {
        try { await agent.init(ctx); }
        catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[Orchestrator] init failed for ${agent.id}:`, err);
        }
      }
    }
  }

  async destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    try { this._unBus?.(); } catch { /* noop */ }
    for (const agent of this._agents.values()) {
      try { await agent.destroy(); } catch { /* noop */ }
    }
    this._agents.clear();
    this._agentRoutes.clear();
    this._activeIds.clear();
    this._subs.clear();
    this.bus.clear();
  }

  // ── Routing ─────────────────────────────────────────────────────────────
  // Update the active route. The orchestrator activates agents whose routes
  // match (incl. wildcard), deactivates the rest. This is the only entry
  // point through which screens come and go.
  async setRoute(pathname) {
    if (this._destroyed) return;
    const prev = this._sharedState.route;
    if (prev === pathname) return;
    this._setShared({ route: pathname });

    const matchingIds = new Set();
    for (const [id, routes] of this._agentRoutes) {
      if (this._matchesAny(routes, pathname)) matchingIds.add(id);
    }

    // Deactivate agents that should no longer be active.
    const toDeactivate = [...this._activeIds].filter((id) => !matchingIds.has(id));
    for (const id of toDeactivate) {
      const agent = this._agents.get(id);
      if (!agent) continue;
      try { await agent.deactivate({ from: prev, to: pathname }); }
      catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[Orchestrator] deactivate failed for ${id}:`, err);
      }
      this._activeIds.delete(id);
    }

    // Activate agents that should now be active.
    for (const id of matchingIds) {
      if (this._activeIds.has(id)) continue;
      const agent = this._agents.get(id);
      if (!agent) continue;
      try {
        if (agent.status === AGENT_STATUS.CREATED) {
          await agent.init(this._buildContext());
        }
        await agent.activate({ route: pathname });
        this._activeIds.add(id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[Orchestrator] activate failed for ${id}:`, err);
      }
    }

    this.bus.dispatch({
      type: MSG.ROUTE_CHANGED,
      from: ORCHESTRATOR_ID,
      payload: { from: prev, to: pathname, activeIds: [...this._activeIds] },
    });
  }

  isActive(id) { return this._activeIds.has(id); }
  activeIds() { return [...this._activeIds]; }

  // ── Shared state ────────────────────────────────────────────────────────
  // The orchestrator owns globally-relevant state. Screens read it via the
  // injected `getSharedState()` callback or by listening to bus broadcasts.
  setSharedState(patch) {
    if (this._destroyed) return;
    this._setShared(patch);
  }

  getSharedState() {
    return { ...this._sharedState };
  }

  subscribeShared(fn) {
    this._subs.add(fn);
    fn(this.getSharedState());
    return () => this._subs.delete(fn);
  }

  // ── Cross-screen requests ───────────────────────────────────────────────
  // Agents emit REQUEST_NAVIGATE / REQUEST_REFRESH / REQUEST_DATA envelopes;
  // the orchestrator decides what to do with them. Domain rules belong to
  // the agent, but the side-effect (navigation, fan-out) belongs here.
  registerNavigateHandler(fn) { this._navigateHandler = fn; }

  eventLog() { return this._eventLog.slice(); }

  // ── Internals ───────────────────────────────────────────────────────────
  _route(envelope) {
    this._recordEvent(envelope);

    // Lifecycle envelopes are emitted BY the orchestrator; no further routing.
    if (envelope.from === ORCHESTRATOR_ID) {
      // Still notify shared-state subscribers when state changes.
      if (envelope.type === MSG.SHARED_STATE_CHANGED) {
        for (const fn of this._subs) { try { fn(this.getSharedState()); } catch { /* noop */ } }
      }
      return;
    }

    // Route addressed envelopes. `to: "*"` fans out to every active agent
    // EXCEPT the sender; addressed envelopes go to that one agent.
    const target = envelope.to;
    if (target && target !== "*" && target !== ORCHESTRATOR_ID) {
      const a = this._agents.get(target);
      if (a) a.handleEvent(envelope);
      return;
    }

    if (target === ORCHESTRATOR_ID) {
      this._handleOrchestratorMessage(envelope);
      return;
    }

    // Wildcard fan-out — only to ACTIVE agents, and never echo back to sender.
    for (const id of this._activeIds) {
      if (id === envelope.from) continue;
      const a = this._agents.get(id);
      if (a) a.handleEvent(envelope);
    }

    // Some message types need orchestrator handling regardless.
    if (envelope.type === MSG.REQUEST_NAVIGATE) {
      this._handleOrchestratorMessage(envelope);
    }
  }

  _handleOrchestratorMessage(envelope) {
    if (envelope.type === MSG.REQUEST_NAVIGATE) {
      const path = envelope.payload?.path;
      if (typeof path === "string" && this._navigateHandler) {
        try { this._navigateHandler(path, envelope.payload); }
        catch (err) {
          // eslint-disable-next-line no-console
          console.error("[Orchestrator] navigate handler threw:", err);
        }
      }
    }
    if (envelope.type === MSG.REQUEST_REFRESH) {
      const targetId = envelope.payload?.target;
      if (targetId) {
        const a = this._agents.get(targetId);
        if (a) a.handleEvent({ ...envelope, to: targetId });
      } else {
        // Refresh all active agents.
        for (const id of this._activeIds) {
          const a = this._agents.get(id);
          if (a && id !== envelope.from) a.handleEvent({ ...envelope, to: id });
        }
      }
    }
  }

  _setShared(patch) {
    const prev = this._sharedState;
    const next = { ...prev, ...(patch || {}) };
    let changed = false;
    for (const k of Object.keys(next)) {
      if (next[k] !== prev[k]) { changed = true; break; }
    }
    if (!changed) return;
    this._sharedState = next;
    this.bus.dispatch({
      type: MSG.SHARED_STATE_CHANGED,
      from: ORCHESTRATOR_ID,
      payload: { prev, next },
    });
    if ("account" in patch || "chainId" in patch || "roleHint" in patch) {
      this.bus.dispatch({
        type: MSG.WALLET_CHANGED,
        from: ORCHESTRATOR_ID,
        payload: { account: next.account, chainId: next.chainId, roleHint: next.roleHint },
      });
    }
    if ("gasNowGwei" in patch || "gasState" in patch) {
      this.bus.dispatch({
        type: MSG.GAS_STATE_CHANGED,
        from: ORCHESTRATOR_ID,
        payload: { gasNowGwei: next.gasNowGwei, gasState: next.gasState },
      });
    }
    if ("isUGFEnabled" in patch) {
      this.bus.dispatch({
        type: MSG.UGF_TOGGLED,
        from: ORCHESTRATOR_ID,
        payload: { isUGFEnabled: next.isUGFEnabled },
      });
    }
  }

  _buildContext() {
    return {
      bus: this.bus,
      services: this._services,
      getSharedState: () => this.getSharedState(),
      // Agents NEVER receive other agents directly. If they need cross-screen
      // data, they go through the bus.
      requestNavigate: (path, opts) => this.bus.dispatch({
        type: MSG.REQUEST_NAVIGATE, from: ORCHESTRATOR_ID, to: ORCHESTRATOR_ID,
        payload: { path, ...(opts || {}) },
      }),
    };
  }

  _matchesAny(routes, pathname) {
    for (const r of routes) {
      if (r === "*") return true;
      if (r === pathname) return true;
      // Param routes: /property/:id
      if (r.includes(":")) {
        const re = new RegExp("^" + r.replace(/:[^/]+/g, "[^/]+") + "$");
        if (re.test(pathname)) return true;
      }
      // Prefix routes: /property/*
      if (r.endsWith("/*")) {
        const base = r.slice(0, -2);
        if (pathname === base || pathname.startsWith(base + "/")) return true;
      }
    }
    return false;
  }

  _recordEvent(env) {
    this._eventLog.push({
      type: env.type, from: env.from, to: env.to, ts: env.ts ?? Date.now(),
    });
    if (this._eventLog.length > this._maxLog) this._eventLog.shift();
  }
}
