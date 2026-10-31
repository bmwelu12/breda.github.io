// SQLite persistence (better-sqlite3). The activity table is append-only, enforced by triggers.
import Database from "better-sqlite3";
import type { Store } from "./core/store.ts";
import type { ActivityEntry } from "./core/types.ts";

export class SqliteStore implements Store {
  db: Database.Database;
  constructor(path = process.env.HALO_DB ?? "halo.db") {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (col, id));
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS activity (seq INTEGER PRIMARY KEY, ts INTEGER NOT NULL, type TEXT NOT NULL, actor TEXT NOT NULL,
        user_id TEXT, data TEXT NOT NULL, prev_hash TEXT NOT NULL, hash TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS activity_no_update BEFORE UPDATE ON activity BEGIN SELECT RAISE(ABORT, 'activity log is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS activity_no_delete BEFORE DELETE ON activity BEGIN SELECT RAISE(ABORT, 'activity log is append-only'); END;
    `);
  }
  get<T>(col: string, id: string) {
    const r = this.db.prepare("SELECT json FROM docs WHERE col=? AND id=?").get(col, id) as { json: string } | undefined;
    return r ? (JSON.parse(r.json) as T) : undefined;
  }
  put<T>(col: string, id: string, doc: T) { this.db.prepare("INSERT OR REPLACE INTO docs (col,id,json) VALUES (?,?,?)").run(col, id, JSON.stringify(doc)); }
  del(col: string, id: string) { this.db.prepare("DELETE FROM docs WHERE col=? AND id=?").run(col, id); }
  list<T>(col: string) { return (this.db.prepare("SELECT json FROM docs WHERE col=? ORDER BY rowid").all(col) as { json: string }[]).map((r) => JSON.parse(r.json) as T); }
  appendActivity(e: ActivityEntry) {
    this.db.prepare("INSERT INTO activity (seq,ts,type,actor,user_id,data,prev_hash,hash) VALUES (?,?,?,?,?,?,?,?)")
      .run(e.seq, e.ts, e.type, e.actor, e.user_id, JSON.stringify(e.data), e.prev_hash, e.hash);
  }
  private row(r: any): ActivityEntry { return { ...r, data: JSON.parse(r.data) }; }
  activity() { return (this.db.prepare("SELECT * FROM activity ORDER BY seq").all() as any[]).map((r) => this.row(r)); }
  lastActivity() { const r = this.db.prepare("SELECT * FROM activity ORDER BY seq DESC LIMIT 1").get(); return r ? this.row(r) : undefined; }
  meta(k: string) { return (this.db.prepare("SELECT v FROM meta WHERE k=?").get(k) as { v: string } | undefined)?.v; }
  setMeta(k: string, v: string) { this.db.prepare("INSERT OR REPLACE INTO meta (k,v) VALUES (?,?)").run(k, v); }
}
