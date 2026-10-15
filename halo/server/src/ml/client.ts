// Client to the Python serving service (/ml/serve). The Node app calls ONLY this service for
// model inference; user data never leaves Halo. If the service is unreachable (e.g. during
// `npm run dev` with no Python running), we fall back to the local deterministic engine, and
// every result is honestly tagged with its source: 'finetuned' | 'base' | 'heuristic'.

import type { RegisteredAgent, SentinelFastResult, SentinelReasonResult, StewardResult } from '../domain.js';
import { interrogator as hInterrogator, sentinelFast as hFast, sentinelReason as hReason, steward as hSteward, type ReasonContext, type StewardContext } from './heuristic.js';

export interface MlStatus {
  reachable: boolean;
  models: Record<string, { source: string; model: string | null }>;
}

export class MlClient {
  private reachable = false;
  private statusCache: MlStatus['models'] = {};

  constructor(private baseUrl: string | null) {}

  async refreshStatus(): Promise<MlStatus> {
    if (!this.baseUrl) {
      this.reachable = false;
      return { reachable: false, models: {} };
    }
    try {
      const res = await fetch(`${this.baseUrl}/status`, { signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        const body = (await res.json()) as { models: MlStatus['models'] };
        this.reachable = true;
        this.statusCache = body.models;
        return { reachable: true, models: body.models };
      }
    } catch {
      /* offline */
    }
    this.reachable = false;
    return { reachable: false, models: {} };
  }

  status(): MlStatus {
    return { reachable: this.reachable, models: this.statusCache };
  }

  private async call<T>(path: string, body: unknown): Promise<T | null> {
    if (!this.baseUrl || !this.reachable) return null;
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      this.reachable = false; // mark offline; a periodic refresh will recover it
      return null;
    }
  }

  async sentinelFast(text: string): Promise<SentinelFastResult> {
    const t0 = performance.now();
    const remote = await this.call<SentinelFastResult>('/sentinel-fast', { text });
    if (remote) return remote;
    return { ...hFast(text), latencyMs: Math.round(performance.now() - t0), source: 'heuristic' };
  }

  async sentinelReason(ctx: ReasonContext): Promise<SentinelReasonResult> {
    const t0 = performance.now();
    const remote = await this.call<SentinelReasonResult>('/sentinel-reason', ctx);
    if (remote) return remote;
    return { ...hReason(ctx), latencyMs: Math.round(performance.now() - t0), source: 'heuristic' };
  }

  async steward(ctx: StewardContext): Promise<StewardResult> {
    const t0 = performance.now();
    const remote = await this.call<StewardResult>('/steward', ctx);
    if (remote) return remote;
    return { ...hSteward(ctx), latencyMs: Math.round(performance.now() - t0), source: 'heuristic' };
  }

  async interrogator(ctx: ReasonContext) {
    const remote = await this.call<{ questions: string[]; verdict: string; note: string }>('/interrogator', ctx);
    if (remote) return remote;
    return hInterrogator(ctx);
  }

  async embed(texts: string[]): Promise<number[][]> {
    const remote = await this.call<{ vectors: number[][] }>('/embed', { texts });
    if (remote) return remote.vectors;
    return texts.map(localEmbed);
  }
}

/** Deterministic hashed bag-of-words embedding — a stand-in for MiniLM when serve is offline. */
export function localEmbed(text: string, dims = 64): number[] {
  const v = new Array(dims).fill(0);
  for (const tok of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) { h ^= tok.charCodeAt(i); h = Math.imul(h, 16777619); }
    v[Math.abs(h) % dims] += 1;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

export type { ReasonContext, StewardContext } from './heuristic.js';
