// Append-only, SHA-256 hash-chained activity log + evidence snapshots.
// Halo keeps its own record; agent-supplied logs are stored only as "claims".
import { canonical, newId, sha256hex } from "./crypto.ts";
import type { ActivityEntry } from "./types.ts";
import type { Store } from "./store.ts";

export const GENESIS = "0".repeat(64);

export function entryHash(e: Omit<ActivityEntry, "hash">): string {
  return sha256hex(e.prev_hash + canonical({ seq: e.seq, ts: e.ts, type: e.type, actor: e.actor, user_id: e.user_id, data: e.data }));
}

export class ActivityLog {
  constructor(private store: Store) {}

  append(type: string, actor: string, user_id: string | null, data: Record<string, any>): ActivityEntry {
    const last = this.store.lastActivity();
    const base = { seq: (last?.seq ?? 0) + 1, ts: Date.now(), type, actor, user_id, data, prev_hash: last?.hash ?? GENESIS };
    const entry: ActivityEntry = { ...base, hash: entryHash(base) };
    this.store.appendActivity(entry);
    return entry;
  }

  list(user_id?: string): ActivityEntry[] {
    const all = this.store.activity();
    return user_id ? all.filter((e) => e.user_id === user_id || e.user_id === null) : all;
  }

  verify(): { ok: boolean; entries: number; head: string; broken_at: number | null; problem?: string } {
    const all = this.store.activity();
    let prev = GENESIS;
    for (let i = 0; i < all.length; i++) {
      const e = all[i];
      if (e.seq !== i + 1) return { ok: false, entries: all.length, head: prev, broken_at: e.seq, problem: "sequence gap or reorder" };
      if (e.prev_hash !== prev) return { ok: false, entries: all.length, head: prev, broken_at: e.seq, problem: "chain link broken" };
      const { hash, ...rest } = e;
      if (entryHash(rest) !== hash) return { ok: false, entries: all.length, head: prev, broken_at: e.seq, problem: "entry content changed" };
      prev = hash;
    }
    return { ok: true, entries: all.length, head: prev, broken_at: null };
  }

  /** Preserve evidence BEFORE any revoke/pause/remediation. Returns the snapshot id. */
  snapshot(reason: string, subject: string, user_id: string | null, payload: unknown): { id: string; hash: string } {
    const id = newId("ev");
    const body = canonical(payload);
    const hash = sha256hex(body);
    this.store.put("evidence", id, { id, ts: Date.now(), reason, subject, user_id, payload: JSON.parse(body), hash });
    this.append("evidence.snapshot", "halo", user_id, { evidence_id: id, reason, subject, sha256: hash });
    return { id, hash };
  }
}
