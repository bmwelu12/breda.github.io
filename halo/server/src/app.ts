import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { z } from 'zod';
import { HttpError, type Halo } from './core/halo.js';
import type { Bus } from './bus.js';
import type { MlClient } from './ml/client.js';
import { inboundCatalog, outboundCatalog, runInboundScenario, runOutboundScenario, runSwarmScenario } from './scenarios/runner.js';
import { runRedTeam, type RedTeamResult } from './scenarios/redteam.js';
import { loadEvalResults } from './evals.js';

export interface AppDeps {
  halo: Halo;
  bus: Bus;
  ml: MlClient;
  resetDemo: () => void;
  lastRedTeam: () => RedTeamResult | null;
  setLastRedTeam: (r: RedTeamResult) => void;
}

const bearer = (h?: string) => (h?.startsWith('Bearer ') ? h.slice(7) : h) ?? null;

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { halo, bus, ml } = deps;
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof z.ZodError) return reply.status(400).send({ error: 'invalid_request', message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    const status = err instanceof HttpError ? err.statusCode : (err.statusCode ?? 500);
    if (status >= 500) console.error(err);
    reply.status(status).send({ error: status >= 500 ? 'internal_error' : 'request_failed', message: err.message });
  });

  app.get('/v1/stream', { websocket: true }, (socket) => {
    const off = bus.onStream((e) => socket.readyState === 1 && socket.send(JSON.stringify(e)));
    socket.send(JSON.stringify({ type: 'hello', data: { ml: ml.status() }, ts: Date.now() }));
    socket.on('close', off);
  });

  // ── Meta / status ───────────────────────────────────────────────────────────
  app.get('/v1/status', async () => ({
    org: 'Halo',
    ml: ml.status(),
    businesses: halo.listBusinesses().length,
    agents: halo.listAgents().length,
    note: 'Models run on Halo\'s own servers. No closed AI providers. No user data leaves Halo.',
  }));
  app.get('/v1/authorization-notice', async () => halo.authorizationNotice());
  app.get('/v1/privacy/my-data', async (req) => halo.myData((req.query as any)?.userId ?? 'user_primary'));

  // ── Businesses & agents ──────────────────────────────────────────────────────
  app.post('/v1/businesses', async (req, reply) => {
    const b = z.object({ name: z.string().min(2), domain: z.string().min(3), category: z.string().min(2) }).parse(req.body);
    reply.status(201).send(halo.registerBusiness(b));
  });
  app.get('/v1/businesses', async () => halo.listBusinesses().map((b) => ({ ...b, agents: halo.listAgents(b.id) })));
  app.post('/v1/businesses/:id/agents', async (req, reply) => {
    const body = z.object({
      displayName: z.string().min(2),
      purpose: z.string().min(3),
      channels: z.array(z.enum(['call', 'sms', 'email', 'chat'])).optional(),
      contract: z.object({
        mayRequest: z.array(z.string()).optional(),
        neverRequest: z.array(z.string()).optional(),
        maxAmount: z.number().optional(),
        callbackNumber: z.string().optional(),
        jurisdictions: z.array(z.string()).optional(),
      }).optional(),
    }).parse(req.body);
    const { agent, credential } = halo.registerAgent((req.params as any).id, body as any);
    reply.status(201).send({ agent, credential });
  });
  app.get('/v1/agents', async () => halo.listAgents());

  // ── Verification ─────────────────────────────────────────────────────────────
  app.post('/v1/verify', async (req) => {
    const b = z.object({ claimedBusiness: z.string(), claimedAgentId: z.string().optional(), credential: z.string().optional() }).parse(req.body);
    return halo.verify(b);
  });
  app.post('/v1/verify/live', async (req) => {
    const b = z.object({ sessionId: z.string(), code: z.string() }).parse(req.body);
    return halo.liveVerify(b.sessionId, b.code);
  });

  // ── Inbound ──────────────────────────────────────────────────────────────────
  app.post('/v1/inbound', async (req, reply) => {
    const b = z.object({
      channel: z.enum(['call', 'sms', 'email', 'chat']).default('call'),
      claimedBusiness: z.string().nullable().optional(),
      claimedAgentId: z.string().optional(),
      credential: z.string().optional(),
      userId: z.string().optional(),
      scenario: z.string().optional(),
    }).parse(req.body ?? {});
    reply.status(201).send(halo.startInbound({ ...b, claimedBusiness: b.claimedBusiness ?? null }));
  });
  app.get('/v1/inbound', async () => halo.listInbound());
  app.get('/v1/inbound/:id', async (req) => {
    const s = halo.getInbound((req.params as any).id);
    if (!s) throw new HttpError(404, 'Session not found');
    return s;
  });
  app.post('/v1/inbound/:id/line', async (req) => {
    const b = z.object({ speaker: z.enum(['agent', 'user']).default('agent'), text: z.string().min(1) }).parse(req.body);
    return halo.pushLine((req.params as any).id, b.speaker, b.text);
  });
  app.post('/v1/inbound/:id/interrogate', async (req) => halo.interrogate((req.params as any).id));
  app.post('/v1/inbound/:id/end', async (req) => { halo.endInbound((req.params as any).id); return { ok: true }; });

  // ── Reports & campaigns ──────────────────────────────────────────────────────
  app.post('/v1/reports', async (req) => {
    const b = z.object({ sessionId: z.string().optional(), reporterId: z.string().optional() }).parse(req.body ?? {});
    return halo.report(b);
  });
  app.get('/v1/campaigns', async () => halo.swarm.list());

  // ── Personal agents (outbound) ───────────────────────────────────────────────
  app.post('/v1/personal-agents', async (req, reply) => {
    const b = z.object({ userId: z.string().optional(), name: z.string().min(2), model: z.string().default('Qwen2.5-3B-Instruct (open)'), task: z.string().min(2) }).parse(req.body);
    reply.status(201).send(halo.registerPersonalAgent(b));
  });
  app.get('/v1/personal-agents', async (req) => halo.listPersonalAgents((req.query as any)?.userId));
  app.post('/v1/personal-agents/:id/revoke', async (req) => ({ agent: halo.revokePersonalAgent((req.params as any).id, (req.body as any)?.actor ?? 'user_primary') }));
  app.post('/v1/personal-agents/:id/pause', async (req) => ({ agent: halo.pausePersonalAgent((req.params as any).id, (req.body as any)?.actor ?? 'user_primary', (req.body as any)?.reason ?? 'paused') }));
  app.post('/v1/personal-agents/pause-all', async (req) => ({ paused: halo.pauseAll((req.body as any)?.userId ?? 'user_primary', (req.body as any)?.actor ?? 'user_primary') }));

  app.post('/v1/personal-actions/authorize', async (req) => {
    const b = z.object({
      agentId: z.string(), tool: z.string(), params: z.record(z.unknown()).optional(),
      amount: z.number().nullable().optional(), userRequest: z.string().optional(), sourceText: z.string().optional(), credential: z.string().optional(),
    }).parse(req.body);
    const token = bearer((req.headers as any).authorization) ?? b.credential ?? null;
    const a = await halo.authorizeAction(token, b);
    return { actionId: a.id, verdict: a.verdict, status: a.status, reason: a.reason, overrodeModel: a.guardrails.some((g) => g.severity === 'block') && a.steward?.verdict !== 'block', guardrails: a.guardrails, steward: a.steward };
  });
  app.get('/v1/personal-actions', async (req) => halo.listActions((req.query as any)?.userId, Number((req.query as any)?.limit ?? 100)));
  app.get('/v1/personal-actions/:id', async (req) => {
    const a = halo.getAction((req.params as any).id);
    if (!a) throw new HttpError(404, 'Action not found');
    return { ...a, actionId: a.id, overrodeModel: false };
  });
  app.get('/v1/approvals', async (req) => halo.listApprovals((req.query as any)?.userId));
  app.post('/v1/approvals/:id', async (req) => {
    const b = z.object({ decision: z.enum(['approve', 'reject']), actor: z.string().default('user_primary') }).parse(req.body);
    return halo.resolveApproval((req.params as any).id, b.decision, b.actor);
  });

  // ── Preferences ──────────────────────────────────────────────────────────────
  app.get('/v1/preferences', async (req) => halo.getPrefs((req.query as any)?.userId ?? 'user_primary'));
  app.post('/v1/preferences', async (req) => {
    const b = z.object({
      userId: z.string().default('user_primary'),
      alwaysAsk: z.array(z.string()).optional(),
      quietHours: z.object({ start: z.number(), end: z.number() }).nullable().optional(),
      blockedCategories: z.array(z.string()).optional(),
      highProtection: z.boolean().optional(),
    }).parse(req.body);
    const { userId, ...rest } = b;
    return halo.setPrefs(userId, rest);
  });

  // ── Activity log ─────────────────────────────────────────────────────────────
  app.get('/v1/activity', async (req) => {
    const q = req.query as any;
    return halo.activity.list({ type: q.type, q: q.q, limit: q.limit ? Number(q.limit) : 150, offset: q.offset ? Number(q.offset) : 0 });
  });
  app.get('/v1/activity/verify', async () => halo.activity.verify());
  app.get('/v1/evidence', async () => halo.evidence.list());
  app.get('/v1/evidence/:id', async (req) => halo.evidence.get((req.params as any).id) ?? { error: 'not found' });

  // ── Scenarios ────────────────────────────────────────────────────────────────
  app.get('/v1/scenarios', async () => ({ inbound: inboundCatalog(), outbound: outboundCatalog() }));
  app.post('/v1/scenarios/inbound/:id/run', async (req) => runInboundScenario(halo, (req.params as any).id));
  app.post('/v1/scenarios/outbound/:id/run', async (req) => runOutboundScenario(halo, (req.params as any).id));
  app.post('/v1/scenarios/swarm/run', async () => runSwarmScenario(halo, bus));

  // ── Red Team ─────────────────────────────────────────────────────────────────
  app.post('/v1/redteam/run', async (req) => {
    const count = Number((req.body as any)?.count ?? 10);
    const r = await runRedTeam(halo, bus, Math.min(Math.max(count, 1), 30));
    deps.setLastRedTeam(r);
    return r;
  });
  app.get('/v1/redteam/latest', async () => deps.lastRedTeam());

  // ── Evals ────────────────────────────────────────────────────────────────────
  app.get('/v1/evals', async () => loadEvalResults());

  // ── Demo controls ────────────────────────────────────────────────────────────
  app.post('/v1/demo/reset', async () => { deps.resetDemo(); return { ok: true }; });
  app.post('/v1/demo/tamper', async () => {
    const row = halo.db.prepare("SELECT seq, summary FROM activity WHERE type LIKE 'action.%' OR type LIKE 'inbound.%' ORDER BY seq DESC LIMIT 1 OFFSET 2").get() as any
      ?? halo.db.prepare('SELECT seq, summary FROM activity ORDER BY seq DESC LIMIT 1 OFFSET 3').get() as any;
    if (!row) throw new HttpError(409, 'Not enough activity to tamper with yet');
    halo.db.prepare("UPDATE activity SET summary = REPLACE(summary, 'BLOCK', 'ALLOW') WHERE seq = ?").run(row.seq);
    halo.db.prepare("UPDATE activity SET summary = ? WHERE seq = ?").run(row.summary + ' [edited]', row.seq);
    return { tamperedSeq: row.seq, note: 'Row edited directly in SQLite. Run the integrity check.' };
  });

  return app;
}
