// Model client. The product talks ONLY to Halo's own model service (ml/serve) on Halo's own hosts.
import * as H from "./heuristics.ts";
import type { InterrogatorTurn, Judgment, LineFlags, ModelMeta, StewardVerdict, Turn } from "./types.ts";

export interface ModelClient {
  sentinelFast(text: string): Promise<{ result: LineFlags } & ModelMeta>;
  sentinelReason(conversation: Turn[], claimed: any, registry: any, contract: any): Promise<{ result: Judgment } & ModelMeta>;
  steward(userRequest: string, prefs: any, action: any, context: any[]): Promise<{ result: StewardVerdict } & ModelMeta>;
  interrogator(dialogue: Turn[], claimed: any, registryCheck: any): Promise<{ result: InterrogatorTurn } & ModelMeta>;
  embed(texts: string[]): Promise<number[][]>;
  redTeam(n: number, seed?: number): Promise<any[]>;
  roleplay(persona: any, history: Turn[], script: string[]): Promise<string>;
  health(): Promise<any>;
}

/** Hosts the model client may contact. Anything else is refused (see test: no closed AI APIs). */
export const ALLOWED_MODEL_HOSTS = ["127.0.0.1", "localhost", "ml-serve", "halo-ml.internal"];

export class HttpModelClient implements ModelClient {
  constructor(private baseUrl: string) {
    const host = new URL(baseUrl).hostname;
    if (!ALLOWED_MODEL_HOSTS.includes(host)) throw new Error(`Model service host ${host} is not a Halo-owned host`);
  }
  private async post(path: string, body: unknown) {
    const res = await fetch(this.baseUrl + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`model service ${path} -> ${res.status}`);
    return (await res.json()) as { backend: string; latency_ms: number; result: any };
  }
  async sentinelFast(text: string) { return this.post("/v1/sentinel-fast", { text }); }
  async sentinelReason(conversation: Turn[], claimed_identity: any, registry_record: any, contract: any) {
    return this.post("/v1/sentinel-reason", { conversation, claimed_identity, registry_record, contract });
  }
  async steward(user_request: string, preferences: any, action: any, context: any[]) {
    return this.post("/v1/steward", { user_request, preferences, action, context });
  }
  async interrogator(dialogue: Turn[], claimed_identity: any, registry_check: any) {
    return this.post("/v1/interrogator", { dialogue, claimed_identity, registry_check });
  }
  async embed(texts: string[]) { return (await this.post("/v1/embed", { texts })).result; }
  async redTeam(n: number, seed?: number) { return (await this.post("/v1/redteam/generate", { n, seed })).result; }
  async roleplay(persona: any, history: Turn[], script: string[]) { return (await this.post("/v1/roleplay", { persona, history, script })).result; }
  async health() {
    const r = await fetch(this.baseUrl + "/health");
    return r.json();
  }
}

/** Standalone browser demo only: heuristic stand-ins, labelled as such. */
export class BrowserHeuristicClient implements ModelClient {
  private meta = (t0: number) => ({ backend: "browser-heuristic", latency_ms: +(performance.now() - t0).toFixed(2) });
  async sentinelFast(text: string) { const t = performance.now(); return { result: H.classifyLine(text), ...this.meta(t) }; }
  async sentinelReason(c: Turn[], cl: any, r: any, k: any) { const t = performance.now(); return { result: H.judgeConversation(c, cl, r, k), ...this.meta(t) }; }
  async steward(u: string, p: any, a: any, c: any[]) { const t = performance.now(); return { result: H.reviewAction(u, p, a, c), ...this.meta(t) }; }
  async interrogator(d: Turn[], cl: any, rc: any) { const t = performance.now(); return { result: H.interrogate(d, cl, rc), ...this.meta(t) }; }
  async embed(texts: string[]) { return H.embed(texts); }
  async redTeam(n: number, seed?: number) { return H.redTeamAttacks(n, seed); }
  async roleplay(p: any, h: Turn[], s: string[]) { return H.roleplayNext(p, h, s); }
  async health() { return { ok: true, backend: "browser-heuristic", note: "Standalone demo: heuristic stand-ins, not the trained models." }; }
}
