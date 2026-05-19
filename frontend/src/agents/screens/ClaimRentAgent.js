// ─────────────────────────────────────────────────────────────────────────────
// ClaimRentAgent — owns the /dividends screen.
//
// Domain:  per-property pending rent, epoch-by-epoch claim flow, gas-method badge.
// Reads:   RentalDistribution.pendingDividends(account) on-chain (15s timeout)
// Writes:  RentalDistribution.claim(epochId) / claimAll() via UGFContext
//
// This is the only agent that submits claim transactions. Portfolio asks
// the orchestrator to navigate here when its "Claim All Rent" CTA fires.
// ─────────────────────────────────────────────────────────────────────────────

import BaseAgent from "../core/BaseAgent";
import { MSG, AGENT_IDS } from "../core/messageTypes";

const TIMEOUT_MS = 15_000;

export default class ClaimRentAgent extends BaseAgent {
  static id = AGENT_IDS.CLAIM_RENT;
  static routes = ["/dividends"];

  getInitialState() {
    return {
      ready: false,
      loading: false,
      error: null,
      walletConnected: false,
      panels: [],     // [{ id, name, totalPendingUsd, epochs: [{ index, ts, claimableUsd, status }], rentalAddr }]
      flight: {},     // key (`${propertyId}:${epochId}` or `all:${propertyId}`) → ts
    };
  }

  async onActivate() {
    if (!this.shared.account) {
      this.setState({ ready: true, walletConnected: false, panels: [] });
      return;
    }
    this.setState({ walletConnected: true, loading: true, error: null });
    await this._loadPanels();
  }

  async onSharedStateChanged(next, prev) {
    if (next.account !== prev?.account) {
      await this.onActivate();
    }
  }

  async onEvent(env) {
    if (env.type === MSG.REQUEST_REFRESH) await this._loadPanels();
  }

  // ── Public commands ─────────────────────────────────────────────────────
  async claimEpoch({ propertyId, epochId }) {
    return this._submitClaim({
      propertyId,
      flightKey: `${propertyId}:${epochId}`,
      build: (rentalAbi) => ({ fnName: "claim", args: [epochId] }),
    });
  }

  async claimAll(propertyId) {
    return this._submitClaim({
      propertyId,
      flightKey: `all:${propertyId}`,
      build: () => ({ fnName: "claimAll", args: [] }),
    });
  }

  // ── Internals ───────────────────────────────────────────────────────────
  async _submitClaim({ propertyId, flightKey, build }) {
    const panel = this._state.panels.find((p) => p.id === propertyId);
    if (!panel) return null;
    const services = this.ctx.services;
    const ugf = services.ugf;
    if (!services.web3.signer) {
      this.dispatch(MSG.TOAST, { kind: "warn", message: "Connect your wallet" });
      return null;
    }

    this.setState({ flight: { ...this._state.flight, [flightKey]: Date.now() } });
    this.dispatch(MSG.TX_SUBMITTED, { agent: this.id, propertyId, flightKey });

    try {
      const c = services.web3.getPropertyContracts({
        propertyToken: panel.tokenAddr,
        rentalDistribution: panel.rentalAddr,
        marketplace: panel.marketAddr,
      });
      const abi = c.rental.interface.fragments.map((f) => f.format("full"));
      const { fnName, args } = build(abi);
      const receipt = await ugf.ugfExecute(panel.rentalAddr, abi, fnName, args);
      this.dispatch(MSG.TX_CONFIRMED, {
        agent: this.id, propertyId,
        txHash: receipt?.hash || receipt?.transactionHash || null,
        gasMethod: ugf.isUGFEnabled ? "ugf" : "eth",
      });
      setTimeout(() => this._loadPanels(), 1500);
      return receipt;
    } catch (err) {
      this.dispatch(MSG.TX_FAILED, { agent: this.id, propertyId, reason: err?.message });
      this.dispatch(MSG.TOAST, { kind: "error", message: err?.message || "Claim failed" });
      return null;
    } finally {
      const next = { ...this._state.flight };
      delete next[flightKey];
      this.setState({ flight: next });
    }
  }

  async _loadPanels() {
    const account = this.shared.account;
    if (!account) return;
    this.setState({ loading: true, error: null });

    const services = this.ctx.services;
    const web3 = services.web3;
    const factory = web3.getReadFactory();
    try {
      const count = Number(await Promise.race([
        factory.getPropertiesCount(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timed out")), TIMEOUT_MS)),
      ]));
      const panels = [];
      for (let i = 0; i < count; i++) {
        const p = await factory.properties(i);
        try {
          const c = web3.getReadPropertyContracts({
            propertyToken: p.propertyToken,
            rentalDistribution: p.rentalDistribution,
            marketplace: p.marketplace,
          });
          const [bal, pending] = await Promise.all([
            c.token.balanceOf(account),
            c.rental.pendingDividends(account).catch(() => 0n),
          ]);
          if (bal === 0n && pending === 0n) continue;
          panels.push({
            id: i,
            name: p.name || `Property #${i}`,
            tokenAddr: p.propertyToken,
            rentalAddr: p.rentalDistribution,
            marketAddr: p.marketplace,
            totalPendingUsd: Math.round((Number(pending) / 1e6) * 100) / 100,
            epochs: [],
          });
        } catch { /* skip */ }
      }
      this.setState({ panels, loading: false, ready: true });
    } catch (err) {
      this.setState({ loading: false, ready: true, error: err?.message || "Could not load claims" });
    }
  }
}
