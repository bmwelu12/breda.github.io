import type { DB } from '../db.js';
import type { ActivityLog } from './activity.js';
import { canonicalJson, id, sha256 } from '../util.js';

/**
 * Preserve evidence before fixing. Halo snapshots the full state of a session or action
 * (hashed) before any revoke or remediation, so the record survives even if the thing it
 * describes is later changed.
 */
export class EvidenceStore {
  constructor(private db: DB, private activity: ActivityLog) {}

  snapshot(kind: string, refId: string | null, snapshot: unknown, actor = 'halo'): { id: string; sha256: string } {
    const eid = id('evd');
    const body = canonicalJson(snapshot);
    const digest = sha256(body);
    const ts = Date.now();
    this.db.prepare('INSERT INTO evidence (id, kind, ref_id, snapshot, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(eid, kind, refId, body, digest, ts);
    this.activity.append({
      type: 'evidence.snapshot',
      actor,
      subject: refId,
      summary: `Evidence preserved before remediation (${kind})`,
      payload: { evidenceId: eid, kind, refId, sha256: digest },
      ts,
    });
    return { id: eid, sha256: digest };
  }

  get(eid: string) {
    const r = this.db.prepare('SELECT * FROM evidence WHERE id = ?').get(eid) as any;
    return r ? { id: r.id, kind: r.kind, refId: r.ref_id, snapshot: JSON.parse(r.snapshot), sha256: r.sha256, createdAt: r.created_at } : null;
  }

  list(limit = 100) {
    return (this.db.prepare('SELECT id, kind, ref_id, sha256, created_at FROM evidence ORDER BY created_at DESC LIMIT ?').all(limit) as any[]).map((r) => ({
      id: r.id, kind: r.kind, refId: r.ref_id, sha256: r.sha256, createdAt: r.created_at,
    }));
  }
}
