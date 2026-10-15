import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, type DB } from '../db.js';
import { ActivityLog, GENESIS } from '../core/activity.js';

let db: DB;
let log: ActivityLog;
beforeEach(() => { db = openDb(':memory:'); log = new ActivityLog(db); });

describe('hash-chained activity log (never trust agent-supplied logs)', () => {
  it('links each event to the previous', () => {
    const a = log.append({ type: 'x', actor: 'halo', summary: 'one', payload: { n: 1 } });
    const b = log.append({ type: 'x', actor: 'halo', summary: 'two', payload: { n: 2 } });
    expect(a.prevHash).toBe(GENESIS);
    expect(b.prevHash).toBe(a.hash);
  });
  it('verifies an intact chain', () => {
    for (let i = 0; i < 15; i++) log.append({ type: 'x', actor: 'a', summary: `e${i}`, payload: { i } });
    expect(log.verify().ok).toBe(true);
  });
  it('detects a row edited directly in SQLite', () => {
    for (let i = 0; i < 8; i++) log.append({ type: 'action.blocked', actor: 'a', summary: `block ${i}`, payload: { decision: 'block' } });
    db.prepare("UPDATE activity SET summary = 'tampered' WHERE seq = 4").run();
    const r = log.verify();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.brokenAt).toBe(4);
  });
  it('detects a deleted row', () => {
    for (let i = 0; i < 5; i++) log.append({ type: 'x', actor: 'a', summary: `e${i}`, payload: {} });
    db.prepare('DELETE FROM activity WHERE seq = 3').run();
    const r = log.verify();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.brokenAt).toBe(3);
  });
});
