// ─────────────────────────────────────────────────────────────────────────────
// agents/index.js — public surface of the agent system.
//
// Screens import from this barrel only:
//   import { useAgent, useAgentState, AGENT_IDS, MSG } from "../agents";
// ─────────────────────────────────────────────────────────────────────────────

export { AgentProvider, useAgent, useAgentState, useOrchestrator, useOrchestratorShared } from "./core/AgentProvider";
export { default as Orchestrator } from "./core/Orchestrator";
export { default as AgentBus } from "./core/AgentBus";
export { default as BaseAgent, AGENT_STATUS } from "./core/BaseAgent";
export { MSG, AGENT_IDS, ORCHESTRATOR_ID } from "./core/messageTypes";
