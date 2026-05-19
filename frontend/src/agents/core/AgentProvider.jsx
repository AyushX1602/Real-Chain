// ─────────────────────────────────────────────────────────────────────────────
// AgentProvider.jsx — React glue for the Orchestrator.
//
// Responsibilities:
//   • Build a single Orchestrator instance and seed it with all registered agents.
//   • Inject runtime services (Web3 contract getters, UGF executor, SmartAgent).
//   • Mirror wallet / chain / gas state into the orchestrator's shared state
//     so agents react to changes via SHARED_STATE_CHANGED broadcasts.
//   • Sync the React Router pathname with `orchestrator.setRoute(...)` so the
//     correct agents are activated/deactivated as the user navigates.
//   • Expose React hooks (`useAgent`, `useAgentState`, `useOrchestrator`,
//     `useOrchestratorShared`) that screens use to bind to their agent.
//
// IMPORTANT: only ONE orchestrator exists per browser tab. The provider is
// idempotent under React 18 StrictMode (the cleanup tears down the previous
// orchestrator and the next mount rebuilds a fresh one).
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWeb3 } from "../../context/Web3Context";
import { useUGF } from "../../context/UGFContext";
import { useSmartAgent } from "../../context/SmartAgentContext";
import Orchestrator from "./Orchestrator";
import buildAgentRegistry from "../registry";

const Ctx = createContext(null);

export function AgentProvider({ children }) {
  const web3 = useWeb3();
  const ugf  = useUGF();
  const smart = useSmartAgent();
  const navigate = useNavigate();
  const location = useLocation();

  const [orchestrator, setOrchestrator] = useState(null);
  const builtRef = useRef(false);

  // Build the orchestrator + register all agents exactly once per mount.
  // We cannot do this synchronously because some agents may need async setup
  // before they're considered "ready"; the first setRoute() will await them.
  useEffect(() => {
    if (builtRef.current) return undefined;
    builtRef.current = true;

    const orch = new Orchestrator({
      debug: import.meta.env?.DEV ? false : false,
    });

    // Register every screen agent.
    const registered = buildAgentRegistry();
    for (const entry of registered) {
      orch.register(entry.agent, { routes: entry.routes });
    }

    // Wire navigate handler so agents can dispatch REQUEST_NAVIGATE envelopes.
    orch.registerNavigateHandler((path) => navigate(path));

    setOrchestrator(orch);

    return () => {
      builtRef.current = false;
      orch.destroy();
      setOrchestrator(null);
    };
    // We intentionally do NOT depend on `navigate` — the latest navigate fn is
    // captured below via a ref-style pattern through `registerNavigateHandler`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh navigate handler on changes (closure capture).
  useEffect(() => {
    if (!orchestrator) return;
    orchestrator.registerNavigateHandler((path) => navigate(path));
  }, [orchestrator, navigate]);

  // Inject runtime services + run init pass.
  useEffect(() => {
    if (!orchestrator) return;
    orchestrator.setServices({
      web3,
      ugf,
      smart,
    });
    orchestrator.initAll();
  }, [orchestrator, web3, ugf, smart]);

  // Mirror wallet / chain / role state.
  useEffect(() => {
    if (!orchestrator) return;
    orchestrator.setSharedState({
      account:  web3.account || null,
      chainId:  web3.chainId ?? null,
      roleHint: web3.roleHint ?? null,
      isCorrectNetwork: web3.isCorrectNetwork ?? true,
    });
  }, [orchestrator, web3.account, web3.chainId, web3.roleHint, web3.isCorrectNetwork]);

  // Mirror UGF toggle.
  useEffect(() => {
    if (!orchestrator) return;
    orchestrator.setSharedState({ isUGFEnabled: ugf.isUGFEnabled });
  }, [orchestrator, ugf.isUGFEnabled]);

  // Mirror gas snapshot.
  useEffect(() => {
    if (!orchestrator) return;
    orchestrator.setSharedState({ gasNowGwei: smart.gasNowGwei, gasState: smart.gasState });
  }, [orchestrator, smart.gasNowGwei, smart.gasState]);

  // Sync the URL pathname → orchestrator.
  useEffect(() => {
    if (!orchestrator) return;
    orchestrator.setRoute(location.pathname);
  }, [orchestrator, location.pathname]);

  const value = useMemo(() => ({ orchestrator }), [orchestrator]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useOrchestrator() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOrchestrator must be used inside <AgentProvider>");
  return v.orchestrator;
}

// Get an agent by id. Returns null until the orchestrator has registered it.
export function useAgent(id) {
  const orch = useOrchestrator();
  return orch ? orch.agent(id) : null;
}

// Subscribe to an agent's state. Re-renders the calling component whenever
// the agent calls setState. Returns the latest snapshot or null.
export function useAgentState(id) {
  const orch = useOrchestrator();
  const agent = orch ? orch.agent(id) : null;
  const [snap, setSnap] = useState(() => (agent ? agent.getState() : null));
  useEffect(() => {
    if (!agent) return undefined;
    const off = agent.subscribe((s) => setSnap(s));
    return off;
  }, [agent]);
  return snap;
}

// Subscribe to the orchestrator's shared state. Useful in screens that want
// the canonical wallet / route / gas snapshot rather than reading the
// individual contexts directly.
export function useOrchestratorShared() {
  const orch = useOrchestrator();
  return useSyncExternalStore(
    (cb) => (orch ? orch.subscribeShared(cb) : () => {}),
    () => (orch ? orch.getSharedState() : {}),
    () => ({}),
  );
}
