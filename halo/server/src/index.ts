import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { openDb, resetDb } from './db.js';
import { Bus } from './bus.js';
import { MlClient } from './ml/client.js';
import { Halo } from './core/halo.js';
import { buildApp } from './app.js';
import { seed } from './seed.js';
import type { RedTeamResult } from './scenarios/redteam.js';

const here = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.HALO_DB ?? resolve(here, '../../data/halo.db');
const ML_URL = process.env.HALO_ML_URL ?? 'http://127.0.0.1:8900';
const PORT = Number(process.env.PORT ?? 8820);
const HOST = process.env.HOST ?? '0.0.0.0';

async function main() {
  const fresh = !process.env.HALO_DB; // default demo DB is rebuilt each boot
  const db = openDb(DB_PATH);
  if (fresh) resetDb(db);
  const bus = new Bus();
  const ml = new MlClient(ML_URL);
  const halo = new Halo(db, ml, bus);

  seed(halo);
  await ml.refreshStatus();
  setInterval(() => void ml.refreshStatus().catch(() => {}), 10_000);

  let lastRedTeam: RedTeamResult | null = null;
  const app = await buildApp({
    halo,
    bus,
    ml,
    resetDemo: () => {
      resetDb(db);
      halo.resetState();
      seed(halo);
      lastRedTeam = null;
      bus.publish('demo.reset', { at: Date.now() });
    },
    lastRedTeam: () => lastRedTeam,
    setLastRedTeam: (r) => { lastRedTeam = r; },
  });

  await app.listen({ port: PORT, host: HOST });
  const status = ml.status();
  console.log(`\n  Halo server → http://localhost:${PORT}`);
  console.log(`  ML service  → ${status.reachable ? `connected (${ML_URL})` : `offline — using the built-in deterministic guardian engine (start ml/serve for real models)`}`);
  console.log(`  Models run on Halo's own servers. No closed AI providers.\n`);

  const shutdown = async () => { await app.close(); db.close(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => { console.error(e); process.exit(1); });
