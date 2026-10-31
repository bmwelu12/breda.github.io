import { buildApp } from "./app.ts";
import { HttpModelClient } from "./core/models.ts";
import { SqliteStore } from "./sqliteStore.ts";

const port = Number(process.env.PORT ?? 8787);
const mlUrl = process.env.HALO_ML_URL ?? "http://127.0.0.1:8100";
const { app } = await buildApp({ store: new SqliteStore(), models: new HttpModelClient(mlUrl), logger: false });
await app.listen({ port, host: "127.0.0.1" });
console.log(`[halo] API on http://127.0.0.1:${port}  (model service: ${mlUrl})`);
