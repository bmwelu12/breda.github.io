import { createHash, randomBytes } from 'node:crypto';

export const now = () => Date.now();
export const id = (prefix: string) => `${prefix}_${randomBytes(6).toString('hex')}`;
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round = (v: number, n = 1) => { const f = 10 ** n; return Math.round(v * f) / f; };

/** Deterministic JSON (keys sorted recursively) — the material that gets hashed. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as object).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = sortKeys(v);
    }
    return out;
  }
  return value;
}

/** A short, stable, non-reversible fingerprint for shared intelligence (hashed identifiers only). */
export function fingerprint(...parts: string[]): string {
  return sha256(parts.map((p) => p.trim().toLowerCase()).join('|')).slice(0, 16);
}

export const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
