import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "./Web3Context";
import { ETH_USD_RATE } from "../config/contracts";
import { getEthUsdRateSync, getEthUsdRateAsync } from "../hooks/useMarketPrice";

// ─────────────────────────────────────────────────────────────────────────────
// SmartAgentContext — opt-in helper that adds two value-adds on top of UGF:
//
//   1) Gas optimizer (heuristic, free, always available)
//      - Polls the read provider's fee data every 20s.
//      - Maintains a rolling 1-hour history.
//      - Computes a `gasState` of "low" / "normal" / "high" using percentiles.
//      - Exposes `analyzeHoldings()` that turns that state + per-property
//        pending/balance numbers into actionable suggestions.
//
//   2) AI assistant (optional, BYO key)
//      - Stores a chosen provider + masked API key in localStorage.
//      - `askAgent(question, holdings)` posts a structured prompt to one of:
//          * OpenAI Chat Completions
//          * Anthropic Messages
//          * Google Gemini generateContent
//          * OpenRouter Chat Completions
//      - Returns plain text. Cost is whatever the provider charges per call.
//
// Two toggles:
//   - smartGas:   gas optimizer suggestions on/off
//   - smartAi:    LLM augmentation on/off
//
// SECURITY NOTE: storing API keys in localStorage and calling LLM endpoints
// directly from the browser exposes the key in network requests and dev tools.
// Acceptable for a personal demo, NOT for shared deployments. The settings UI
// surfaces this risk explicitly. Keys never leave localStorage and are never
// sent to RealChain's own backend.
// ─────────────────────────────────────────────────────────────────────────────

const Ctx = createContext(null);

const KEYS = {
  smartGas:    "realchain.agent.smartGas",
  smartAi:     "realchain.agent.smartAi",
  provider:    "realchain.agent.provider",
  apiKey:      "realchain.agent.apiKey",
  model:       "realchain.agent.model",
};

export const AGENT_PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    docsUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o-mini",
    keyPrefix: "sk-",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    docsUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-3-5-haiku-latest",
    keyPrefix: "sk-ant-",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    docsUrl: "https://aistudio.google.com/app/apikey",
    defaultModel: "gemini-2.5-flash",
    keyPrefix: "AIza",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    docsUrl: "https://openrouter.ai/keys",
    defaultModel: "openrouter/auto",
    keyPrefix: "sk-or-",
  },
];

function readLs(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch { return fallback; }
}
function writeLs(key, value) {
  try { window.localStorage.setItem(key, String(value)); } catch { /* private mode */ }
}
function readBool(key, fallback) {
  const v = readLs(key, null);
  if (v === null) return fallback;
  return v === "true";
}

function classifyGas(gweiNow, recent) {
  // Rolling percentile against the last hour of samples; falls back to fixed
  // thresholds when we don't have enough history yet.
  if (recent.length < 5) {
    if (gweiNow < 1)  return "low";
    if (gweiNow > 30) return "high";
    return "normal";
  }
  const sorted = [...recent].sort((a, b) => a - b);
  const p33 = sorted[Math.floor(sorted.length * 0.33)];
  const p66 = sorted[Math.floor(sorted.length * 0.66)];
  if (gweiNow <= p33) return "low";
  if (gweiNow >= p66) return "high";
  return "normal";
}

export function SmartAgentProvider({ children }) {
  const { provider: walletProvider, account } = useWeb3();
  const [smartGas, setSmartGas] = useState(() => readBool(KEYS.smartGas, false));
  const [smartAi,  setSmartAi]  = useState(() => readBool(KEYS.smartAi, false));
  const [aiProvider, setAiProvider] = useState(() => readLs(KEYS.provider, "openai"));
  const [aiKey,      setAiKeyState] = useState(() => readLs(KEYS.apiKey, ""));
  const [aiModel,    setAiModelState] = useState(() => readLs(KEYS.model, ""));

  // Live ETH/USD rate — fetched once on provider mount. The imperative
  // getter is what `analyzeHoldings` consults during its synchronous
  // computation; the async getter primes the cache here so the first
  // suggestion list is computed against the same number the cost banner uses.
  useEffect(() => {
    getEthUsdRateAsync().catch(() => { /* fallback handled internally */ });
  }, []);

  // Live gas reading — populated by the polling effect below.
  const [gasNowGwei, setGasNowGwei] = useState(null);
  const historyRef = useRef([]);

  // Persist toggles + provider/key/model so the popover round-trips cleanly.
  useEffect(() => writeLs(KEYS.smartGas, smartGas), [smartGas]);
  useEffect(() => writeLs(KEYS.smartAi, smartAi), [smartAi]);
  useEffect(() => writeLs(KEYS.provider, aiProvider), [aiProvider]);
  const setAiKey = useCallback((v) => {
    setAiKeyState(v);
    writeLs(KEYS.apiKey, v ?? "");
  }, []);
  const setAiModel = useCallback((v) => {
    setAiModelState(v);
    writeLs(KEYS.model, v ?? "");
  }, []);

  // Live gas-price polling. Uses the wallet provider when connected; otherwise
  // a default Base Sepolia public RPC. Quietly tolerates RPC blips.
  useEffect(() => {
    let alive = true;
    let timer = null;

    async function tick() {
      try {
        const rp = walletProvider || new ethers.JsonRpcProvider(
          import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
        );
        // Base L2 doesn't support eth_maxPriorityFeePerGas (used by
        // getFeeData), so use the legacy eth_gasPrice RPC call instead.
        const raw = await rp.send("eth_gasPrice", []);
        const wei = BigInt(raw);
        if (!wei) return;
        const gwei = Number(wei) / 1e9;
        if (!alive) return;
        setGasNowGwei(gwei);
        const list = historyRef.current;
        list.push({ ts: Date.now(), gwei });
        // Keep last hour only.
        const cutoff = Date.now() - 60 * 60 * 1000;
        while (list.length && list[0].ts < cutoff) list.shift();
      } catch { /* offline — keep last value */ }
      finally {
        if (alive) timer = setTimeout(tick, 20_000);
      }
    }
    tick();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [walletProvider]);

  const gasState = useMemo(() => {
    if (gasNowGwei == null) return "unknown";
    return classifyGas(gasNowGwei, historyRef.current.map((r) => r.gwei));
  }, [gasNowGwei]);

  // ── Heuristic suggestion engine ───────────────────────────────────────────
  // Inputs: holdings = [{ id, name, location, pending (bigint USDC 6dp),
  //                       balance (bigint PROP 18dp), pricePerToken? }]
  const analyzeHoldings = useCallback((holdings = []) => {
    const out = [];
    if (!Array.isArray(holdings) || holdings.length === 0) return out;

    const totalPendingUsd = holdings.reduce((s, h) => s + Number(h.pending || 0n) / 1e6, 0);

    // 1) Gas window suggestion based on current state.
    if (gasState === "low") {
      out.push({
        id: "gas-low",
        kind: "good",
        icon: "bolt",
        title: "Gas is below average right now",
        body: gasNowGwei != null
          ? `Network fee is around ${gasNowGwei.toFixed(2)} gwei — a good window to batch claims and listings.`
          : "Network fees look favourable for batching transactions.",
      });
    } else if (gasState === "high") {
      out.push({
        id: "gas-high",
        kind: "warn",
        icon: "alert",
        title: "Gas is elevated — consider waiting",
        body: gasNowGwei != null
          ? `Network fee is around ${gasNowGwei.toFixed(2)} gwei. UGF still settles in Mock USD; only the underlying chain cost is higher.`
          : "Network fees look elevated. Non-urgent claims can wait for a calmer window.",
      });
    }

    // 2) Worth-it check per property: claim only when pending exceeds an
    // estimated cost floor. Without UGF: ~120k gas × current price × ETH/USD.
    // ETH/USD comes from /api/market/price (cached), with the env constant
    // as the deterministic fallback.
    const estCostUsd = (() => {
      if (gasNowGwei == null) return 0.40;
      const wei = BigInt(Math.round(gasNowGwei * 1e9)) * 120000n;
      const eth = Number(ethers.formatEther(wei));
      const rate = getEthUsdRateSync() || ETH_USD_RATE || 2000;
      return eth * rate;
    })();

    holdings.forEach((h) => {
      const pendingUsd = Number(h.pending || 0n) / 1e6;
      if (pendingUsd <= 0) return;
      const ratio = pendingUsd / Math.max(0.01, estCostUsd);
      if (ratio >= 50) {
        out.push({
          id: `claim-now-${h.id}`,
          kind: "good",
          icon: "coins",
          title: `Claim ${h.name} now`,
          body: `${pendingUsd.toFixed(2)} USDC pending — about ${ratio.toFixed(0)}× the estimated gas cost without UGF.`,
        });
      } else if (ratio < 5) {
        out.push({
          id: `wait-${h.id}`,
          kind: "info",
          icon: "info",
          title: `${h.name} pending is small`,
          body: `${pendingUsd.toFixed(2)} USDC pending vs ~$${estCostUsd.toFixed(2)} ETH-equivalent gas. UGF still wraps it for free in Mock USD; otherwise wait for more rent to accrue.`,
        });
      }
    });

    // 3) Batch hint when there are several properties with pending dust.
    const claimable = holdings.filter((h) => h.pending > 0n);
    if (claimable.length >= 2 && totalPendingUsd >= estCostUsd * 5) {
      out.push({
        id: "batch-hint",
        kind: "good",
        icon: "layers",
        title: `Batch ${claimable.length} claims in one tap`,
        body: `Use the Claim All button on the dashboard hero to settle ${totalPendingUsd.toFixed(2)} USDC across ${claimable.length} properties at once.`,
      });
    }

    // 4) UGF reminder when no UGF wrapper is active. Pulled separately by
    // callers that have the UGF context; we keep this engine pure.

    return out;
  }, [gasState, gasNowGwei]);

  // ── LLM router ────────────────────────────────────────────────────────────
  const llmReady = Boolean(smartAi && aiKey && aiKey.length > 8);

  const askAgent = useCallback(async ({ question, holdings = [], suggestions = [] }) => {
    if (!llmReady) {
      throw new Error("AI provider not configured. Add an API key in Settings.");
    }
    const prov = AGENT_PROVIDERS.find((p) => p.id === aiProvider) || AGENT_PROVIDERS[0];
    const model = (aiModel && aiModel.trim()) || prov.defaultModel;

    const systemPrompt = "You are RealChain's portfolio assistant. The user holds tokenized real estate. Answer concisely (under 120 words). Never recommend financial actions outright; phrase as observations and trade-offs. Reference numbers from the context when relevant.";
    const context = JSON.stringify({
      account,
      gasNowGwei: gasNowGwei == null ? null : Number(gasNowGwei.toFixed(3)),
      gasState,
      heuristics: suggestions.map(({ id, title, body }) => ({ id, title, body })),
      holdings: holdings.map((h) => ({
        id: h.id,
        name: h.name,
        pendingUsd: Number(h.pending || 0n) / 1e6,
        propBalance: Number(h.balance || 0n) / 1e18,
      })),
    });

    const userPrompt = `Context: ${context}\n\nUser question: ${question || "Summarise the most useful next action."}`;

    if (prov.id === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 400,
        }),
      });
      if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
      const data = await r.json();
      return data?.choices?.[0]?.message?.content?.trim() || "(empty response)";
    }

    if (prov.id === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": aiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
      const data = await r.json();
      const text = (data?.content || []).map((c) => c?.text || "").join("\n").trim();
      return text || "(empty response)";
    }

    if (prov.id === "gemini") {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(aiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
        }),
      });
      if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
      const data = await r.json();
      const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || "").join("\n").trim();
      return text || "(empty response)";
    }

    if (prov.id === "openrouter") {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiKey}`,
          "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://realchain.local",
          "X-Title": "RealChain",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 400,
        }),
      });
      if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${await r.text()}`);
      const data = await r.json();
      return data?.choices?.[0]?.message?.content?.trim() || "(empty response)";
    }

    throw new Error(`Unsupported provider: ${prov.id}`);
  }, [llmReady, aiKey, aiProvider, aiModel, account, gasNowGwei, gasState]);

  const value = useMemo(() => ({
    smartGas, setSmartGas,
    smartAi,  setSmartAi,
    aiProvider, setAiProvider,
    aiKey, setAiKey,
    aiModel, setAiModel,
    llmReady,
    gasNowGwei, gasState,
    analyzeHoldings,
    askAgent,
    providers: AGENT_PROVIDERS,
  }), [smartGas, smartAi, aiProvider, aiKey, aiModel, llmReady, gasNowGwei, gasState, analyzeHoldings, askAgent, setAiKey, setAiModel]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSmartAgent() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSmartAgent must be used inside SmartAgentProvider");
  return ctx;
}

export default SmartAgentProvider;
