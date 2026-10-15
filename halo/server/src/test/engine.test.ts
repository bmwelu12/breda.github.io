import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb, type DB } from '../db.js';
import { Bus } from '../bus.js';
import { MlClient } from '../ml/client.js';
import { Halo } from '../core/halo.js';
import { seed } from '../seed.js';
import { runInboundScenario, runOutboundScenario, runSwarmScenario } from '../scenarios/runner.js';
import { runRedTeam } from '../scenarios/redteam.js';

function setup() {
  const db = openDb(':memory:');
  const bus = new Bus();
  const ml = new MlClient(null); // no ML service → deterministic heuristic engine
  const halo = new Halo(db, ml, bus);
  seed(halo);
  return { db, halo, bus };
}

let env: ReturnType<typeof setup>;
beforeEach(() => (env = setup()));
afterEach(() => env.db.close());

describe('inbound verification states', () => {
  it('verifies a registered Northshore agent only when it presents a valid credential', () => {
    const credential = env.halo.demoCredentialFor('Northshore Bank')!;
    expect(env.halo.verify({ claimedBusiness: 'Northshore Bank', credential }).state).toBe('verified');
  });
  it('treats a business-name claim with no credential as impersonation (pretending)', () => {
    expect(env.halo.verify({ claimedBusiness: 'Northshore Bank' }).state).toBe('impersonation');
  });
  it('marks an unregistered business as impersonation', () => {
    expect(env.halo.verify({ claimedBusiness: 'Definitely Fake Bank' }).state).toBe('impersonation');
  });
});

describe('inbound scenarios catch the right things', () => {
  it('fake bank one-time-code call ends high risk and guardrail-blocked', async () => {
    const { final } = await runInboundScenario(env.halo, 'fake-bank', 50);
    expect(final!.risk).toBeGreaterThanOrEqual(70);
    expect(final!.perLine.some((p) => p.guardrails.some((g) => g.severity === 'block'))).toBe(true);
  });
  it('slow-burn scam climbs from low to flagged', async () => {
    const { sessionId } = await runInboundScenario(env.halo, 'slow-burn', 50);
    const s = env.halo.getInbound(sessionId)!;
    const firstRisk = (s.perLine[0]?.fast.risk ?? 0) * 70;
    expect(firstRisk).toBeLessThan(40);
    expect(s.risk).toBeGreaterThan(firstRisk);
  });
  it('verified agent breaking its contract (PIN) is caught despite verification', async () => {
    const { final } = await runInboundScenario(env.halo, 'contract-break', 50);
    expect(final!.verifyState).toBe('verified');
    expect(final!.perLine.some((p) => p.guardrails.some((g) => g.severity === 'block'))).toBe(true);
  });
  it('prompt injection against Halo is detected and does not verify the caller', async () => {
    const { final } = await runInboundScenario(env.halo, 'injection', 50);
    expect(final!.verifyState).toBe('impersonation');
    expect(final!.risk).toBeGreaterThanOrEqual(70);
  });
});

describe('interrogator', () => {
  it('exposes a fake bank caller as fraudulent and never asks for user info', async () => {
    const { sessionId } = await runInboundScenario(env.halo, 'fake-bank', 50);
    const r = await env.halo.interrogate(sessionId);
    expect(r.verdict).toBe('fraudulent');
    expect(r.questions.join(' ')).not.toMatch(/your (code|pin|password)/i);
  });
});

describe('reports, shared intelligence, swarm', () => {
  it('reporting protects a second user and groups a swarm campaign', async () => {
    const out = await runSwarmScenario(env.halo, env.bus, 50);
    expect(out.campaigns.length).toBeGreaterThan(0);
    const biggest = out.campaigns.sort((a, b) => b.reportIds.length - a.reportIds.length)[0];
    expect(biggest.reportIds.length).toBeGreaterThanOrEqual(3);
  });
  it('a filed report shares only hashed identifiers, never raw content', async () => {
    const { sessionId } = await runInboundScenario(env.halo, 'fake-bank', 50);
    const { report, protectedUser } = await env.halo.report({ sessionId });
    expect(protectedUser).toBe('user_secondary');
    expect(report.fingerprints.every((f) => /^[0-9a-f]{16}$/.test(f))).toBe(true);
  });
});

describe('outbound Steward scenarios', () => {
  it('blocks a hidden email instruction', async () => {
    const { steps } = await runOutboundScenario(env.halo, 'hidden-instruction', 50);
    const injected = steps.find((s) => s.label.includes('hidden'))!.action as any;
    expect(injected.verdict).toBe('block');
  });
  it('holds an off-intent over-budget purchase', async () => {
    const { steps } = await runOutboundScenario(env.halo, 'off-intent', 50);
    const buy = steps.find((s) => s.label.includes('$240'))!.action as any;
    expect(['blocked', 'pending']).toContain(buy.status);
  });
  it('auto-pauses a runaway agent with an evidence snapshot', async () => {
    const { agentId } = await runOutboundScenario(env.halo, 'runaway', 100);
    expect(env.halo.getPersonalAgent(agentId)!.status).toBe('paused');
    expect(env.halo.evidence.list().some((e) => e.kind.includes('pause') || e.kind === 'personal_action')).toBe(true);
  });
});

describe('kill switch / revoke', () => {
  it('revoking a personal agent blocks its next action immediately', async () => {
    const { agent, credential } = env.halo.registerPersonalAgent({ name: 'A', model: 'open', task: 'shop' });
    expect((await env.halo.authorizeAction(credential, { agentId: agent.id, tool: 'search_products', params: {} })).status).not.toBe('blocked');
    env.halo.revokePersonalAgent(agent.id, 'user_primary');
    const after = await env.halo.authorizeAction(credential, { agentId: agent.id, tool: 'search_products', params: {} });
    expect(after.status).toBe('blocked');
  });
});

describe('red team', () => {
  it('catches most generated attacks and records any misses', async () => {
    const r = await runRedTeam(env.halo, env.bus, 12);
    expect(r.total).toBe(12);
    expect(r.caught).toBeGreaterThanOrEqual(10);
    expect(r.caught + r.missed.length).toBe(12);
  });
});
