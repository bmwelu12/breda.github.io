import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT NOT NULL, category TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, business_name TEXT NOT NULL,
  display_name TEXT NOT NULL, purpose TEXT NOT NULL, channels TEXT NOT NULL,
  contract TEXT NOT NULL, credential_id TEXT, status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY, subject TEXT NOT NULL, kind TEXT NOT NULL,
  issued_at INTEGER NOT NULL, revoked_at INTEGER, revoked_reason TEXT
);

CREATE TABLE IF NOT EXISTS inbound (
  id TEXT PRIMARY KEY, data TEXT NOT NULL, risk REAL NOT NULL, status TEXT NOT NULL,
  campaign_id TEXT, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_agents (
  id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_actions (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, user_id TEXT NOT NULL, data TEXT NOT NULL,
  status TEXT NOT NULL, ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, ref_id TEXT, snapshot TEXT NOT NULL,
  sha256 TEXT NOT NULL, created_at INTEGER NOT NULL
);

-- Append-only, hash-chained activity log (never trust agent-supplied logs).
CREATE TABLE IF NOT EXISTS activity (
  seq INTEGER PRIMARY KEY, ts INTEGER NOT NULL, type TEXT NOT NULL, actor TEXT NOT NULL,
  subject TEXT, summary TEXT NOT NULL, payload TEXT NOT NULL,
  prev_hash TEXT NOT NULL, hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity(ts);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity(type);
`;

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(SCHEMA);
  return db;
}

export function resetDb(db: DB) {
  db.exec(`DELETE FROM businesses; DELETE FROM agents; DELETE FROM credentials; DELETE FROM inbound;
           DELETE FROM reports; DELETE FROM campaigns; DELETE FROM personal_agents;
           DELETE FROM personal_actions; DELETE FROM evidence; DELETE FROM activity;`);
}
