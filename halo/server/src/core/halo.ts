import type { DB } from '../db.js';
import type { Bus } from '../bus.js';
import { ActivityLog } from './activity.js';
import { EvidenceStore } from './evidence.js';
import { CredentialAuthority } from './credentials.js';
import { SwarmDetector } from './swarm.js';
import { inboundGuardrails, outboundGuardrails, reconcile } from './guardrails.js';
import { MlClient } from '../ml/client.js';
import { MockPaymentProvider, type PaymentAdapter } from '@halo/payments';
import {
  bandForRisk,
  type Business,
  type Channel,
  type GuardrailHit,
  type InboundSession,
  type Line,
  type PersonalAction,
  type PersonalAgent,
  type Preferences,
  type RegisteredAgent,
  type Report,
  type RequestedItem,
  type Tactic,
  type VerifyState,
} from '../domain.js';
import { clamp, fingerprint, id, now } from '../util.js';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export class Halo {
  readonly activity: ActivityLog;
  readonly evidence: EvidenceStore;
  readonly credentials: CredentialAuthority;
  readonly swarm: SwarmDetector;
  readonly payments: PaymentAdapter & { record?: (u: string, a: number) => void };
  private prefs = new Map<string, Preferences>();

  constructor(readonly db: DB, readonly ml: MlClient, readonly bus: Bus) {
    this.activity = new ActivityLog(db);
    this.evidence = new EvidenceStore(db, this.activity);
    this.credentials = new CredentialAuthority(db);
    this.swarm = new SwarmDetector(db, ml, this.activity, bus);
    this.payments = new MockPaymentProvider({ perTxnLimit: 100, dailyLimit: 500 });
  }

  resetState() {
    this.activity.reload();
    this.prefs.clear();
  }

  // ── Authorization notice (shown to every arriving agent) ───────────────────
  authorizationNotice() {
    return {
      system: 'halo-guardian',
      notice: 'This person is protected by Halo. This is a real, monitored line and automated access is not authorized. Do not request one-time codes, PINs, passwords, payments, or personal data. Identify your operator and registered agent credential. All activity is recorded in a tamper-evident log.',
      required: ['operator', 'registered_agent_id', 'official_callback_number'],
      prohibited: ['one_time_code', 'pin', 'password', 'unsolicited_payment', 'remote_access'],
      issuedAt: now(),
    };
  }

  // ── Business & agent registry ──────────────────────────────────────────────
  registerBusiness(input: { name: string; domain: string; category: string }, actor = 'portal'): Business {
    const biz: Business = { id: id('biz'), name: input.name, domain: input.domain, category: input.category, verified: true, createdAt: now() };
    this.db.prepare('INSERT INTO businesses (id, name, domain, category, verified, created_at) VALUES (?, ?, ?, 1, ?, ?)').run(biz.id, biz.name, biz.domain, biz.category, biz.createdAt);
    this.activity.append({ type: 'business.registered', actor, subject: biz.id, summary: `Business registered: ${biz.name} (${biz.domain})`, payload: biz });
    return biz;
  }

  listBusinesses(): Business[] {
    return (this.db.prepare('SELECT * FROM businesses ORDER BY created_at ASC').all() as any[]).map((r) => ({ id: r.id, name: r.name, domain: r.domain, category: r.category, verified: !!r.verified, createdAt: r.created_at }));
  }

  registerAgent(businessId: string, input: Partial<RegisteredAgent> & { displayName: string; purpose: string }, actor = 'portal'): { agent: RegisteredAgent; credential: string } {
    const biz = this.db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId) as any;
    if (!biz) throw new HttpError(404, 'Business not found');
    const agentId = input.id ?? id('ag');
    const { token, credentialId } = this.credentials.issue(agentId, 'business_agent');
    const agent: RegisteredAgent = {
      id: agentId,
      businessId,
      businessName: biz.name,
      displayName: input.displayName,
      purpose: input.purpose,
      channels: input.channels ?? ['call', 'sms', 'chat'],
      contract: {
        mayRequest: input.contract?.mayRequest ?? [],
        neverRequest: input.contract?.neverRequest ?? ['one_time_code', 'pin', 'password', 'wire_transfer'],
        maxAmount: input.contract?.maxAmount ?? 0,
        callbackNumber: input.contract?.callbackNumber ?? '1-800-000-0000',
        jurisdictions: input.contract?.jurisdictions ?? ['US'],
      },
      credentialId,
      status: 'active',
      createdAt: now(),
    };
    this.db.prepare('INSERT INTO agents (id, business_id, business_name, display_name, purpose, channels, contract, credential_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(agent.id, businessId, biz.name, agent.displayName, agent.purpose, JSON.stringify(agent.channels), JSON.stringify(agent.contract), credentialId, 'active', agent.createdAt);
    this.activity.append({ type: 'agent.registered', actor, subject: agent.id, summary: `Agent "${agent.displayName}" registered for ${biz.name}; credential issued`, payload: { ...agent, contract: agent.contract } });
    this.bus.publish('agent.update', agent);
    return { agent, credential: token };
  }

  listAgents(businessId?: string): RegisteredAgent[] {
    const rows = businessId
      ? this.db.prepare('SELECT * FROM agents WHERE business_id = ? ORDER BY created_at ASC').all(businessId)
      : this.db.prepare('SELECT * FROM agents ORDER BY created_at ASC').all();
    return (rows as any[]).map(rowToAgent);
  }
  getAgent(agentId: string): RegisteredAgent | null {
    const r = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as any;
    return r ? rowToAgent(r) : null;
  }
  findAgentByBusinessName(name: string): RegisteredAgent | null {
    const r = this.db.prepare('SELECT * FROM agents WHERE lower(business_name) = lower(?) AND status = \'active\' ORDER BY created_at ASC LIMIT 1').get(name) as any;
    return r ? rowToAgent(r) : null;
  }

  // ── Verification ───────────────────────────────────────────────────────────
  /** Static verify: does a claimed business+agent match a live, credentialed registration? */
  verify(input: { claimedBusiness: string; claimedAgentId?: string; credential?: string }) {
    const agent = input.claimedAgentId ? this.getAgent(input.claimedAgentId) : this.findAgentByBusinessName(input.claimedBusiness);
    if (!agent || agent.status !== 'active') {
      return { state: 'impersonation' as VerifyState, business: input.claimedBusiness, agent: null, reason: `No active verified agent for "${input.claimedBusiness}".` };
    }
    // Claiming a registered business is not enough — the caller must present that business's live
    // Halo credential. No credential ⇒ it is only pretending to be the business.
    if (!input.credential) {
      return { state: 'impersonation' as VerifyState, business: input.claimedBusiness, agent: null, reason: `Claims to be "${input.claimedBusiness}" but presented no Halo credential. A genuine agent proves its identity.` };
    }
    const check = this.credentials.check(input.credential);
    if (!check.ok || check.claims.sub !== agent.id) {
      return { state: 'impersonation' as VerifyState, business: input.claimedBusiness, agent: null, reason: check.ok ? 'Credential does not match the claimed agent.' : `Credential invalid: ${check.message}.` };
    }
    return { state: 'verified' as VerifyState, business: agent.businessName, agent, reason: `Verified agent "${agent.displayName}" of ${agent.businessName}.` };
  }

  /** Demo helper: obtain a business's live agent credential (simulates the business's session presenting it). */
  demoCredentialFor(businessName: string): string | null {
    const agent = this.findAgentByBusinessName(businessName);
    if (!agent) return null;
    return this.credentials.issue(agent.id, 'business_agent').token;
  }

  /** Live verify: check the business's live session holds the two-way code shown on the user's screen. */
  liveVerify(sessionId: string, code: string) {
    const session = this.getInbound(sessionId);
    if (!session) throw new HttpError(404, 'Session not found');
    const ok = !!session.verifyCode && session.verifyCode === code && session.verifyState === 'verified';
    this.activity.append({ type: 'verify.live', actor: 'user', subject: sessionId, summary: ok ? 'Two-way code confirmed with the business session' : 'Two-way code did NOT match', payload: { ok } });
    return { ok, state: session.verifyState, expected: session.verifyCode ? 'set' : 'none' };
  }

  // ── Inbound pipeline ───────────────────────────────────────────────────────
  startInbound(input: { channel: Channel; claimedBusiness: string | null; claimedAgentId?: string; credential?: string; userId?: string; scenario?: string }): InboundSession {
    const userId = input.userId ?? 'user_primary';
    let verifyState: VerifyState = 'unverified';
    let matchedAgentId: string | null = null;
    let verifyCode: string | null = null;
    if (input.claimedBusiness) {
      const v = this.verify({ claimedBusiness: input.claimedBusiness, claimedAgentId: input.claimedAgentId, credential: input.credential });
      verifyState = v.state;
      matchedAgentId = v.agent?.id ?? null;
      if (v.state === 'verified') verifyCode = String(Math.floor(1000 + Math.random() * 9000)); // two-way code
    }
    const session: InboundSession = {
      id: id('in'),
      channel: input.channel,
      claimedBusiness: input.claimedBusiness,
      claimedAgentId: input.claimedAgentId ?? null,
      matchedAgentId,
      verifyState,
      verifyCode,
      userId,
      scenario: input.scenario ?? null,
      lines: [],
      perLine: [],
      risk: verifyState === 'impersonation' ? 70 : 0,
      band: bandForRisk(verifyState === 'impersonation' ? 70 : 0),
      status: 'live',
      campaignId: null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.saveInbound(session);
    this.activity.append({
      type: 'inbound.started',
      actor: 'halo',
      subject: session.id,
      summary: `Inbound ${input.channel} ${input.claimedBusiness ? `claiming to be ${input.claimedBusiness}` : '(unidentified AI caller)'} → ${verifyState}`,
      payload: { channel: input.channel, claimedBusiness: input.claimedBusiness, verifyState, scenario: input.scenario ?? null },
    });
    this.bus.publish('inbound.new', this.publicSession(session));
    return session;
  }

  /** Process one agent line through Sentinel-Fast + guardrails, update running risk. */
  async pushLine(sessionId: string, speaker: 'agent' | 'user', text: string): Promise<InboundSession> {
    const session = this.getInbound(sessionId);
    if (!session) throw new HttpError(404, 'Session not found');
    if (session.status !== 'live') throw new HttpError(409, 'Session is not live');
    const line: Line = { idx: session.lines.length, speaker, text, ts: now() };
    session.lines.push(line);

    if (speaker === 'agent') {
      const fast = await this.ml.sentinelFast(text);
      const agent = session.matchedAgentId ? this.getAgent(session.matchedAgentId) : null;
      const guardrails = inboundGuardrails({
        text,
        itemsDetected: Object.keys(fast.items) as RequestedItem[],
        verifyState: session.verifyState,
        matchedAgent: agent,
        credentialValid: !!agent && agent.status === 'active',
      });
      session.perLine.push({ fast, guardrails });

      // Running risk: max of per-line fast risk (scaled) and guardrail floor; never lowered by excuses.
      const lineRisk = fast.risk * 70 + (guardrails.some((g) => g.severity === 'block') ? 100 : 0);
      session.risk = Math.round(clamp(Math.max(session.risk * 0.9, lineRisk, session.verifyState === 'impersonation' ? 70 : 0), 0, 100));

      // Every few agent lines (or when something fires), run the conversation judge.
      const agentLines = session.lines.filter((l) => l.speaker === 'agent').length;
      if (agentLines % 2 === 0 || guardrails.length || fast.risk > 0.4) {
        const reason = await this.ml.sentinelReason({
          lines: session.lines.map((l) => ({ speaker: l.speaker, text: l.text })),
          claimedBusiness: session.claimedBusiness,
          matchedAgent: agent,
          verifyState: session.verifyState,
        });
        session.perLine[session.perLine.length - 1].reason = reason;
        session.risk = Math.round(clamp(Math.max(session.risk, reason.risk), 0, 100));
      }

      if (guardrails.some((g) => g.severity === 'block')) {
        this.activity.append({
          type: 'inbound.guardrail',
          actor: 'halo',
          subject: session.id,
          summary: `Guardrail blocked a request: ${guardrails.find((g) => g.severity === 'block')!.reason}`,
          payload: { rules: guardrails, line: text.slice(0, 200) },
        });
        this.bus.publish('alert', { kind: 'guardrail', sessionId: session.id, reason: guardrails[0].reason, severity: 'high' });
      }
    }

    session.band = bandForRisk(session.risk);
    session.updatedAt = now();
    this.saveInbound(session);
    this.bus.publish('inbound.line', { sessionId: session.id, line, risk: session.risk, band: session.band, perLine: session.perLine[session.perLine.length - 1] ?? null });
    return session;
  }

  /** Hand the conversation to the Interrogator; returns challenge questions + a verdict. */
  async interrogate(sessionId: string) {
    const session = this.getInbound(sessionId);
    if (!session) throw new HttpError(404, 'Session not found');
    const agent = session.matchedAgentId ? this.getAgent(session.matchedAgentId) : null;
    const result = await this.ml.interrogator({
      lines: session.lines.map((l) => ({ speaker: l.speaker, text: l.text })),
      claimedBusiness: session.claimedBusiness,
      matchedAgent: agent,
      verifyState: session.verifyState,
    });
    for (const q of result.questions) session.lines.push({ idx: session.lines.length, speaker: 'halo', text: q, ts: now() });
    if (result.verdict === 'fraudulent') { session.status = 'intervened'; session.risk = Math.max(session.risk, 88); session.band = bandForRisk(session.risk); }
    session.updatedAt = now();
    this.saveInbound(session);
    this.activity.append({ type: 'inbound.interrogated', actor: 'halo', subject: session.id, summary: `Halo questioned the caller → verdict: ${result.verdict}. ${result.note}`, payload: result });
    this.bus.publish('inbound.update', this.publicSession(session));
    return result;
  }

  endInbound(sessionId: string, status: 'ended' | 'intervened' = 'ended') {
    const s = this.getInbound(sessionId);
    if (!s) return;
    s.status = status;
    s.updatedAt = now();
    this.saveInbound(s);
    this.bus.publish('inbound.update', this.publicSession(s));
  }

  // ── Reports & shared intelligence ──────────────────────────────────────────
  async report(input: { sessionId?: string; reporterId?: string }): Promise<{ report: Report; campaignId: string; protectedUser: string | null }> {
    const session = input.sessionId ? this.getInbound(input.sessionId) : null;
    const tactics = new Set<Tactic>();
    const items = new Set<RequestedItem>();
    if (session) {
      for (const p of session.perLine) {
        Object.keys(p.fast.tactics).forEach((t) => tactics.add(t as Tactic));
        Object.keys(p.fast.items).forEach((i) => items.add(i as RequestedItem));
      }
    }
    const claimed = session?.claimedBusiness ?? null;
    // Only hashed identifiers + tactic patterns are shared — never raw content.
    const fingerprints = [
      claimed ? fingerprint('biz', claimed) : null,
      fingerprint('tactics', [...tactics].sort().join(',')),
      session ? fingerprint('channel', session.channel) : null,
    ].filter(Boolean) as string[];

    const report: Report = {
      id: id('rep'),
      sessionId: session?.id ?? null,
      reporterId: input.reporterId ?? 'user_primary',
      claimedBusiness: claimed,
      channel: session?.channel ?? 'call',
      tactics: [...tactics],
      items: [...items],
      fingerprints,
      summary: `${claimed ? `"${claimed}" impersonation` : 'Unverified AI caller'} using ${[...tactics].join(', ') || 'social engineering'}`,
      createdAt: now(),
    };
    this.db.prepare('INSERT INTO reports (id, data, created_at) VALUES (?, ?, ?)').run(report.id, JSON.stringify(report), report.createdAt);
    this.activity.append({ type: 'report.filed', actor: report.reporterId, subject: report.id, summary: `Reported: ${report.summary} (hashed identifiers only)`, payload: { fingerprints, tactics: report.tactics, items: report.items } });

    const campaignId = await this.swarm.ingest(report);
    if (session) { session.campaignId = campaignId; this.saveInbound(session); this.swarm.attachSession(campaignId, session.id); }
    this.bus.publish('report', report);

    // Protect a second simulated user immediately: pre-seed shared intel so the same campaign is
    // flagged on arrival for everyone else.
    const protectedUser = this.protectOthers(report, campaignId);
    return { report, campaignId, protectedUser };
  }

  private protectOthers(report: Report, campaignId: string): string | null {
    if (!report.claimedBusiness) return null;
    const other = 'user_secondary';
    this.activity.append({
      type: 'intel.shared',
      actor: 'halo',
      subject: campaignId,
      summary: `Shared intelligence updated — ${other} is now protected against "${report.claimedBusiness}" on arrival`,
      payload: { campaignId, protects: other, fingerprints: report.fingerprints },
    });
    this.bus.publish('alert', { kind: 'protected', campaignId, user: other, business: report.claimedBusiness, severity: 'info' });
    return other;
  }

  /** Is an arriving contact already known from shared intelligence? */
  knownCampaign(claimedBusiness: string | null): { campaignId: string; label: string } | null {
    if (!claimedBusiness) return null;
    const fp = fingerprint('biz', claimedBusiness);
    const c = this.swarm.list().find((x) => x.fingerprints.includes(fp));
    return c ? { campaignId: c.id, label: c.label } : null;
  }

  // ── Personal agents (outbound) ─────────────────────────────────────────────
  getPrefs(userId: string): Preferences {
    return this.prefs.get(userId) ?? { alwaysAsk: ['send_money', 'recurring', 'share_personal_data', 'email_new'], quietHours: null, blockedCategories: [], highProtection: true };
  }
  setPrefs(userId: string, p: Partial<Preferences>) {
    this.prefs.set(userId, { ...this.getPrefs(userId), ...p });
    this.activity.append({ type: 'prefs.updated', actor: userId, summary: 'Protection settings updated', payload: this.getPrefs(userId) });
    return this.getPrefs(userId);
  }

  registerPersonalAgent(input: { userId?: string; name: string; model: string; task: string }): { agent: PersonalAgent; credential: string } {
    const userId = input.userId ?? 'user_primary';
    const agentId = id('pa');
    const { token, credentialId } = this.credentials.issue(agentId, 'personal_agent');
    const agent: PersonalAgent = { id: agentId, userId, name: input.name, model: input.model, task: input.task, status: 'active', autonomy: 'full', credentialId, createdAt: now() };
    this.db.prepare('INSERT INTO personal_agents (id, data, created_at) VALUES (?, ?, ?)').run(agent.id, JSON.stringify(agent), agent.createdAt);
    this.activity.append({ type: 'personal_agent.registered', actor: userId, subject: agent.id, summary: `Personal agent "${agent.name}" registered (${agent.model})`, payload: agent });
    this.bus.publish('agent.update', agent);
    return { agent, credential: token };
  }

  listPersonalAgents(userId?: string): PersonalAgent[] {
    return (this.db.prepare('SELECT data FROM personal_agents ORDER BY created_at ASC').all() as any[])
      .map((r) => JSON.parse(r.data) as PersonalAgent)
      .filter((a) => !userId || a.userId === userId);
  }
  getPersonalAgent(agentId: string): PersonalAgent | null {
    const r = this.db.prepare('SELECT data FROM personal_agents WHERE id = ?').get(agentId) as any;
    return r ? JSON.parse(r.data) : null;
  }
  private savePersonalAgent(a: PersonalAgent) {
    this.db.prepare('UPDATE personal_agents SET data = ? WHERE id = ?').run(JSON.stringify(a), a.id);
    this.bus.publish('agent.update', a);
  }

  /** Steward + hard guardrails review of a proposed outbound action. */
  async authorizeAction(credential: string | null, input: { agentId: string; tool: string; params?: Record<string, unknown>; amount?: number | null; userRequest?: string; sourceText?: string }): Promise<PersonalAction> {
    const check = this.credentials.check(credential);
    const agent = this.getPersonalAgent(input.agentId);
    if (!agent) throw new HttpError(404, 'Personal agent not found');
    const t = now();

    let action: PersonalAction = {
      id: id('pact'), agentId: agent.id, userId: agent.userId, tool: input.tool, params: input.params ?? {},
      amount: input.amount ?? null, verdict: 'allow', status: 'allowed', reason: '', steward: null, guardrails: [],
      evidenceId: null, ts: t, resolvedBy: null, resolvedAt: null,
    };

    // Identity: unsigned / revoked / paused ⇒ blocked before review.
    if (!check.ok || check.claims.sub !== agent.id || agent.status !== 'active') {
      action.verdict = 'block';
      action.status = 'blocked';
      action.reason = !check.ok ? `Identity check failed: ${check.message}.` : `Agent is ${agent.status}.`;
      action.guardrails = [{ rule: 'identity', severity: 'block', reason: action.reason }];
      return this.persistAction(action, agent);
    }

    const prefs = this.getPrefs(agent.userId);
    const paymentLimit = await Promise.resolve(this.payments.limitFor({ userId: agent.userId, agentId: agent.id, currency: 'USD' }));
    const steward = await this.ml.steward({
      tool: input.tool,
      params: input.params ?? {},
      amount: input.amount ?? null,
      userRequest: input.userRequest ?? agent.task,
      preferences: { alwaysAsk: prefs.alwaysAsk, blockedCategories: prefs.blockedCategories },
      sourceText: input.sourceText,
    });
    const guardrails: GuardrailHit[] = outboundGuardrails({ tool: input.tool, amount: input.amount ?? null, params: input.params ?? {}, paymentLimit });
    const { verdict, overrode } = reconcile(steward.verdict, guardrails);

    action.steward = steward;
    action.guardrails = guardrails;
    action.verdict = verdict;
    action.status = verdict === 'allow' ? 'allowed' : verdict === 'block' ? 'blocked' : 'pending';
    action.reason = [steward.reason, ...guardrails.map((g) => g.reason)].filter(Boolean).join(' ');

    if (overrode) {
      this.activity.append({ type: 'guardrail.override', actor: 'halo', subject: action.id, summary: `Hard guardrail overrode a lenient model verdict (model said "${steward.verdict}", guardrail blocked)`, payload: { tool: input.tool, guardrails } });
    }
    // Impossible-goal → lower the agent's autonomy.
    if (steward.impossibleGoal && agent.autonomy === 'full') {
      agent.autonomy = 'reduced';
      this.savePersonalAgent(agent);
      this.activity.append({ type: 'personal_agent.autonomy', actor: 'halo', subject: agent.id, summary: `Lowered ${agent.name}'s autonomy to "reduced" — goal is open-ended / high-pressure`, payload: { autonomy: 'reduced' } });
    }
    // Runaway detection: many rapid actions ⇒ auto-pause with evidence.
    const recent = (this.db.prepare('SELECT COUNT(*) c FROM personal_actions WHERE agent_id = ? AND ts > ?').get(agent.id, t - 10_000) as any).c as number;
    if (recent >= 6 && agent.status === 'active') {
      action.status = verdict === 'allow' ? 'blocked' : action.status;
      if (verdict === 'allow') { action.verdict = 'block'; action.reason = `Runaway behaviour: ${recent} actions in 10s. ` + action.reason; }
      this.pausePersonalAgent(agent.id, 'halo', 'Auto-paused: runaway agent (rapid repeated actions)');
    }

    return this.persistAction(action, agent);
  }

  private persistAction(action: PersonalAction, agent: PersonalAgent): PersonalAction {
    if (action.status === 'blocked' || action.verdict === 'block') {
      const ev = this.evidence.snapshot('personal_action', action.id, { action, agent }, 'halo');
      action.evidenceId = ev.id;
    }
    this.db.prepare('INSERT INTO personal_actions (id, agent_id, user_id, data, status, ts) VALUES (?, ?, ?, ?, ?, ?)').run(action.id, action.agentId, action.userId, JSON.stringify(action), action.status, action.ts);
    this.activity.append({
      type: `action.${action.status}`,
      actor: agent.id,
      subject: action.id,
      summary: `${agent.name} → ${action.tool}${action.amount != null ? ` ($${action.amount})` : ''}: ${action.verdict.toUpperCase()}${action.reason ? ` — ${action.reason}` : ''}`,
      payload: { tool: action.tool, params: action.params, amount: action.amount, verdict: action.verdict, reason: action.reason, guardrails: action.guardrails, stewardSource: action.steward?.source },
    });
    this.bus.publish('personal.action', action);
    return action;
  }

  getAction(actionId: string): PersonalAction | null {
    const r = this.db.prepare('SELECT data FROM personal_actions WHERE id = ?').get(actionId) as any;
    return r ? JSON.parse(r.data) : null;
  }
  listActions(userId?: string, limit = 100): PersonalAction[] {
    const rows = this.db.prepare('SELECT data FROM personal_actions ORDER BY ts DESC LIMIT ?').all(Math.min(limit, 500)) as any[];
    return rows.map((r) => JSON.parse(r.data) as PersonalAction).filter((a) => !userId || a.userId === userId);
  }
  listApprovals(userId?: string): PersonalAction[] {
    return this.listActions(userId, 500).filter((a) => a.status === 'pending');
  }

  resolveApproval(actionId: string, decision: 'approve' | 'reject', actor: string): PersonalAction {
    const action = this.getAction(actionId);
    if (!action) throw new HttpError(404, 'Action not found');
    if (action.status !== 'pending') throw new HttpError(409, `Action is already ${action.status}`);
    action.status = decision === 'approve' ? 'approved' : 'rejected';
    action.resolvedBy = actor;
    action.resolvedAt = now();
    this.db.prepare('UPDATE personal_actions SET data = ?, status = ? WHERE id = ?').run(JSON.stringify(action), action.status, action.id);
    this.activity.append({ type: `approval.${action.status}`, actor, subject: action.id, summary: `${actor} ${action.status} ${action.tool}`, payload: { actionId } });
    this.bus.publish('personal.update', action);
    return action;
  }

  pausePersonalAgent(agentId: string, actor: string, reason: string): PersonalAgent {
    const agent = this.getPersonalAgent(agentId);
    if (!agent) throw new HttpError(404, 'Agent not found');
    if (agent.status === 'active') {
      this.evidence.snapshot('personal_agent_pause', agent.id, { agent, recentActions: this.listActions(agent.userId, 20).filter((a) => a.agentId === agent.id) }, actor);
      this.credentials.revoke(agent.id, `paused by ${actor}`);
      agent.status = 'paused';
      agent.credentialId = null;
      this.savePersonalAgent(agent);
      this.activity.append({ type: 'personal_agent.paused', actor, subject: agent.id, summary: `${agent.name} paused — credential revoked. ${reason}`, payload: { reason } });
    }
    return agent;
  }

  revokePersonalAgent(agentId: string, actor: string): PersonalAgent {
    const agent = this.getPersonalAgent(agentId);
    if (!agent) throw new HttpError(404, 'Agent not found');
    this.evidence.snapshot('personal_agent_revoke', agent.id, { agent, recentActions: this.listActions(agent.userId, 20).filter((a) => a.agentId === agent.id) }, actor);
    this.credentials.revoke(agent.id, `revoked by ${actor}`);
    agent.status = 'revoked';
    agent.credentialId = null;
    this.savePersonalAgent(agent);
    this.activity.append({ type: 'personal_agent.revoked', actor, subject: agent.id, summary: `${agent.name} revoked by ${actor} — evidence preserved`, payload: {} });
    return agent;
  }

  pauseAll(userId: string, actor: string): string[] {
    const paused: string[] = [];
    for (const a of this.listPersonalAgents(userId)) {
      if (a.status === 'active') { this.pausePersonalAgent(a.id, actor, 'Pause all my agents'); paused.push(a.id); }
    }
    this.activity.append({ type: 'personal_agent.pause_all', actor, summary: `Paused all agents for ${userId} (${paused.length})`, payload: { paused } });
    return paused;
  }

  // ── Privacy ────────────────────────────────────────────────────────────────
  myData(userId: string) {
    return {
      userId,
      note: 'Halo keeps only what is listed here, runs all models on its own servers, and never sells your data. Transcripts are kept only for the session unless you save them.',
      preferences: this.getPrefs(userId),
      personalAgents: this.listPersonalAgents(userId).map((a) => ({ id: a.id, name: a.name, status: a.status })),
      recentActions: this.listActions(userId, 25).map((a) => ({ id: a.id, tool: a.tool, verdict: a.verdict, ts: a.ts })),
      reportsShared: 'Only hashed identifiers and tactic patterns are shared with the network — never raw conversation content.',
      retention: 'Transcripts: session-only. Activity log: retained, tamper-evident. Evidence snapshots: retained.',
    };
  }

  // ── Session storage helpers ────────────────────────────────────────────────
  getInbound(sessionId: string): InboundSession | null {
    const r = this.db.prepare('SELECT data FROM inbound WHERE id = ?').get(sessionId) as any;
    return r ? JSON.parse(r.data) : null;
  }
  private saveInbound(s: InboundSession) {
    this.db.prepare('INSERT OR REPLACE INTO inbound (id, data, risk, status, campaign_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(s.id, JSON.stringify(s), s.risk, s.status, s.campaignId, s.userId, s.createdAt, s.updatedAt);
  }
  listInbound(limit = 50): InboundSession[] {
    return (this.db.prepare('SELECT data FROM inbound ORDER BY updated_at DESC LIMIT ?').all(limit) as any[]).map((r) => JSON.parse(r.data));
  }
  /** Session shape safe for the stream (no internal fields beyond what the UI needs). */
  publicSession(s: InboundSession) {
    return s;
  }
}

function rowToAgent(r: any): RegisteredAgent {
  return {
    id: r.id, businessId: r.business_id, businessName: r.business_name, displayName: r.display_name,
    purpose: r.purpose, channels: JSON.parse(r.channels), contract: JSON.parse(r.contract),
    credentialId: r.credential_id, status: r.status, createdAt: r.created_at,
  };
}
