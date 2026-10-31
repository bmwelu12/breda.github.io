// The /v1 API as a route table, shared by the Fastify server and the standalone browser demo.
import type { Halo } from "./engine.ts";
import { HttpError } from "./engine.ts";
import { interrogationResponder, listScenarios, runScenario } from "./scenarios.ts";

export interface Ctx { halo: Halo; params: Record<string, string>; body: any; query: Record<string, string>; evals: () => any }
export interface Route { method: "GET" | "POST"; path: string; handler: (c: Ctx) => any }

const need = (v: any, name: string) => {
  if (v === undefined || v === null || v === "") throw new HttpError(400, `${name} is required`);
  return v;
};

export const routes: Route[] = [
  { method: "GET", path: "/v1/health", handler: async ({ halo }) => ({ ok: true, models: await halo.models.health().catch((e) => ({ ok: false, error: String(e) })) }) },

  // Business side
  { method: "POST", path: "/v1/businesses", handler: ({ halo, body }) => halo.createBusiness({ name: need(body?.name, "name"), domain: body.domain ?? "", official_callback: body.official_callback ?? "" }) },
  { method: "GET", path: "/v1/businesses", handler: ({ halo }) => halo.listBusinesses() },
  {
    method: "POST", path: "/v1/businesses/:id/agents",
    handler: ({ halo, params, body }) => {
      const { agent, credential } = halo.createAgent(params.id, { name: need(body?.name, "name"), phone_numbers: body.phone_numbers, contract: body.contract });
      return { agent: halo.publicAgent(agent), credential };
    },
  },
  { method: "POST", path: "/v1/businesses/:id/agents/:agentId/revoke", handler: ({ halo, params }) => halo.revokeAgentCredential(params.agentId) },
  { method: "POST", path: "/v1/business-sessions", handler: ({ halo, body }) => halo.businessStartLiveSession(need(body?.agent_id, "agent_id"), need(body?.inbound_id, "inbound_id")) },

  // Verification
  {
    method: "POST", path: "/v1/verify",
    handler: ({ halo, body }) => {
      const r = halo.verifyCredential(body?.credential);
      return { valid: r.valid, reason: r.reason, agent: r.agent ? halo.publicAgent(r.agent) : null, business: r.business ?? null };
    },
  },
  { method: "POST", path: "/v1/verify/live", handler: ({ halo, body }) => halo.verifyLive(need(body?.inbound_id, "inbound_id")) },
  { method: "GET", path: "/v1/authorization-notice", handler: ({ halo }) => halo.authorizationNotice() },

  // Inbound
  { method: "POST", path: "/v1/inbound", handler: ({ halo, body }) => halo.startInbound({ user_id: need(body?.user_id, "user_id"), channel: body.channel, caller_number: need(body.caller_number, "caller_number"), claimed: body.claimed, credential: body.credential }) },
  { method: "GET", path: "/v1/inbound", handler: ({ halo, query }) => halo.store.list<any>("inbound").filter((s) => !query.user_id || s.user_id === query.user_id).sort((a, b) => b.started_at - a.started_at) },
  { method: "GET", path: "/v1/inbound/:id", handler: ({ halo, params }) => halo.getInbound(params.id) },
  { method: "POST", path: "/v1/inbound/:id/lines", handler: ({ halo, params, body }) => halo.addLine(params.id, { speaker: body?.speaker ?? "caller", text: need(body?.text, "text") }) },
  { method: "POST", path: "/v1/inbound/:id/interrogate", handler: ({ halo, params }) => halo.interrogate(params.id, interrogationResponder(halo, params.id)) },
  { method: "POST", path: "/v1/inbound/:id/end", handler: ({ halo, params }) => halo.endInbound(params.id) },
  { method: "POST", path: "/v1/inbound/:id/save", handler: ({ halo, params }) => halo.saveTranscript(params.id) },

  // Intelligence
  { method: "POST", path: "/v1/reports", handler: ({ halo, body }) => halo.report(need(body?.inbound_id, "inbound_id")) },
  { method: "GET", path: "/v1/campaigns", handler: async ({ halo }) => halo.detectSwarms() },

  // Outbound
  { method: "POST", path: "/v1/personal-agents", handler: ({ halo, body }) => halo.createPersonalAgent(need(body?.user_id, "user_id"), body.name ?? "Personal agent") },
  { method: "GET", path: "/v1/personal-agents", handler: ({ halo, query }) => halo.store.list<any>("personal_agents").filter((a) => !query.user_id || a.user_id === query.user_id) },
  { method: "POST", path: "/v1/personal-agents/pause-all", handler: ({ halo, body }) => halo.pauseAll(need(body?.user_id, "user_id")) },
  { method: "POST", path: "/v1/personal-agents/:id/revoke", handler: ({ halo, params }) => halo.revokePersonalAgent(params.id) },
  { method: "POST", path: "/v1/personal-agents/:id/resume", handler: ({ halo, params }) => halo.resumeAgent(params.id) },
  { method: "POST", path: "/v1/personal-agents/:id/request", handler: ({ halo, params, body }) => halo.setRequest(params.id, need(body?.request, "request")) },
  { method: "POST", path: "/v1/personal-actions/authorize", handler: ({ halo, body }) => halo.authorize({ agent_id: need(body?.agent_id, "agent_id"), tool: need(body.tool, "tool"), args: body.args ?? {}, context: body.context, user_request: body.user_request }) },
  { method: "GET", path: "/v1/personal-actions", handler: ({ halo, query }) => halo.store.list<any>("actions").filter((a) => !query.user_id || a.user_id === query.user_id).sort((a, b) => b.ts - a.ts) },
  { method: "POST", path: "/v1/approvals/:id", handler: ({ halo, params, body }) => halo.decideApproval(params.id, need(body?.decision, "decision") === "approve") },

  // Users / controls
  { method: "GET", path: "/v1/users/:id", handler: ({ halo, params }) => halo.getUser(params.id) },
  { method: "POST", path: "/v1/users/:id/controls", handler: ({ halo, params, body }) => halo.updateControls(params.id, body ?? {}) },
  { method: "POST", path: "/v1/users/:id/protection", handler: ({ halo, params, body }) => halo.setProtection(params.id, body?.level === "high" ? "high" : "standard") },

  // Red team, review, evals, scenarios
  { method: "POST", path: "/v1/redteam/run", handler: ({ halo, body }) => halo.runRedTeam(Math.min(50, Number(body?.n ?? 10))) },
  { method: "GET", path: "/v1/redteam/scoreboard", handler: ({ halo }) => halo.scoreboard() },
  { method: "GET", path: "/v1/review", handler: ({ halo }) => halo.listReview() },
  { method: "POST", path: "/v1/review", handler: ({ halo, body }) => halo.addReview(need(body?.model, "model"), body.source ?? "manual", need(body.example, "example")) },
  { method: "POST", path: "/v1/review/:id", handler: ({ halo, params, body }) => halo.decideReview(params.id, need(body?.action, "action"), body.example, body.note) },
  { method: "GET", path: "/v1/evals/latest", handler: ({ evals }) => evals() },
  { method: "GET", path: "/v1/scenarios", handler: () => listScenarios() },
  { method: "POST", path: "/v1/scenarios/:id/run", handler: ({ halo, params, body }) => { void runScenario(halo, params.id, { delayMs: body?.delay_ms }).catch((e) => halo.emit({ type: "scenario.error", scenario: params.id, error: String(e) })); return { started: params.id }; } },

  // Records & privacy
  { method: "GET", path: "/v1/activity", handler: ({ halo, query }) => halo.log.list(query.user_id).slice(-Number(query.limit ?? 200)) },
  { method: "GET", path: "/v1/activity/verify", handler: ({ halo }) => halo.log.verify() },
  { method: "GET", path: "/v1/privacy/my-data", handler: ({ halo, query }) => halo.myData(query.user_id ?? "maya") },
];

/** Minimal path matcher for the browser demo. */
export function matchRoute(method: string, path: string): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const a = route.path.split("/"), b = path.split("/");
    if (a.length !== b.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < a.length; i++) {
      if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
      else if (a[i] !== b[i]) { ok = false; break; }
    }
    if (ok) return { route, params };
  }
  return null;
}
