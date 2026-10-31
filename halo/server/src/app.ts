// Fastify app factory (used by index.ts and tests).
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { routes } from "./core/api.ts";
import { Halo, HttpError } from "./core/engine.ts";
import type { ModelClient } from "./core/models.ts";
import type { Store } from "./core/store.ts";
import { MockPay } from "../../sdk/payments/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const EVALS_DIR = join(ROOT, "ml", "evals", "results");

export function latestEvals() {
  const p = join(EVALS_DIR, "latest.json");
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  const files = existsSync(EVALS_DIR) ? readdirSync(EVALS_DIR).filter((f) => f.endsWith(".json")).sort() : [];
  return files.length ? JSON.parse(readFileSync(join(EVALS_DIR, files[files.length - 1]), "utf8")) : { status: "no_results", message: "Run `make eval` to produce results." };
}

export async function buildApp(opts: { store: Store; models: ModelClient; seed?: boolean; logger?: boolean }) {
  const halo = new Halo({ store: opts.store, models: opts.models, payments: new MockPay() });
  if (opts.seed !== false) halo.seedDemo();
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cors, { origin: [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/] });
  await app.register(websocket);

  for (const r of routes) {
    app.route({
      method: r.method, url: r.path,
      handler: async (req, reply) => {
        try {
          return await r.handler({ halo, params: req.params as any, body: req.body, query: req.query as any, evals: latestEvals });
        } catch (e: any) {
          const status = e instanceof HttpError ? e.status : 500;
          reply.code(status);
          return { error: e?.message ?? String(e) };
        }
      },
    });
  }

  app.get("/v1/stream", { websocket: true }, (socket, req) => {
    const userId = (req.query as any)?.user_id as string | undefined;
    const off = halo.on((e) => {
      if (userId && e.user_id && e.user_id !== userId) return;
      try { socket.send(JSON.stringify(e)); } catch { /* closed */ }
    });
    socket.send(JSON.stringify({ type: "hello", backend: halo.modelBackend }));
    socket.on("close", () => off());
  });
  return { app, halo };
}
