import { Halo } from "../src/core/engine.ts";
import { BrowserHeuristicClient, type ModelClient } from "../src/core/models.ts";
import { MemoryStore } from "../src/core/store.ts";
import { MockPay } from "../../sdk/payments/index.ts";

/** Wraps the heuristic client and lets a test force any model output. */
export class ForcedModel extends BrowserHeuristicClient implements ModelClient {
  force: Partial<Record<"sentinelFast" | "sentinelReason" | "steward" | "interrogator", any>> = {};
  async sentinelFast(t: string) { return this.force.sentinelFast ? { result: this.force.sentinelFast, backend: "mock", latency_ms: 0 } : super.sentinelFast(t); }
  async sentinelReason(c: any, a: any, b: any, d: any) { return this.force.sentinelReason ? { result: this.force.sentinelReason, backend: "mock", latency_ms: 0 } : super.sentinelReason(c, a, b, d); }
  async steward(u: string, p: any, a: any, c: any[]) { return this.force.steward ? { result: this.force.steward, backend: "mock", latency_ms: 0 } : super.steward(u, p, a, c); }
  async interrogator(d: any, c: any, r: any) { return this.force.interrogator ? { result: this.force.interrogator, backend: "mock", latency_ms: 0 } : super.interrogator(d, c, r); }
}

export function makeHalo(models: ModelClient = new ForcedModel()) {
  const store = new MemoryStore();
  const halo = new Halo({ store, models, payments: new MockPay({ per_transaction: 300, daily: 500 }) });
  halo.seedDemo();
  return { halo, store, models };
}

export const ALLOW = { decision: "allow", origin: "user", goal_pressure: "normal", reason: "looks fine" };
export const SAFE_JUDGMENT = { intent: "routine", deception_signals: [], identity_consistent: true, contract_consistent: true, risk: 0, explanation: "fine" };
export const SAFE_LINE = { tactic: "none", item: "none", risk: "low", all_tactics: [], all_items: [], injection: false };
