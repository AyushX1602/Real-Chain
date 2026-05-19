// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceAgent — owns the /marketplace screen.
//
// Domain:  property catalog (browse), holder badges (lazy), buy via UGF
// Reads:   GET /api/properties  (10s timeout, with on-chain fallback)
//          GET /api/properties/:id/holders  (5s timeout, "—" on failure)
//          PropertyFactory.getProperties()  (fallback)
// Writes:  Marketplace.buyFromOwner / buyFromListing  (via UGFContext)
//
// Exclusively owns:
//   - the catalog list, search/sort/filter state
//   - per-card buy flight tracking
//   - holder-badge cache for cards that have intersected the viewport
//
// Does NOT touch:
//   - Portfolio / holdings (that's PortfolioAgent's domain)
//   - Activity feed rendering (right rail asks ActivityAgent for data via bus)
//   - Owner deposit forms (OwnerControlRoomAgent)
// ─────────────────────────────────────────────────────────────────────────────

import { ethers } from "ethers";
import BaseAgent from "../core/BaseAgent";
import { MSG, AGENT_IDS } from "../core/messageTypes";
import { getJson, withRetry, ApiError } from "../core/api";

export default class MarketplaceAgent extends BaseAgent {
  static id = AGENT_IDS.MARKETPLACE;
  static routes = ["/marketplace"];

  getInitialState() {
    return {
      ready: false,
      loading: false,
      error: null,
      indexerOffline: false,
      properties: [],     // [{ id, name, image, pricePerToken, totalSupply, tokensRemaining, holders }]
      holderCounts: {},   // id → number | null
      flight: {},         // id → { kind: "approve"|"buy", since: ts }
      filters: { q: "", sort: "id_asc", maxPrice: "", onlyWatched: false },
    };
  }

  async onInit(_ctx) { /* nothing — wait for activate */ }

  async onActivate() {
    this.setState({ loading: true, error: null });
    await this._loadCatalog();
  }

  async onDeactivate() {
    // Catalog stays in memory — re-activation is cheap and avoids flicker.
  }

  async onEvent(env) {
    switch (env.type) {
      case MSG.REQUEST_REFRESH:
        await this._loadCatalog();
        break;
      case MSG.HOLDINGS_CHANGED:
      case MSG.TX_CONFIRMED:
        // A buy / sell elsewhere can change tokensRemaining.
        if (env.payload?.propertyId) await this._refreshOne(env.payload.propertyId);
        break;
      default:
        break;
    }
  }

  async onSharedStateChanged(next, prev) {
    if (next.account !== prev?.account) {
      // Wallet flipped — re-load to reflect any holder-only views (none today,
      // but keeps the agent reactive).
      await this._loadCatalog();
    }
  }

  // ── Public commands (called by the React screen via the agent) ──────────
  setFilter(patch) {
    this.setState({ filters: { ...this._state.filters, ...patch } });
  }

  // Lazy holder-count fetch — triggered by the screen when a card crosses 50%
  // viewport intersection (R1 §2). Cached forever per session.
  async fetchHolderCount(propertyId) {
    if (this._state.holderCounts[propertyId] !== undefined) return;
    try {
      const data = await getJson(`/api/properties/${propertyId}/holders`, { timeoutMs: 5_000 });
      // Tolerate { count, holders }, { holders }, or bare array — see backend.
      const count = (typeof data?.count === "number") ? data.count
        : Array.isArray(data?.holders) ? data.holders.length
        : Array.isArray(data) ? data.length
        : null;
      this.setState({ holderCounts: { ...this._state.holderCounts, [propertyId]: count } });
    } catch {
      this.setState({ holderCounts: { ...this._state.holderCounts, [propertyId]: null } });
    }
  }

  async buyTokens({ propertyId, amount, kind = "primary" }) {
    const shared = this.shared;
    if (!shared.account) {
      this.dispatch(MSG.TOAST, { kind: "warn", message: "Connect your wallet to buy tokens" });
      return null;
    }
    const property = this._state.properties.find((p) => p.id === propertyId);
    if (!property) throw new Error(`Unknown property ${propertyId}`);

    const services = this.ctx.services;
    const ugf = services.ugf;
    const web3 = services.web3;

    if (!web3.signer) {
      this.dispatch(MSG.TOAST, { kind: "warn", message: "Wallet not ready" });
      return null;
    }

    this.setState({ flight: { ...this._state.flight, [propertyId]: { kind: "buy", since: Date.now() } } });
    this.dispatch(MSG.TX_SUBMITTED, { propertyId, kind, agent: this.id });

    try {
      const targets = web3.getPropertyContracts({
        propertyToken: property.tokenAddr,
        rentalDistribution: property.rentalAddr,
        marketplace: property.marketAddr,
      });
      const fnName = kind === "primary" ? "buyFromOwner" : "buyFromListing";
      const args = kind === "primary" ? [amount] : [amount];
      const abi = targets.market.interface.fragments.map((f) => f.format("full"));

      const receipt = await ugf.ugfExecute(
        property.marketAddr,
        abi,
        fnName,
        args,
      );

      this.dispatch(MSG.TX_CONFIRMED, {
        agent: this.id,
        propertyId,
        txHash: receipt?.hash || receipt?.transactionHash || null,
        gasMethod: ugf.isUGFEnabled ? "ugf" : "eth",
      });
      // Background-refresh tokens-remaining within the requirement's 10s window.
      setTimeout(() => this._refreshOne(propertyId), 1500);
      return receipt;
    } catch (err) {
      this.dispatch(MSG.TX_FAILED, {
        agent: this.id, propertyId,
        reason: err?.message || String(err),
      });
      this.dispatch(MSG.TOAST, { kind: "error", message: err?.message || "Buy failed" });
      return null;
    } finally {
      const next = { ...this._state.flight };
      delete next[propertyId];
      this.setState({ flight: next });
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────
  async _loadCatalog() {
    this.setState({ loading: true, error: null });
    const services = this.ctx.services;
    try {
      const data = await withRetry(
        () => getJson("/api/properties", { timeoutMs: 10_000 }),
        { attempts: 3, baseMs: 400 }
      );
      const list = Array.isArray(data) ? data : (data?.properties || []);
      const norm = list.map((p) => this._normalizeApiProperty(p));
      this.setState({ properties: norm, loading: false, indexerOffline: false, ready: true });
    } catch (err) {
      // R1 §7 — fall back to direct on-chain reads when the indexer is down.
      try {
        const fallback = await this._loadFromChain();
        this.setState({
          properties: fallback,
          loading: false,
          ready: true,
          indexerOffline: true,
          error: null,
        });
      } catch (chainErr) {
        this.setState({
          loading: false, ready: true,
          error: err instanceof ApiError ? err.message : "Failed to load properties",
        });
      }
    }
  }

  async _loadFromChain() {
    const web3 = this.ctx.services.web3;
    const factory = web3.getReadFactory();
    const count = Number(await factory.getPropertiesCount());
    const out = [];
    for (let i = 0; i < count; i++) {
      const p = await factory.properties(i);
      let totalSupply = 0n, pricePerToken = 0n;
      try {
        const c = web3.getReadPropertyContracts({
          propertyToken: p.propertyToken,
          rentalDistribution: p.rentalDistribution,
          marketplace: p.marketplace,
        });
        [totalSupply, pricePerToken] = await Promise.all([
          c.token.totalSupply(),
          c.market.pricePerToken(),
        ]);
      } catch { /* keep zeros */ }
      out.push({
        id: i,
        name: p.name,
        image: null,
        owner: p.owner,
        tokenAddr: p.propertyToken,
        rentalAddr: p.rentalDistribution,
        marketAddr: p.marketplace,
        pricePerToken: Number(pricePerToken) / 1e6,
        totalSupply: Number(ethers.formatEther(totalSupply)),
        tokensRemaining: null,
      });
    }
    return out;
  }

  _normalizeApiProperty(p) {
    return {
      id: p.id ?? p._id ?? p.propertyId ?? null,
      name: p.name || "Unnamed property",
      image: p.image || p.imageUrl || null,
      owner: p.owner,
      tokenAddr: p.propertyToken || p.tokenAddress,
      rentalAddr: p.rentalDistribution || p.rentalAddress,
      marketAddr: p.marketplace || p.marketplaceAddress,
      pricePerToken: typeof p.pricePerToken === "number" ? p.pricePerToken
        : (Number(p.pricePerToken) / (p.priceDecimals === 18 ? 1e18 : 1e6)),
      totalSupply: typeof p.totalSupply === "number" ? p.totalSupply
        : Number(p.totalSupply ?? 0),
      tokensRemaining: typeof p.tokensRemaining === "number" ? p.tokensRemaining
        : Number(p.tokensRemaining ?? 0),
    };
  }

  async _refreshOne(propertyId) {
    try {
      const data = await getJson(`/api/properties/${propertyId}`, { timeoutMs: 5_000 });
      const norm = this._normalizeApiProperty(data?.property || data);
      this.setState((s) => ({
        properties: s.properties.map((p) => p.id === propertyId ? { ...p, ...norm } : p),
      }));
    } catch { /* leave existing row alone */ }
  }
}
