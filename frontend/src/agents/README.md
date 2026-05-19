# Multi-Agent Orchestration System

Each screen in RealChain is owned by exactly one specialised agent. Agents
never talk to each other directly — every cross-screen interaction flows
through the **Orchestrator** + **AgentBus**. This is the hub-and-spoke
architecture from the screen-enhancements spec, applied to the
six in-scope screens.

## Layout

```
agents/
  index.js          Public barrel — screens import from here only.
  registry.js       Single source of truth for agent ↔ route mapping.
  core/
    AgentBus.js         Pub/sub envelope router. No domain knowledge.
    BaseAgent.js        Lifecycle contract: init / activate / deactivate / destroy / handleEvent.
    Orchestrator.js     The hub: registry, route → activation, shared state, navigate handler.
    AgentProvider.jsx   React glue. Builds one orchestrator per tab. Injects services.
    ToastBridge.jsx     Listens for TOAST envelopes, calls the existing toast UI.
    api.js              getJson / postJson with timeout + retry policy.
    messageTypes.js     Canonical MSG / AGENT_IDS / ORCHESTRATOR_ID constants.
  screens/
    MarketplaceAgent.js        owns /marketplace
    PortfolioAgent.js           owns /portfolio
    ClaimRentAgent.js           owns /dividends
    OwnerControlRoomAgent.js    owns /owner
    ActivityAgent.js            owns /activity AND right-rail on /marketplace
    AnalysisAgent.js            owns /analytics
```

## Hard rules (enforced by convention + registry)

1. **One agent per screen.** An agent appears in exactly one entry in
   `registry.js` and is the only mutator of the state for the routes listed
   under `routes`.
2. **No direct agent-to-agent calls.** Cross-screen requests use
   `this.dispatch(MSG.X, payload, targetId)`. The orchestrator's wildcard bus
   listener routes the envelope.
3. **No domain logic in the orchestrator.** It does activation, routing, and
   shared-state mirroring. Whether a property is buyable, whether to claim
   rent, etc., live inside the screen agent.
4. **No React in the agent layer.** Agents are plain JS classes. The React
   layer subscribes via `useAgentState(id)`.
5. **Shared services are injected, not imported.** Agents read services
   (Web3Context, UGFContext, SmartAgentContext) through `this.ctx.services`,
   set once by `AgentProvider` at startup.

## Lifecycle

```
URL change ──▶ Orchestrator.setRoute(pathname)
                   │
                   ├─ for agents whose routes match: agent.activate({ route })
                   │     ├─ first time: agent.init({ bus, services, ... })
                   │     └─ then onActivate() — fetches data, starts timers
                   │
                   └─ for agents that no longer match: agent.deactivate({ from, to })
                         └─ onDeactivate() — abort in-flight, clear timers
```

## Message flow (hub-and-spoke)

```
Agent A.dispatch(MSG.X, payload, "*")
  └▶ AgentBus.dispatch
        └▶ Orchestrator._route (single wildcard listener)
              ├─ targeted ("to: agentId")        → that agent.handleEvent(env)
              ├─ orchestrator-bound              → orchestrator handles itself
              └─ wildcard                        → fan-out to every ACTIVE agent except sender
```

A small set of message types are canonical (`agents/core/messageTypes.js`):

- **Lifecycle** (orchestrator → agent): ORCH_INIT, ORCH_ACTIVATE, ORCH_DEACTIVATE, ORCH_DESTROY.
- **Shared-state broadcasts**: SHARED_STATE_CHANGED, ROUTE_CHANGED, WALLET_CHANGED, GAS_STATE_CHANGED, UGF_TOGGLED, TOAST.
- **Agent → orchestrator announcements**: AGENT_STATE_CHANGED, AGENT_READY, AGENT_ERROR.
- **Cross-screen requests**: REQUEST_NAVIGATE, REQUEST_DATA, REQUEST_REFRESH.
- **Domain events**: TX_SUBMITTED, TX_CONFIRMED, TX_FAILED, PROPERTY_CHANGED, HOLDINGS_CHANGED.

Anything else is a smell — add a constant in `messageTypes.js` instead of
inventing new strings inline.

## Consumer pattern (how a screen reads its agent)

```jsx
import { useAgent, useAgentState, AGENT_IDS } from "../agents";

export default function MyScreen() {
  const agent = useAgent(AGENT_IDS.MARKETPLACE);
  const state = useAgentState(AGENT_IDS.MARKETPLACE);

  if (!state) return <div>Booting agent…</div>;

  return (
    <button onClick={() => agent.buyTokens({ propertyId: 0, amount: 5n })}>
      Buy
    </button>
  );
}
```

The agent owns the state, the timers, and the contract calls. The page is a
pure renderer + dispatcher.

## Adding a new screen

1. Create `screens/MyAgent.js` extending `BaseAgent`. Set
   `static id = "my-agent"` and `static routes = ["/my-route"]`.
2. Override `getInitialState`, `onActivate`, `onDeactivate`, and any of
   `onEvent` / `onSharedStateChanged` you need.
3. Add an entry to `registry.js`.
4. In your page, call `useAgent` + `useAgentState` and render the snapshot.

Service access: `this.ctx.services.web3`, `this.ctx.services.ugf`,
`this.ctx.services.smart`. Shared snapshot: `this.shared`. Bus dispatch:
`this.dispatch(MSG.X, payload, targetId)`.

## Migration status

- `pages/Activity.jsx` is fully migrated and serves as the reference consumer.
- `pages/Home.jsx`, `Portfolio.jsx`, `Dividends.jsx`, `OwnerDashboard.jsx`,
  and `Analytics.jsx` continue to work with their existing inline logic.
  They can be migrated incrementally to consume their agents — the agent
  layer already mirrors their behaviour so the migration is mechanical
  (replace local `useState` + `useEffect` with `useAgent` + `useAgentState`
  and call agent commands instead of contract calls inline).
