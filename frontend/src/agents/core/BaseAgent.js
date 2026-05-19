// ─────────────────────────────────────────────────────────────────────────────
// BaseAgent — abstract class enforcing the standard agent contract.
//
// Every screen agent extends this class and overrides at least:
//   onActivate(payload)   — mounting / data fetch
//   onDeactivate(payload) — unmounting / cleanup
//   onEvent(envelope)     — handle bus messages addressed to this agent
//
// The lifecycle methods on the public contract are:
//   init(context)        — dependency injection (orchestrator passes services)
//   activate(payload)    — mark agent active, run onActivate
//   deactivate(payload)  — mark agent inactive, run onDeactivate
//   destroy()            — final teardown, irreversible
//   handleEvent(env)     — entry point for bus messages
//   getState()           — return immutable snapshot of internal state
//
// Internal state is held in `this._state`. Agents call `this.setState(patch)`
// to update it; that emits an AGENT_STATE_CHANGED envelope that React layers
// (or other agents via the orchestrator) can subscribe to.
//
// Agents have NO direct access to other agents. They request cross-screen
// behaviour by dispatching envelopes via `this.dispatch(type, payload, to?)`.
// The orchestrator routes them.
// ─────────────────────────────────────────────────────────────────────────────

import { MSG, ORCHESTRATOR_ID } from "./messageTypes";

export const AGENT_STATUS = Object.freeze({
  CREATED:      "created",
  INITIALIZED:  "initialized",
  ACTIVE:       "active",
  SUSPENDED:    "suspended",
  INACTIVE:     "inactive",
  DESTROYED:    "destroyed",
  ERRORED:      "errored",
});

export default class BaseAgent {
  // Subclasses MUST set a static `id` and SHOULD set static `screens` / `routes`.
  static id = "base";
  static routes = [];

  constructor() {
    if (!this.constructor.id || this.constructor.id === "base") {
      throw new Error("BaseAgent subclass must declare a unique static id");
    }
    this.id = this.constructor.id;
    this.status = AGENT_STATUS.CREATED;

    this._state = this.getInitialState();
    this._subs  = new Set(); // local subscribers (React bindings)
    this._busOff = [];       // unsubscribe fns from orchestrator bus
    this._abort = null;      // optional AbortController for in-flight fetches
    this._ctx = null;        // injected context (set by init)
  }

  // ── Subclass overrides ──────────────────────────────────────────────────
  // Agents override these to express their domain behaviour. Defaults are no-ops
  // so simple agents (e.g. placeholder screens) can omit them.
  getInitialState()        { return { ready: false, loading: false, error: null }; }
  async onInit(_context)   { /* override to fetch metadata, set up timers */ }
  async onActivate(_payload) { /* override to mount + initial data load */ }
  async onDeactivate(_payload) { /* override to cancel timers, persist scroll */ }
  async onDestroy()        { /* override to free shared resources */ }
  async onEvent(_envelope) { /* override to handle inbound bus messages */ }
  async onSharedStateChanged(_next, _prev) { /* override when broadcast lands */ }

  // ── Public contract (orchestrator-facing) ───────────────────────────────
  async init(context) {
    if (this.status !== AGENT_STATUS.CREATED) {
      throw new Error(`Agent ${this.id} cannot init from status ${this.status}`);
    }
    this._ctx = Object.freeze({ ...context });
    try {
      await this.onInit(this._ctx);
      this.status = AGENT_STATUS.INITIALIZED;
      this._announce(MSG.AGENT_READY, { id: this.id });
    } catch (err) {
      this.status = AGENT_STATUS.ERRORED;
      this._announce(MSG.AGENT_ERROR, { id: this.id, phase: "init", error: this._serializeError(err) });
      throw err;
    }
  }

  async activate(payload = {}) {
    if (this.status === AGENT_STATUS.DESTROYED) {
      throw new Error(`Agent ${this.id} is destroyed`);
    }
    if (this.status === AGENT_STATUS.ACTIVE) return;
    if (this.status === AGENT_STATUS.CREATED) {
      throw new Error(`Agent ${this.id} cannot activate before init`);
    }
    try {
      this._abort = new AbortController();
      await this.onActivate(payload);
      this.status = AGENT_STATUS.ACTIVE;
    } catch (err) {
      this.status = AGENT_STATUS.ERRORED;
      this._announce(MSG.AGENT_ERROR, { id: this.id, phase: "activate", error: this._serializeError(err) });
      throw err;
    }
  }

  // `render()` is an alias for `activate()` to satisfy the spec's render/activate
  // shape. We keep React out of the contract — actual DOM rendering happens in
  // the page component that subscribes to this agent's state.
  render(payload) { return this.activate(payload); }

  async deactivate(payload = {}) {
    if (this.status !== AGENT_STATUS.ACTIVE && this.status !== AGENT_STATUS.SUSPENDED) {
      return;
    }
    try {
      if (this._abort) {
        try { this._abort.abort(); } catch { /* noop */ }
        this._abort = null;
      }
      await this.onDeactivate(payload);
      this.status = AGENT_STATUS.INACTIVE;
    } catch (err) {
      this.status = AGENT_STATUS.ERRORED;
      this._announce(MSG.AGENT_ERROR, { id: this.id, phase: "deactivate", error: this._serializeError(err) });
    }
  }

  async destroy() {
    if (this.status === AGENT_STATUS.DESTROYED) return;
    try {
      if (this._abort) { try { this._abort.abort(); } catch { /* noop */ } }
      await this.onDestroy();
    } finally {
      // Tear down subscriptions regardless of whether onDestroy threw.
      this._busOff.forEach((off) => { try { off(); } catch { /* noop */ } });
      this._busOff = [];
      this._subs.clear();
      this._abort = null;
      this._ctx = null;
      this.status = AGENT_STATUS.DESTROYED;
    }
  }

  suspend() {
    if (this.status === AGENT_STATUS.ACTIVE) {
      this.status = AGENT_STATUS.SUSPENDED;
    }
  }

  resume() {
    if (this.status === AGENT_STATUS.SUSPENDED) {
      this.status = AGENT_STATUS.ACTIVE;
    }
  }

  async handleEvent(envelope) {
    if (!envelope || typeof envelope !== "object") return;
    if (envelope.to && envelope.to !== "*" && envelope.to !== this.id) return;
    if (envelope.from === this.id) return; // ignore own echoes

    if (envelope.type === MSG.SHARED_STATE_CHANGED) {
      const { next, prev } = envelope.payload || {};
      try { await this.onSharedStateChanged(next, prev); } catch (err) {
        this._announce(MSG.AGENT_ERROR, { id: this.id, phase: "shared", error: this._serializeError(err) });
      }
      return;
    }

    try {
      await this.onEvent(envelope);
    } catch (err) {
      this._announce(MSG.AGENT_ERROR, { id: this.id, phase: "event", error: this._serializeError(err) });
    }
  }

  getState() {
    // Returns a shallow-frozen snapshot. Agents must NOT hand out internal refs.
    return Object.freeze({ ...this._state, _agentStatus: this.status });
  }

  // ── Internals exposed to subclasses ─────────────────────────────────────
  // setState merges a patch and notifies local React subscribers + the bus.
  setState(patch) {
    if (this.status === AGENT_STATUS.DESTROYED) return;
    if (typeof patch === "function") {
      this._state = { ...this._state, ...(patch(this._state) || {}) };
    } else {
      this._state = { ...this._state, ...(patch || {}) };
    }
    const snap = this.getState();
    for (const fn of this._subs) {
      try { fn(snap); } catch { /* React subscriber threw — ignore */ }
    }
    this._announce(MSG.AGENT_STATE_CHANGED, { id: this.id, state: snap });
  }

  // Subscribe to local state. Returns an unsubscribe fn. React layer uses this.
  subscribe(fn) {
    if (typeof fn !== "function") throw new Error("subscribe requires a function");
    this._subs.add(fn);
    fn(this.getState());
    return () => this._subs.delete(fn);
  }

  // Send a message through the orchestrator. Agents NEVER call other agents
  // directly — they always go through the bus.
  dispatch(type, payload, to = "*") {
    if (!this._ctx?.bus) throw new Error(`Agent ${this.id} cannot dispatch before init`);
    this._ctx.bus.dispatch({ type, payload, from: this.id, to });
  }

  // Convenience: subscribe to specific bus messages, with auto-cleanup on destroy.
  listenOn(type, fn) {
    if (!this._ctx?.bus) throw new Error(`Agent ${this.id} cannot listen before init`);
    const off = this._ctx.bus.on(type, fn);
    this._busOff.push(off);
    return off;
  }

  // Read-only view of injected services. Subclasses use this to fetch / read on-chain.
  get ctx() { return this._ctx; }

  // Read-only view of orchestrator-managed shared state. Subclasses pull
  // wallet / chain / gas state from here so they never import React contexts
  // directly.
  get shared() { return this._ctx?.getSharedState ? this._ctx.getSharedState() : {}; }

  _announce(type, payload) {
    if (!this._ctx?.bus) return;
    this._ctx.bus.dispatch({ type, payload, from: this.id, to: ORCHESTRATOR_ID });
  }

  _serializeError(err) {
    if (!err) return { message: "Unknown error" };
    return { message: err.message || String(err), code: err.code, name: err.name };
  }
}
