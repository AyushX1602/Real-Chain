// ─────────────────────────────────────────────────────────────────────────────
// OwnerControlRoomAgent — owns the /owner screen.
//
// Domain:  property-owner panels (one per owned property), deposit form,
//          deposit history, holder concentration metric.
// Reads:   GET /api/properties (10s)
//          GET /api/properties/:id/holders (10s, "—" on failure per R4 §14)
// Writes:  MockUSDC.approve(amount) → RentalDistribution.depositRental(amount)
//          via UGFContext.
// ─────────────────────────────────────────────────────────────────────────────

import BaseAgent from "../core/BaseAgent";
import { MSG, AGENT_IDS } from "../core/messageTypes";
import { getJson } from "../core/api";

const AMOUNT_MIN = 0.01;
const AMOUNT_MAX = 1_000_000;

export default class OwnerControlRoomAgent extends BaseAgent {
  static id = AGENT_IDS.OWNER_CONTROL_ROOM;
  static routes = ["/owner"];

  getInitialState() {
    return {
      ready: false,
      loading: false,
      error: null,
      walletConnected: false,
      isOwner: false,
      panels: [], // [{ id, name, totalSupply, tokensRemaining, lifetimeRentDeposited, lastDepositAt, top5SharePct }]
      flight: {}, // propertyId → "approve"|"deposit"
      validation: {}, // propertyId → string|null
    };
  }

  async onActivate() {
    const shared = this.shared;
    if (!shared.account) {
      this.setState({ walletConnected: false, ready: true, panels: [] });
      return;
    }
    if (shared.roleHint && shared.roleHint !== "Owner") {
      this.setState({ isOwner: false, ready: true });
      this.dispatch(MSG.REQUEST_NAVIGATE, { path: "/investor" });
      return;
    }
    this.setState({ walletConnected: true, isOwner: true, loading: true, error: null });
    await this._loadPanels();
  }

  async onSharedStateChanged(next, prev) {
    if (next.account !== prev?.account || next.roleHint !== prev?.roleHint) {
      await this.onActivate();
    }
  }

  async onEvent(env) {
    if (env.type === MSG.REQUEST_REFRESH) await this._loadPanels();
  }

  // ── Public commands ─────────────────────────────────────────────────────
  validateAmount(propertyId, value) {
    const v = String(value ?? "").trim();
    if (!v) return this._setValidation(propertyId, "Enter an amount");
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return this._setValidation(propertyId, "Use up to 2 decimal places");
    const n = Number(v);
    if (!Number.isFinite(n)) return this._setValidation(propertyId, "Invalid number");
    if (n < AMOUNT_MIN) return this._setValidation(propertyId, `Minimum is ${AMOUNT_MIN.toFixed(2)} MockUSDC`);
    if (n > AMOUNT_MAX) return this._setValidation(propertyId, `Maximum is ${AMOUNT_MAX.toLocaleString()} MockUSDC`);
    this._setValidation(propertyId, null);
    return n;
  }

  async deposit({ propertyId, amount }) {
    const validated = this.validateAmount(propertyId, amount);
    if (typeof validated !== "number") return null;
    const panel = this._state.panels.find((p) => p.id === propertyId);
    if (!panel) return null;

    const services = this.ctx.services;
    if (!services.web3.signer) {
      this.dispatch(MSG.TOAST, { kind: "warn", message: "Connect your wallet" });
      return null;
    }

    this.setState({ flight: { ...this._state.flight, [propertyId]: "approve" } });
    this.dispatch(MSG.TX_SUBMITTED, { agent: this.id, propertyId, kind: "deposit" });

    try {
      const usdc = services.web3.getUsdc();
      const raw  = BigInt(Math.round(validated * 1_000_000));
      const c    = services.web3.getPropertyContracts({
        propertyToken: panel.tokenAddr,
        rentalDistribution: panel.rentalAddr,
        marketplace: panel.marketAddr,
      });

      // 1) MockUSDC.approve directly via signer (cheap, no UGF wrapping needed for ERC20 approve)
      const approveTx = await usdc.approve(panel.rentalAddr, raw);
      await approveTx.wait();

      // 2) RentalDistribution.depositRental via UGF
      this.setState({ flight: { ...this._state.flight, [propertyId]: "deposit" } });
      const abi = c.rental.interface.fragments.map((f) => f.format("full"));
      const receipt = await services.ugf.ugfExecute(panel.rentalAddr, abi, "depositRental", [raw]);

      this.dispatch(MSG.TX_CONFIRMED, {
        agent: this.id, propertyId,
        txHash: receipt?.hash || receipt?.transactionHash || null,
        gasMethod: services.ugf.isUGFEnabled ? "ugf" : "eth",
      });
      setTimeout(() => this._loadPanels(), 1500);
      return receipt;
    } catch (err) {
      this.dispatch(MSG.TX_FAILED, { agent: this.id, propertyId, reason: err?.message });
      this.dispatch(MSG.TOAST, { kind: "error", message: err?.message || "Deposit failed" });
      return null;
    } finally {
      const next = { ...this._state.flight };
      delete next[propertyId];
      this.setState({ flight: next });
    }
  }

  goCreateProperty() {
    this.dispatch(MSG.REQUEST_NAVIGATE, { path: "/owner#create" });
  }

  // ── Internals ───────────────────────────────────────────────────────────
  _setValidation(propertyId, message) {
    this.setState({ validation: { ...this._state.validation, [propertyId]: message } });
  }

  async _loadPanels() {
    const services = this.ctx.services;
    const account = this.shared.account?.toLowerCase();
    if (!account) return;
    this.setState({ loading: true, error: null });
    try {
      const data = await getJson("/api/properties", { timeoutMs: 10_000 });
      const list = Array.isArray(data) ? data : (data?.properties || []);
      const mine = list.filter((p) => (p.owner || "").toLowerCase() === account);
      const panels = mine.map((p) => ({
        id: p.id ?? p._id,
        name: p.name,
        tokenAddr: p.propertyToken,
        rentalAddr: p.rentalDistribution,
        marketAddr: p.marketplace,
        totalSupply: Number(p.totalSupply ?? 0),
        tokensRemaining: Number(p.tokensRemaining ?? 0),
        lifetimeRentDeposited: Number(p.lifetimeRentDeposited ?? 0),
        lastDepositAt: p.lastDepositAt || null,
        top5SharePct: null,
      }));
      this.setState({ panels, loading: false, ready: true });
      // Lazy holder concentration fetch per panel.
      panels.forEach((panel) => this._fetchHolderConcentration(panel.id));
    } catch (err) {
      this.setState({ loading: false, ready: true, error: err?.message || "Could not load properties" });
    }
  }

  async _fetchHolderConcentration(propertyId) {
    try {
      const data = await getJson(`/api/properties/${propertyId}/holders`, { timeoutMs: 10_000 });
      const holders = (data?.holders || []).slice().sort((a, b) => Number(b.balance) - Number(a.balance));
      const top5 = holders.slice(0, 5).reduce((s, h) => s + Number(h.balance), 0);
      const total = holders.reduce((s, h) => s + Number(h.balance), 0);
      const pct = total > 0 ? Math.round((top5 / total) * 1000) / 10 : null;
      this.setState((s) => ({
        panels: s.panels.map((p) => p.id === propertyId ? { ...p, top5SharePct: pct } : p),
      }));
    } catch {
      this.setState((s) => ({
        panels: s.panels.map((p) => p.id === propertyId ? { ...p, top5SharePct: null } : p),
      }));
    }
  }
}
