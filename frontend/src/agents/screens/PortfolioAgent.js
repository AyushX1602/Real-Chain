// ─────────────────────────────────────────────────────────────────────────────
// PortfolioAgent — owns the /portfolio screen.
//
// Domain:  per-wallet holdings, valuations, projected next-deposit cadence.
// Reads:   GET /api/users/:address  (10s timeout)
//          + on-chain fallback per property (Holding.balance, totalSupply,
//            pendingDividends).
//
// The Claim All CTA does NOT submit transactions — it routes the user to the
// /dividends screen via REQUEST_NAVIGATE so ClaimRentAgent owns the actual
// claim flow. This is the explicit isolation rule in action.
// ─────────────────────────────────────────────────────────────────────────────

import BaseAgent from "../core/BaseAgent";
import { MSG, AGENT_IDS } from "../core/messageTypes";
import { getJson } from "../core/api";

export default class PortfolioAgent extends BaseAgent {
  static id = AGENT_IDS.PORTFOLIO;
  static routes = ["/portfolio"];

  getInitialState() {
    return {
      ready: false,
      loading: false,
      error: null,
      indexerOffline: false,
      walletConnected: false,
      rows: [],          // [{ id, name, holding, totalSupply, sharePct, valuationUsd, lifetimeRentUsd, pendingUsd, projectedNextDeposit, cadenceDays }]
      totalPendingUsd: 0,
    };
  }

  async onActivate() {
    const shared = this.shared;
    if (!shared.account) {
      this.setState({ ready: true, walletConnected: false, rows: [], totalPendingUsd: 0 });
      return;
    }
    this.setState({ walletConnected: true, loading: true, error: null });
    await this._loadHoldings();
  }

  async onSharedStateChanged(next, prev) {
    if (next.account !== prev?.account) {
      // Wallet flipped — full reload.
      await this.onActivate();
    }
  }

  async onEvent(env) {
    if (env.type === MSG.REQUEST_REFRESH) await this._loadHoldings();
    if (env.type === MSG.TX_CONFIRMED && env.from !== this.id) {
      // A claim or buy elsewhere should reflect here.
      await this._loadHoldings();
    }
  }

  // ── Public commands ─────────────────────────────────────────────────────
  // Triggered by the screen's "Claim All Rent" CTA. The portfolio agent does
  // NOT submit — it asks the orchestrator to navigate to /dividends, which
  // activates ClaimRentAgent.
  goClaimAll() {
    this.dispatch(MSG.REQUEST_NAVIGATE, { path: "/dividends" });
  }

  goSell(propertyId) {
    this.dispatch(MSG.REQUEST_NAVIGATE, { path: `/property/${propertyId}#sell` });
  }

  goView(propertyId) {
    this.dispatch(MSG.REQUEST_NAVIGATE, { path: `/property/${propertyId}` });
  }

  // ── Internals ───────────────────────────────────────────────────────────
  async _loadHoldings() {
    const shared = this.shared;
    const account = shared.account;
    if (!account) return;

    this.setState({ loading: true, error: null });
    try {
      const data = await getJson(`/api/users/${account}`, { timeoutMs: 10_000 });
      const rows = Array.isArray(data?.holdings)
        ? data.holdings.map((h) => this._normalizeRow(h))
        : [];
      const totalPendingUsd = rows.reduce((s, r) => s + (r.pendingUsd || 0), 0);
      this.setState({
        rows, totalPendingUsd,
        loading: false, ready: true, indexerOffline: false,
      });
    } catch (err) {
      // R2 §10 fallback — read on-chain.
      try {
        const fallback = await this._loadFromChain(account);
        this.setState({
          rows: fallback,
          totalPendingUsd: fallback.reduce((s, r) => s + (r.pendingUsd || 0), 0),
          loading: false, ready: true, indexerOffline: true, error: null,
        });
      } catch {
        this.setState({
          loading: false, ready: true,
          error: err?.message || "Could not load your holdings",
        });
      }
    }
  }

  _normalizeRow(h) {
    const holding = Number(h.holding ?? h.balance ?? 0);
    const totalSupply = Number(h.totalSupply ?? 0);
    const sharePct = totalSupply > 0 ? Math.round((holding / totalSupply) * 10_000) / 100 : 0;
    const name = (h.name || "").length > 60 ? `${(h.name || "").slice(0, 60)}…` : (h.name || "");
    const cadenceDays = typeof h.cadenceDays === "number" && h.epochCount >= 2
      ? Number(h.cadenceDays)
      : null;
    let projectedNextDeposit = null;
    if (cadenceDays && h.lastDepositAt) {
      const last = new Date(h.lastDepositAt);
      const next = new Date(last.getTime() + cadenceDays * 86_400_000);
      projectedNextDeposit = next.toISOString().slice(0, 10);
    }
    return {
      id: h.id ?? h.propertyId,
      name,
      holding,
      totalSupply,
      sharePct,
      valuationUsd: Math.round(Number(h.valuationUsd ?? 0) * 100) / 100,
      lifetimeRentUsd: Math.round(Number(h.lifetimeRentUsd ?? 0) * 100) / 100,
      pendingUsd: Math.round(Number(h.pendingUsd ?? 0) * 100) / 100,
      cadenceDays,
      projectedNextDeposit,
    };
  }

  async _loadFromChain(account) {
    const web3 = this.ctx.services.web3;
    const factory = web3.getReadFactory();
    const count = Number(await factory.getPropertiesCount());
    const out = [];
    for (let i = 0; i < count; i++) {
      const p = await factory.properties(i);
      try {
        const c = web3.getReadPropertyContracts({
          propertyToken: p.propertyToken,
          rentalDistribution: p.rentalDistribution,
          marketplace: p.marketplace,
        });
        const [bal, totalSupply, pending] = await Promise.all([
          c.token.balanceOf(account),
          c.token.totalSupply(),
          c.rental.pendingDividends(account).catch(() => 0n),
        ]);
        if (bal > 0n) {
          out.push({
            id: i,
            name: p.name || `Property #${i}`,
            holding: Number(bal) / 1e18,
            totalSupply: Number(totalSupply) / 1e18,
            sharePct: totalSupply > 0n ? Math.round((Number(bal) / Number(totalSupply)) * 10_000) / 100 : 0,
            valuationUsd: 0,
            lifetimeRentUsd: 0,
            pendingUsd: Number(pending) / 1e6,
            cadenceDays: null,
            projectedNextDeposit: null,
          });
        }
      } catch { /* skip */ }
    }
    return out;
  }
}
