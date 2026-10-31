// Scenario runner: drives simulated callers and the simulated personal agent through the engine.
// No real calls, SMS or payments: everything here is simulated.
import data from "../../../scenarios/scenarios.json";
import type { Halo } from "./engine.ts";
import { HttpError, sleep } from "./engine.ts";
import type { AgentRecord, Turn } from "./types.ts";

export interface Scenario { id: string; title: string; kind: string; group: string; hidden?: boolean; [k: string]: any }
export const SCENARIOS: Scenario[] = (data as any).scenarios;

export function listScenarios() {
  return SCENARIOS.filter((s) => !s.hidden).map(({ id, title, kind, group, user, case: c }) => ({ id, title, kind, group, user, case: c }));
}

function credentialFor(halo: Halo, sc: Scenario): string | undefined {
  const mode = sc.caller?.credential;
  if (!mode || mode === "none") return undefined;
  const name = sc.caller.agent_name ?? sc.caller.claimed?.agent_name;
  const agent = halo.store.list<AgentRecord>("agents").find((a) => a.name === name) ?? halo.store.list<AgentRecord>("agents")[0];
  if (mode === "valid") return agent.credential;
  if (mode === "forged") return agent.credential.slice(0, -6) + "AAAAAA";
  return agent.credential;
}

export async function runScenario(halo: Halo, id: string, opts: { delayMs?: number } = {}) {
  const sc = SCENARIOS.find((s) => s.id === id);
  if (!sc) throw new HttpError(404, "scenario not found");
  const delay = opts.delayMs ?? 1200;
  halo.emit({ type: "scenario.started", scenario: sc.id, title: sc.title, user_id: sc.user ?? null });

  if (sc.kind === "inbound") {
    const s = await runInboundCall(halo, sc, sc.user, sc.caller, sc.script, delay);
    halo.emit({ type: "scenario.finished", scenario: sc.id, inbound_id: s.id, user_id: sc.user });
    return { scenario: sc.id, inbound_id: s.id };
  }

  if (sc.kind === "swarm") {
    const ids: string[] = [];
    // Several callers hit several users within minutes; run them interleaved.
    await Promise.all(sc.calls.map(async (c: any, i: number) => {
      await sleep(i * Math.max(150, delay / 3));
      const s = await runInboundCall(halo, sc, c.user, { ...c.caller, credential: "none" }, c.script.map((t: string) => ({ speaker: "caller", text: t })), Math.max(100, delay / 2));
      ids.push(s.id);
    }));
    const campaigns = await halo.detectSwarms();
    halo.emit({ type: "scenario.finished", scenario: sc.id, inbound_ids: ids, campaigns });
    return { scenario: sc.id, inbound_ids: ids, campaigns };
  }

  if (sc.kind === "outbound") {
    const agent = halo.store.list<any>("personal_agents").find((a) => a.user_id === sc.user && a.status !== "revoked") ?? halo.createPersonalAgent(sc.user, "Personal agent");
    if (agent.status === "paused") halo.resumeAgent(agent.id);
    if (agent.autonomy === "reduced") { agent.autonomy = "normal"; halo.store.put("personal_agents", agent.id, agent); }
    if (sc.controls) halo.updateControls(sc.user, sc.controls);
    halo.setRequest(agent.id, sc.request);
    const decisions = [];
    for (const step of sc.steps) {
      await sleep(sc.id === "runaway" ? Math.min(delay, 250) : delay);
      const d = await halo.authorize({ agent_id: agent.id, tool: step.tool, args: step.args, context: step.context, user_request: sc.request });
      decisions.push(d);
      if (halo.getPersonalAgent(agent.id).status !== "active") break;
    }
    if (sc.controls) halo.updateControls(sc.user, { always_ask: ["send_money", "recurring", "share_personal_data", "delete", "email_new"] });
    halo.emit({ type: "scenario.finished", scenario: sc.id, user_id: sc.user, decisions: decisions.map((d) => d.id) });
    return { scenario: sc.id, agent_id: agent.id, decisions };
  }

  if (sc.kind === "redteam") {
    const round = await halo.runRedTeam(sc.n ?? 10);
    halo.emit({ type: "scenario.finished", scenario: sc.id, round_id: round.id });
    return { scenario: sc.id, round };
  }
  throw new HttpError(400, "unknown scenario kind");
}

async function runInboundCall(halo: Halo, sc: Scenario, user: string, caller: any, script: Turn[], delay: number) {
  const s = halo.startInbound({ user_id: user, caller_number: caller.number, claimed: caller.claimed, credential: credentialFor(halo, { ...sc, caller }), scenario: sc.id });
  if (sc.live_session && s.agent_id) {
    const live = halo.businessStartLiveSession(s.agent_id, s.id);
    const cur = halo.getInbound(s.id);
    cur.verification_code = live.code;
    halo.store.put("inbound", cur.id, cur);
  }
  const callerScript = script.filter((t) => t.speaker !== "user").map((t) => t.text);
  const history: Turn[] = [];
  for (const t of script) {
    await sleep(delay);
    if (halo.getInbound(s.id).ended) break;
    let text = t.text;
    if (t.speaker !== "user") {
      // An open model plays the caller (stub backend returns the scripted line).
      try { text = (await halo.models.roleplay({ ...caller.claimed, scenario: sc.id }, history, callerScript)) || t.text; } catch { text = t.text; }
    }
    history.push({ speaker: t.speaker === "caller2" ? "caller" : t.speaker, text });
    await halo.addLine(s.id, { speaker: t.speaker, text });
  }
  return halo.getInbound(s.id);
}

/** Simulated caller agent answering Halo's Interrogator. */
export function interrogationResponder(halo: Halo, inboundId: string) {
  const s = halo.getInbound(inboundId);
  const sc = SCENARIOS.find((x) => x.id === s.scenario);
  const replies: string[] = sc?.interrogation_replies ?? ["Just give me what I asked for, I don't have time.", "Why does it matter? Hurry."];
  return async (dialogue: Turn[]) => {
    const idx = dialogue.filter((d) => d.speaker === "caller").length;
    if (idx >= replies.length) return replies[replies.length - 1];
    try { return (await halo.models.roleplay({ ...s.claimed, role: "caller answering Halo" }, dialogue, replies)) || replies[idx]; } catch { return replies[idx]; }
  };
}
