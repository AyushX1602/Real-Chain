// ─────────────────────────────────────────────────────────────────────────────
// registry.js — single source of truth for agent ↔ route mapping.
//
// AgentProvider calls `buildAgentRegistry()` once on mount, registers every
// returned agent with the orchestrator, and uses the route list to decide
// which agents to activate when the URL changes.
//
// Strict isolation rule: an agent appears in EXACTLY ONE entry, owns EXACTLY
// the screens listed under `routes`, and is the only agent that can mutate
// state for those screens. Cross-screen requests go through the bus.
// ─────────────────────────────────────────────────────────────────────────────

import MarketplaceAgent from "./screens/MarketplaceAgent";
import PortfolioAgent from "./screens/PortfolioAgent";
import ClaimRentAgent from "./screens/ClaimRentAgent";
import OwnerControlRoomAgent from "./screens/OwnerControlRoomAgent";
import ActivityAgent from "./screens/ActivityAgent";
import AnalysisAgent from "./screens/AnalysisAgent";

export default function buildAgentRegistry() {
  return [
    { agent: new MarketplaceAgent(),         routes: ["/marketplace"] },
    { agent: new PortfolioAgent(),            routes: ["/portfolio"] },
    { agent: new ClaimRentAgent(),            routes: ["/dividends"] },
    { agent: new OwnerControlRoomAgent(),     routes: ["/owner"] },
    // ActivityAgent runs on its dedicated route AND alongside Marketplace as
    // the right-rail variant. It detects mode at activate-time from the route.
    { agent: new ActivityAgent(),             routes: ["/activity", "/marketplace"] },
    { agent: new AnalysisAgent(),             routes: ["/analytics"] },
  ];
}
