// ─────────────────────────────────────────────────────────────────────────────
// AgentBus — pub/sub event bus that backs hub-and-spoke comms.
//
// The bus is the only mechanism agents use to talk to each other. Direct
// imports between agents are prohibited by convention and enforced by the
// registry pattern (agents are constructed by the orchestrator, never by
// other agents).
//
// All envelopes that flow through the bus are normalised by `dispatch` before
// fan-out. Listeners are scoped by message `type` (or `*` for wildcard).
//
// This class has no knowledge of agents, screens, or routing. The
// Orchestrator builds those concepts on top.
// ─────────────────────────────────────────────────────────────────────────────

let _seq = 0;
function nextId() {
  _seq = (_seq + 1) | 0;
  return `m_${Date.now().toString(36)}_${_seq.toString(36)}`;
}

export default class AgentBus {
  constructor({ debug = false } = {}) {
    this._listeners = new Map(); // type → Set<fn>
    this._wildcard  = new Set(); // listeners that receive every message
    this._history   = [];        // last N envelopes (debug only)
    this._debug     = Boolean(debug);
    this._maxHistory = 200;
  }

  // Subscribe to one message type. Returns an unsubscribe fn.
  on(type, fn) {
    if (typeof fn !== "function") {
      throw new Error("AgentBus.on requires a listener function");
    }
    if (type === "*") {
      this._wildcard.add(fn);
      return () => this._wildcard.delete(fn);
    }
    let set = this._listeners.get(type);
    if (!set) {
      set = new Set();
      this._listeners.set(type, set);
    }
    set.add(fn);
    return () => set.delete(fn);
  }

  // Subscribe to many types in one call.
  onMany(types, fn) {
    const offs = types.map((t) => this.on(t, fn));
    return () => offs.forEach((off) => off());
  }

  // Dispatch an envelope. Normalises shape, never throws into the caller.
  dispatch(envelope) {
    const e = this._normalise(envelope);

    if (this._debug) {
      this._history.push(e);
      if (this._history.length > this._maxHistory) this._history.shift();
      // eslint-disable-next-line no-console
      console.debug("[AgentBus]", e.type, "from", e.from, "→", e.to ?? "*", e.payload);
    }

    const direct = this._listeners.get(e.type);
    if (direct) {
      for (const fn of direct) {
        try { fn(e); } catch (err) { this._safeError(err, e); }
      }
    }
    for (const fn of this._wildcard) {
      try { fn(e); } catch (err) { this._safeError(err, e); }
    }
    return e;
  }

  // Tear down everything (called by orchestrator on destroy).
  clear() {
    this._listeners.clear();
    this._wildcard.clear();
    this._history.length = 0;
  }

  history() { return this._history.slice(); }

  _normalise(envelope) {
    if (!envelope || typeof envelope !== "object") {
      throw new Error("AgentBus.dispatch requires an envelope object");
    }
    if (typeof envelope.type !== "string" || !envelope.type) {
      throw new Error("AgentBus envelope.type must be a non-empty string");
    }
    if (typeof envelope.from !== "string" || !envelope.from) {
      throw new Error("AgentBus envelope.from must be a non-empty AgentID");
    }
    return {
      type:    envelope.type,
      payload: envelope.payload ?? null,
      from:    envelope.from,
      to:      envelope.to ?? "*",
      id:      envelope.id ?? nextId(),
      ts:      envelope.ts ?? Date.now(),
    };
  }

  _safeError(err, envelope) {
    // eslint-disable-next-line no-console
    console.error("[AgentBus] listener threw for", envelope?.type, err);
  }
}
