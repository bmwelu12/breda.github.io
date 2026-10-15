import type { DB } from '../db.js';
import { canonicalJson, sha256 } from '../util.js';

export const GENESIS = '0'.repeat(64);

export interface ActivityEvent {
  seq: number;
  ts: number;
  type: string;
  actor: string;
  subject: string | null;
  summary: string;
  payload: unknown;
  prevHash: string;
  hash: string;
}

export interface ActivityInput {
  type: string;
  actor: string;
  subject?: string | null;
  summary: string;
  payload?: unknown;
  ts?: number;
}

export function hashEvent(prevHash: string, e: Omit<ActivityEvent, 'hash' | 'prevHash'>): string {
  return sha256(
    prevHash +
      canonicalJson({ seq: e.seq, ts: e.ts, type: e.type, actor: e.actor, subject: e.subject, summary: e.summary, payload: e.payload }),
  );
}

export type VerifyResult =
  | { ok: true; count: number; headHash: string; checkedAt: number }
  | { ok: false; count: number; brokenAt: number; reason: string; checkedAt: number };

/**
 * Halo's own tamper-evident record. Agents faked tool outputs and edited logs during the 2026
 * incidents, so Halo never trusts agent-supplied logs — it keeps this hash chain instead.
 */
export class ActivityLog {
  private head: { seq: number; hash: string };
  private stmt;

  constructor(private db: DB) {
    this.head = this.readHead();
    this.stmt = db.prepare(
      `INSERT INTO activity (seq, ts, type, actor, subject, summary, payload, prev_hash, hash)
       VALUES (@seq, @ts, @type, @actor, @subject, @summary, @payload, @prevHash, @hash)`,
    );
  }

  private readHead() {
    const r = this.db.prepare('SELECT seq, hash FROM activity ORDER BY seq DESC LIMIT 1').get() as { seq: number; hash: string } | undefined;
    return r ?? { seq: 0, hash: GENESIS };
  }
  reload() {
    this.head = this.readHead();
  }

  append(input: ActivityInput): ActivityEvent {
    const base = {
      seq: this.head.seq + 1,
      ts: input.ts ?? Date.now(),
      type: input.type,
      actor: input.actor,
      subject: input.subject ?? null,
      summary: input.summary,
      payload: JSON.parse(JSON.stringify(input.payload ?? {})),
    };
    const prevHash = this.head.hash;
    const hash = hashEvent(prevHash, base);
    this.stmt.run({ ...base, payload: canonicalJson(base.payload), prevHash, hash });
    this.head = { seq: base.seq, hash };
    return { ...base, prevHash, hash };
  }

  verify(): VerifyResult {
    const rows = this.db.prepare('SELECT * FROM activity ORDER BY seq ASC').iterate() as Iterable<any>;
    let prevHash = GENESIS;
    let expected = 1;
    let count = 0;
    const checkedAt = Date.now();
    for (const r of rows) {
      count++;
      if (r.seq !== expected) return { ok: false, count, brokenAt: expected, reason: `Event #${expected} is missing (deleted row)`, checkedAt };
      if (r.prev_hash !== prevHash) return { ok: false, count, brokenAt: r.seq, reason: `Event #${r.seq} does not link to #${r.seq - 1}`, checkedAt };
      let payload: unknown;
      try { payload = JSON.parse(r.payload); } catch { return { ok: false, count, brokenAt: r.seq, reason: `Event #${r.seq} payload corrupt`, checkedAt }; }
      const recomputed = hashEvent(prevHash, { seq: r.seq, ts: r.ts, type: r.type, actor: r.actor, subject: r.subject, summary: r.summary, payload });
      if (recomputed !== r.hash) return { ok: false, count, brokenAt: r.seq, reason: `Event #${r.seq} content was modified after it was written`, checkedAt };
      prevHash = r.hash;
      expected++;
    }
    return { ok: true, count, headHash: prevHash, checkedAt };
  }

  list(filter: { type?: string; q?: string; limit?: number; offset?: number } = {}) {
    const where: string[] = [];
    const args: unknown[] = [];
    if (filter.type) { where.push('type LIKE ?'); args.push(`${filter.type}%`); }
    if (filter.q) { where.push('(summary LIKE ? OR payload LIKE ? OR actor LIKE ?)'); args.push(`%${filter.q}%`, `%${filter.q}%`, `%${filter.q}%`); }
    const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (this.db.prepare(`SELECT COUNT(*) c FROM activity ${sql}`).get(...args) as any).c;
    const rows = this.db.prepare(`SELECT * FROM activity ${sql} ORDER BY seq DESC LIMIT ? OFFSET ?`).all(...args, Math.min(filter.limit ?? 150, 1000), filter.offset ?? 0);
    return { total, events: rows.map(rowToEvent) };
  }
}

export function rowToEvent(r: any): ActivityEvent {
  return { seq: r.seq, ts: r.ts, type: r.type, actor: r.actor, subject: r.subject, summary: r.summary, payload: JSON.parse(r.payload), prevHash: r.prev_hash, hash: r.hash };
}
