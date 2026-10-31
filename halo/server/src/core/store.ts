// Storage abstraction: SQLite on the server (see ../sqliteStore.ts), memory in the standalone browser demo.
import type { ActivityEntry } from "./types.ts";

export interface Store {
  get<T>(col: string, id: string): T | undefined;
  put<T>(col: string, id: string, doc: T): void;
  del(col: string, id: string): void;
  list<T>(col: string): T[];
  /** Append-only. Implementations must not offer update/delete. */
  appendActivity(e: ActivityEntry): void;
  activity(): ActivityEntry[];
  lastActivity(): ActivityEntry | undefined;
  meta(key: string): string | undefined;
  setMeta(key: string, value: string): void;
}

export class MemoryStore implements Store {
  private cols = new Map<string, Map<string, string>>();
  private log: ActivityEntry[] = [];
  private kv = new Map<string, string>();
  private col(c: string) {
    if (!this.cols.has(c)) this.cols.set(c, new Map());
    return this.cols.get(c)!;
  }
  get<T>(c: string, id: string) {
    const v = this.col(c).get(id);
    return v === undefined ? undefined : (JSON.parse(v) as T);
  }
  put<T>(c: string, id: string, doc: T) { this.col(c).set(id, JSON.stringify(doc)); }
  del(c: string, id: string) { this.col(c).delete(id); }
  list<T>(c: string) { return [...this.col(c).values()].map((v) => JSON.parse(v) as T); }
  appendActivity(e: ActivityEntry) { this.log.push(JSON.parse(JSON.stringify(e))); }
  activity() { return this.log.map((e) => ({ ...e, data: JSON.parse(JSON.stringify(e.data)) })); }
  lastActivity() { return this.log[this.log.length - 1]; }
  meta(k: string) { return this.kv.get(k); }
  setMeta(k: string, v: string) { this.kv.set(k, v); }
  /** Test hook only: simulates an attacker editing storage directly. */
  _tamper(seq: number, patch: Partial<ActivityEntry>) { Object.assign(this.log[seq - 1], patch); }
}
