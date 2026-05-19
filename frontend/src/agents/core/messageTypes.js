// ─────────────────────────────────────────────────────────────────────────────
// messageTypes.js — Canonical message type constants for the agent bus.
//
// Every message that flows through the Orchestrator MUST use one of these
// constants as its `type`. This makes the protocol greppable and stops agents
// from inventing their own wire format.
//
// Message envelope (enforced in AgentBus.dispatch):
//   { type: string, payload: any, from: AgentID, to?: AgentID | "*" , id: string, ts: number }
//
// Direction conventions:
//   ORCH_*   — orchestrator → agent (lifecycle / shared state)
//   AGENT_*  — agent → orchestrator (announcements, requests)
//   BROADCAST_* — orchestrator → all active agents (cross-cutting events)
// ─────────────────────────────────────────────────────────────────────────────

export const MSG = Object.freeze({
  // Lifecycle (orchestrator → agent)
  ORCH_INIT:        "orch:init",
  ORCH_ACTIVATE:    "orch:activate",
  ORCH_DEACTIVATE:  "orch:deactivate",
  ORCH_DESTROY:     "orch:destroy",
  ORCH_SUSPEND:     "orch:suspend",
  ORCH_RESUME:      "orch:resume",

  // Shared state (orchestrator → agent broadcast)
  SHARED_STATE_CHANGED: "shared:state:changed",
  ROUTE_CHANGED:        "shared:route:changed",
  WALLET_CHANGED:       "shared:wallet:changed",
  CHAIN_CHANGED:        "shared:chain:changed",
  GAS_STATE_CHANGED:    "shared:gas:changed",
  UGF_TOGGLED:          "shared:ugf:toggled",
  TOAST:                "shared:toast",

  // Agent → orchestrator announcements
  AGENT_STATE_CHANGED:  "agent:state:changed",
  AGENT_READY:          "agent:ready",
  AGENT_ERROR:          "agent:error",

  // Agent → orchestrator → agent (cross-screen requests)
  REQUEST_NAVIGATE:     "request:navigate",
  REQUEST_DATA:         "request:data",
  REQUEST_REFRESH:      "request:refresh",

  // Domain-level cross-cutting events
  TX_SUBMITTED:         "tx:submitted",
  TX_CONFIRMED:         "tx:confirmed",
  TX_FAILED:            "tx:failed",
  PROPERTY_CHANGED:     "property:changed",
  HOLDINGS_CHANGED:     "holdings:changed",
});

export const AGENT_IDS = Object.freeze({
  MARKETPLACE:        "marketplace",
  PORTFOLIO:          "portfolio",
  CLAIM_RENT:         "claim-rent",
  OWNER_CONTROL_ROOM: "owner-control-room",
  ACTIVITY:           "activity",
  ANALYSIS:           "analysis",
});

export const ORCHESTRATOR_ID = "orchestrator";
