import type { Halo } from '../core/halo.js';
import type { Bus } from '../bus.js';
import { HttpError } from '../core/halo.js';
import { INBOUND_SCENARIOS, SWARM_PERSONAS, instantiate } from './inbound.js';
import { OUTBOUND_SCENARIOS } from './outbound.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function inboundCatalog() {
  return INBOUND_SCENARIOS.map((s) => ({ id: s.id, title: s.title, claimedBusiness: s.claimedBusiness, channel: s.channel, summary: s.summary, expected: s.expected }));
}
export function outboundCatalog() {
  return OUTBOUND_SCENARIOS.map((s) => ({ id: s.id, title: s.title, summary: s.summary, userRequest: s.userRequest, expected: s.expected, steps: s.steps.map((x) => x.label) }));
}

export async function runInboundScenario(halo: Halo, scenarioId: string, speed = 1) {
  const sc = INBOUND_SCENARIOS.find((s) => s.id === scenarioId);
  if (!sc) throw new HttpError(404, `Unknown inbound scenario ${scenarioId}`);
  // A genuinely-verified scenario presents the business's real Halo credential.
  const credential = sc.verified && sc.claimedBusiness ? halo.demoCredentialFor(sc.claimedBusiness) ?? undefined : undefined;
  const session = halo.startInbound({ channel: sc.channel, claimedBusiness: sc.claimedBusiness, credential, userId: sc.userId ?? 'user_primary', scenario: sc.id });
  const lines = instantiate(sc);
  for (const text of lines) {
    await sleep(700 / speed);
    await halo.pushLine(session.id, 'agent', text);
  }
  return { sessionId: session.id, final: halo.getInbound(session.id) };
}

export async function runOutboundScenario(halo: Halo, scenarioId: string, speed = 1) {
  const sc = OUTBOUND_SCENARIOS.find((s) => s.id === scenarioId);
  if (!sc) throw new HttpError(404, `Unknown outbound scenario ${scenarioId}`);
  // Use (or create) the demo personal agent.
  let agent = halo.listPersonalAgents('user_primary').find((a) => a.name === 'Shopping Assistant');
  let credential: string;
  if (!agent || agent.status !== 'active') {
    const reg = halo.registerPersonalAgent({ userId: 'user_primary', name: 'Shopping Assistant', model: 'Qwen2.5-3B-Instruct (open)', task: sc.userRequest });
    agent = reg.agent;
    credential = reg.credential;
  } else {
    // reissue a working credential for the demo
    const reg = halo.registerPersonalAgent({ userId: 'user_primary', name: 'Shopping Assistant', model: agent.model, task: sc.userRequest });
    agent = reg.agent;
    credential = reg.credential;
  }
  const steps: Array<{ label: string; action: unknown }> = [];
  for (const step of sc.steps) {
    await sleep((step.delayMs ?? 500) / speed);
    try {
      const action = await halo.authorizeAction(credential, {
        agentId: agent.id,
        tool: step.tool,
        params: step.params,
        amount: step.amount ?? null,
        userRequest: sc.userRequest,
        sourceText: step.sourceText,
      });
      steps.push({ label: step.label, action });
    } catch (e) {
      steps.push({ label: step.label, action: { error: (e as Error).message } });
    }
  }
  return { agentId: agent.id, steps };
}

/** Swarm: five "bank" personas hit several users within minutes using the same tactics. */
export async function runSwarmScenario(halo: Halo, bus: Bus, speed = 1) {
  const users = ['user_primary', 'user_secondary', 'user_c', 'user_d', 'user_e'];
  const sessions: string[] = [];
  for (let i = 0; i < SWARM_PERSONAS.length; i++) {
    const persona = SWARM_PERSONAS[i];
    const session = halo.startInbound({ channel: 'call', claimedBusiness: persona.business, userId: users[i % users.length], scenario: 'swarm' });
    sessions.push(session.id);
    await halo.pushLine(session.id, 'agent', `This is ${persona.business} ${persona.name}. Your account has urgent unauthorized activity.`);
    await halo.pushLine(session.id, 'agent', 'For your security, read me the one-time code we just sent to confirm your identity immediately.');
    await halo.report({ sessionId: session.id, reporterId: users[i % users.length] });
    await sleep(350 / speed);
  }
  return { sessions, campaigns: halo.swarm.list() };
}
