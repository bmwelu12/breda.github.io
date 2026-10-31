// Client for the Halo API. Two transports, same /v1 routes:
//  - "server": the real Node server (npm run dev), which calls Halo's model service.
//  - "standalone": the same engine running in this browser tab with heuristic stand-in models,
//    used for the hosted demo link when no server is running.
import { matchRoute } from "../../server/src/core/api.ts";
import { Halo, HttpError } from "../../server/src/core/engine.ts";
import { BrowserHeuristicClient } from "../../server/src/core/models.ts";
import { MemoryStore } from "../../server/src/core/store.ts";
import { MockPay } from "../../sdk/payments/index.ts";
import bundledEvals from "../../ml/evals/results/latest.json";

export type Mode = "server" | "standalone";
type Listener = (e: any) => void;

export interface Api {
  mode: Mode;
  get<T = any>(path: string): Promise<T>;
  post<T = any>(path: string, body?: any): Promise<T>;
  subscribe(fn: Listener): () => void;
  tamperDemo?: () => void;
}

class HttpApi implements Api {
  mode: Mode = "server";
  private listeners = new Set<Listener>();
  constructor() {
    const connect = () => {
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/v1/stream`);
      ws.onmessage = (m) => { const e = JSON.parse(m.data); this.listeners.forEach((l) => l(e)); };
      ws.onclose = () => setTimeout(connect, 1500);
    };
    connect();
  }
  async req(method: string, path: string, body?: any) {
    const r = await fetch(path, { method, headers: body !== undefined ? { "content-type": "application/json" } : {}, body: body !== undefined ? JSON.stringify(body) : undefined });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    return j;
  }
  get(p: string) { return this.req("GET", p); }
  post(p: string, b: any = {}) { return this.req("POST", p, b); }
  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
}

class LocalApi implements Api {
  mode: Mode = "standalone";
  halo: Halo;
  store = new MemoryStore();
  constructor() {
    this.halo = new Halo({ store: this.store, models: new BrowserHeuristicClient(), payments: new MockPay() });
    this.halo.seedDemo();
  }
  async call(method: "GET" | "POST", path: string, body?: any) {
    const [p, qs] = path.split("?");
    const m = matchRoute(method, p);
    if (!m) throw new Error(`No route ${method} ${p}`);
    try {
      const res = await m.route.handler({ halo: this.halo, params: m.params, body: body ?? {}, query: Object.fromEntries(new URLSearchParams(qs ?? "")), evals: () => bundledEvals });
      return JSON.parse(JSON.stringify(res ?? null));
    } catch (e: any) {
      throw new Error(e instanceof HttpError ? e.message : String(e?.message ?? e));
    }
  }
  get(p: string) { return this.call("GET", p); }
  post(p: string, b?: any) { return this.call("POST", p, b); }
  subscribe(fn: Listener) { const off = this.halo.on((e) => fn(JSON.parse(JSON.stringify(e)))); return () => { off(); }; }
  /** Demo only: edit one stored log entry the way an attacker with storage access would. */
  tamperDemo() {
    const n = this.store.activity().length;
    if (n > 2) this.store._tamper(Math.max(1, n - 2), { data: { note: "edited by an agent trying to hide its tracks" } });
  }
}

export async function createApi(): Promise<Api> {
  if (import.meta.env.VITE_STANDALONE) return new LocalApi();
  try {
    const r = await fetch("/v1/health", { signal: AbortSignal.timeout(1500) });
    if (r.ok) return new HttpApi();
  } catch { /* no server: fall through */ }
  return new LocalApi();
}
