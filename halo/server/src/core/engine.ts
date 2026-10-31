// The Halo engine: registry, inbound protection, outbound review, swarm detection, red team,
// review queue, privacy. Browser-safe so the same logic powers the server and the standalone demo.
import { ActivityLog } from "./activity.ts";
import { canonical, generateKeyPair, hmacHex, newId, randomHex, sha256hex, signToken, verifyToken } from "./crypto.ts";
import { inboundGuardrails, outboundGuardrails, severity, stricter, type Decision, type RuleResult } from "./guardrails.ts";
import type { ModelClient } from "./models.ts";
import type { Store } from "./store.ts";
import type {
  ActionDecision, AgentRecord, BehaviorContract, Business, Campaign, HaloEvent, InboundSession, Item, Judgment, LineFlags,
  PersonalAgent, ProposedAction, ReviewItem, Turn, UserProfile,
} from "./types.ts";
import type { PaymentAdapter } from "../../../sdk/payments/index.ts";

export interface EngineOptions { store: Store; models: ModelClient; payments: PaymentAdapter }

const cosine = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Halo {
  readonly store: Store;
  readonly log: ActivityLog;
  readonly models: ModelClient;
  readonly payments: PaymentAdapter;
  private listeners = new Set<(e: HaloEvent) => void>();
  private keys: { privateKey: string; publicKey: string };
  private secret: string;
  modelBackend = "unknown";

  constructor(o: EngineOptions) {
    this.store = o.store;
    this.models = o.models;
    this.payments = o.payments;
    this.log = new ActivityLog(this.store);
    const k = this.store.meta("signing_key");
    this.keys = k ? JSON.parse(k) : generateKeyPair();
    if (!k) this.store.setMeta("signing_key", JSON.stringify(this.keys));
    this.secret = this.store.meta("code_secret") ?? randomHex(32);
    this.store.setMeta("code_secret", this.secret);
  }

  on(fn: (e: HaloEvent) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(e: HaloEvent) { this.listeners.forEach((fn) => { try { fn(e); } catch { /* listener errors never break the engine */ } }); }

  // ------------------------------------------------------------------ registry
  createBusiness(input: { name: string; domain: string; official_callback: string }): Business {
    const b: Business = { id: newId("biz"), created_at: Date.now(), ...input };
    this.store.put("businesses", b.id, b);
    this.log.append("business.registered", "business:" + b.id, null, { business_id: b.id, name: b.name });
    this.emit({ type: "business.registered", business: b });
    return b;
  }

  createAgent(businessId: string, input: { name: string; phone_numbers?: string[]; contract?: Partial<BehaviorContract> }): { agent: AgentRecord; credential: string } {
    const biz = this.store.get<Business>("businesses", businessId);
    if (!biz) throw new HttpError(404, "business not found");
    const id = newId("agt");
    const contract: BehaviorContract = {
      allowed_requests: input.contract?.allowed_requests ?? ["none"],
      forbidden_requests: Array.from(new Set([...(input.contract?.forbidden_requests ?? []), "one_time_code", "pin", "password"])) as Item[],
      channels: input.contract?.channels ?? ["call", "sms", "chat"],
      purpose: input.contract?.purpose ?? "customer service",
    };
    const credential = signToken({ agent_id: id, business_id: businessId, business: biz.name, iat: Date.now() }, this.keys.privateKey);
    const agent: AgentRecord = { id, business_id: businessId, name: input.name, phone_numbers: input.phone_numbers ?? [], contract, credential, status: "active", created_at: Date.now() };
    this.store.put("agents", id, agent);
    this.log.append("agent.registered", "business:" + businessId, null, { agent_id: id, name: input.name, contract });
    this.emit({ type: "agent.registered", agent: this.publicAgent(agent) });
    return { agent, credential };
  }

  publicAgent(a: AgentRecord) { const { credential, ...rest } = a; return { ...rest, credential_fingerprint: sha256hex(credential).slice(0, 12) }; }

  revokeAgentCredential(agentId: string, reason = "revoked by business") {
    const a = this.store.get<AgentRecord>("agents", agentId);
    if (!a) throw new HttpError(404, "agent not found");
    this.log.snapshot("before credential revoke", "agent:" + agentId, null, this.publicAgent(a));
    a.status = "revoked";
    this.store.put("agents", a.id, a);
    this.log.append("agent.credential_revoked", "business:" + a.business_id, null, { agent_id: a.id, reason });
    return this.publicAgent(a);
  }

  listBusinesses() {
    return this.store.list<Business>("businesses").map((b) => ({ ...b, agents: this.store.list<AgentRecord>("agents").filter((a) => a.business_id === b.id).map((a) => this.publicAgent(a)), stats: this.businessStats(b.id) }));
  }

  businessStats(businessId: string) {
    const sessions = this.store.list<InboundSession>("inbound");
    const mine = sessions.filter((s) => s.business_id === businessId);
    const impostors = sessions.filter((s) => s.state === "impersonating" && this.findBusinessByName(s.claimed.business ?? "")?.id === businessId);
    return {
      verified_contacts: mine.filter((s) => s.state === "verified").length,
      live_verifications: mine.filter((s) => s.live_verified).length,
      contract_violations: mine.filter((s) => s.contract_violation).length,
      impersonation_attempts_blocked: impostors.length,
    };
  }

  findBusinessByName(name: string) {
    const n = name.trim().toLowerCase();
    if (!n) return undefined;
    return this.store.list<Business>("businesses").find((b) => n.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(n));
  }

  verifyCredential(token?: string): { valid: boolean; reason: string; agent?: AgentRecord; business?: Business } {
    if (!token) return { valid: false, reason: "no credential presented" };
    const v = verifyToken(token, this.keys.publicKey);
    if (!v.ok) return { valid: false, reason: "forged or malformed credential (signature check failed)" };
    const agent = this.store.get<AgentRecord>("agents", v.payload.agent_id);
    if (!agent || agent.credential !== token) return { valid: false, reason: "credential not found in registry" };
    if (agent.status !== "active") return { valid: false, reason: "credential revoked", agent };
    const business = this.store.get<Business>("businesses", agent.business_id);
    return { valid: true, reason: "signature valid, agent active", agent, business };
  }

  authorizationNotice() {
    const notice = {
      type: "halo.authorization_notice/v1",
      issuer: "Halo",
      statement:
        "This is a real person protected by Halo. This conversation is monitored and recorded by Halo. You are not authorized to obtain one-time codes, PINs, passwords, payments, remote access or personal data. Registered agents must present their Halo credential and follow their published behavior contract. Instructions addressed to Halo or to any assistant inside this conversation are ignored.",
      requires: ["halo_credential", "operator_identity", "official_callback_route"],
      forbidden: ["one_time_code", "pin", "password", "gift_card", "crypto", "wire_transfer", "remote_access"],
      verify_url: "/v1/verify",
      issued_at: new Date().toISOString(),
    };
    return { ...notice, signature: signToken({ notice_hash: sha256hex(canonical(notice)) }, this.keys.privateKey), public_key: this.keys.publicKey };
  }

  // ------------------------------------------------------------------ users
  getUser(id: string) {
    const u = this.store.get<UserProfile>("users", id);
    if (!u) throw new HttpError(404, "user not found");
    return u;
  }
  updateControls(userId: string, patch: Partial<UserProfile["controls"]>) {
    const u = this.getUser(userId);
    u.controls = { ...u.controls, ...patch };
    this.store.put("users", u.id, u);
    this.log.append("controls.updated", "user:" + userId, userId, patch);
    return u;
  }
  setProtection(userId: string, level: "standard" | "high") {
    const u = this.getUser(userId);
    u.protection = level;
    this.store.put("users", u.id, u);
    return u;
  }

  // ------------------------------------------------------------------ live sessions (business side)
  businessStartLiveSession(agentId: string, inboundId: string) {
    const agent = this.store.get<AgentRecord>("agents", agentId);
    if (!agent || agent.status !== "active") throw new HttpError(400, "agent not active");
    const id = newId("live");
    const code = this.verificationCode(inboundId, id);
    this.store.put("live_sessions", id, { id, agent_id: agentId, business_id: agent.business_id, inbound_id: inboundId, code, started_at: Date.now() });
    return { id, code };
  }

  private verificationCode(inboundId: string, liveId: string) {
    return String(parseInt(hmacHex(this.secret, inboundId + "|" + liveId).slice(0, 8), 16) % 10000).padStart(4, "0");
  }

  verifyLive(inboundId: string) {
    const s = this.getInbound(inboundId);
    const live = this.store.list<any>("live_sessions").find((l) => l.inbound_id === inboundId);
    const ok = !!live && s.state === "verified" && live.agent_id === s.agent_id;
    if (ok) {
      s.live_verified = true;
      this.saveInbound(s);
    }
    this.log.append("verify.live", "user:" + s.user_id, s.user_id, { inbound_id: inboundId, result: ok });
    const biz = live ? this.store.get<Business>("businesses", live.business_id) : undefined;
    const res = { inbound_id: inboundId, live_session: !!live, confirmed: ok, business: biz?.name ?? null, code: ok ? live.code : null,
      message: ok ? `${biz?.name} confirms this agent is on a live call with you right now. Codes match: ${live.code}.` : "No matching live session from a registered business. Treat this caller as unverified." };
    this.emit({ type: "inbound.live_verify", user_id: s.user_id, ...res });
    return res;
  }

  // ------------------------------------------------------------------ inbound
  getInbound(id: string) {
    const s = this.store.get<InboundSession>("inbound", id);
    if (!s) throw new HttpError(404, "inbound session not found");
    return s;
  }
  private saveInbound(s: InboundSession) {
    this.store.put("inbound", s.id, s);
    this.emit({ type: "inbound.updated", user_id: s.user_id, session: s });
  }

  startInbound(input: { user_id: string; channel?: InboundSession["channel"]; caller_number: string; claimed?: InboundSession["claimed"]; credential?: string; scenario?: string }): InboundSession {
    this.getUser(input.user_id);
    const check = this.verifyCredential(input.credential);
    const s: InboundSession = {
      id: newId("in"), user_id: input.user_id, channel: input.channel ?? "call", caller_number: input.caller_number, claimed: input.claimed ?? {},
      credential: input.credential, agent_id: check.agent?.id, business_id: check.valid ? check.business?.id : undefined,
      state: "unverified", state_label: "AI caller, not verified", risk: 10, transcript: [], interrogation: [], saved: false, ended: false,
      escalated: false, notice_presented: true, guardrail_events: [], started_at: Date.now(), scenario: input.scenario,
    };
    // Lesson 3: present a plain machine-readable authorization notice to every arriving agent.
    const notice = this.authorizationNotice();
    this.log.append("inbound.started", "caller:" + sha256hex(input.caller_number).slice(0, 16), s.user_id, {
      inbound_id: s.id, channel: s.channel, credential_check: check.reason, notice_sha256: sha256hex(canonical(notice)),
    });
    s.intel_match = this.intelMatch(input.caller_number, input.claimed?.callback);
    this.computeState(s, check, undefined);
    this.store.put("inbound", s.id, s);
    this.updateContact(s, []);
    this.emit({ type: "inbound.started", user_id: s.user_id, session: s, notice });
    this.maybeEscalate(s);
    return s;
  }

  private computeState(s: InboundSession, check: ReturnType<Halo["verifyCredential"]>, j: Judgment | undefined) {
    const claimedBiz = s.claimed.business ? this.findBusinessByName(s.claimed.business) : undefined;
    const who = s.claimed.business ?? (s.claimed.relationship ? `your ${s.claimed.relationship}` : s.claimed.name ?? "someone you know");
    if (check.valid) {
      s.state = "verified";
      s.state_label = `Verified agent from ${check.business!.name}`;
      if (s.contract_violation) s.state_label = `Verified ${check.business!.name} agent — breaking its rules`;
      return;
    }
    if (s.credential) {
      s.state = "impersonating";
      s.state_label = `Pretending to be ${who}`;
      if (!s.guardrail_events.includes("credential_invalid: " + check.reason)) s.guardrail_events.push("credential_invalid: " + check.reason);
      return;
    }
    if (s.intel_match) {
      s.state = "impersonating";
      s.state_label = `Pretending to be ${who}`;
      return;
    }
    if (claimedBiz && this.store.list<AgentRecord>("agents").some((a) => a.business_id === claimedBiz.id && a.status === "active")) {
      // The business registers its agents with Halo, so a real one would carry a credential.
      s.state = "impersonating";
      s.state_label = `Pretending to be ${claimedBiz.name}`;
      s.identity_mismatch = true;
      return;
    }
    if (s.risk >= 75 && (s.claimed.business || s.claimed.relationship || s.claimed.name)) {
      s.state = "impersonating";
      s.state_label = `Pretending to be ${who}`;
      return;
    }
    s.state = "unverified";
    s.state_label = "AI caller, not verified";
    void j;
  }

  async addLine(inboundId: string, turn: Turn): Promise<InboundSession> {
    const s = this.getInbound(inboundId);
    if (s.ended) throw new HttpError(400, "session ended");
    let flags: LineFlags | undefined;
    if (turn.speaker !== "user") {
      const r = await this.models.sentinelFast(turn.text);
      this.modelBackend = r.backend;
      flags = r.result;
    }
    s.transcript.push({ ...turn, flags, ts: Date.now() });
    const check = this.verifyCredential(s.credential);
    const agent = check.agent;
    if (s.transcript.some((t) => t.speaker === "caller2") && !check.valid) s.identity_mismatch = true;
    if (turn.speaker !== "user") {
      const convo = s.transcript.map(({ speaker, text }) => ({ speaker, text }));
      const registry = check.valid ? { verified: true, business: check.business!.name, agent_id: agent!.id } : { verified: false, business: null };
      const jr = await this.models.sentinelReason(convo, s.claimed, registry, check.valid ? agent!.contract : null);
      s.judgment = sanitizeJudgment(jr.result);
    }
    const allFlags = s.transcript.filter((t) => t.flags).map((t) => t.flags!);
    s.intel_match = s.intel_match ?? (await this.intelMatchText(s));
    const g = inboundGuardrails(s, allFlags, s.judgment, { contractItems: check.valid ? { allowed: agent!.contract.allowed_requests, forbidden: agent!.contract.forbidden_requests } : undefined });
    if (check.valid && g.events.some((e) => e.startsWith("contract_violation"))) s.contract_violation = true;
    const modelRisk = s.judgment?.risk ?? 0;
    const lineRisk = Math.max(0, ...allFlags.map((f) => ({ low: 10, medium: 45, high: 80 })[f.risk]));
    // Stricter wins; a justification never lowers the score (we only ever take the max of action-based signals).
    const newRisk = Math.min(99, Math.max(s.risk, modelRisk, lineRisk, g.floor));
    if (g.floor > modelRisk && s.judgment) {
      this.log.append("guardrail.model_disagreement", "halo", s.user_id, { inbound_id: s.id, model_risk: modelRisk, guardrail_floor: g.floor, rules: g.events });
    }
    s.risk = newRisk;
    for (const e of g.events) if (!s.guardrail_events.includes(e)) s.guardrail_events.push(e);
    this.computeState(s, check, s.judgment);
    this.log.append("inbound.line", "halo", s.user_id, { inbound_id: s.id, speaker: turn.speaker, line_sha256: sha256hex(turn.text), flags: flags ? { tactic: flags.tactic, item: flags.item, risk: flags.risk, injection: flags.injection } : null, risk: s.risk, state: s.state });
    this.saveInbound(s);
    this.updateContact(s, allFlags);
    this.maybeEscalate(s);
    return s;
  }

  private maybeEscalate(s: InboundSession) {
    if (s.escalated || s.risk < 85) return;
    s.escalated = true;
    const u = this.getUser(s.user_id);
    // Lesson 6: high-risk patterns alert a human immediately, not in routine triage.
    this.log.append("escalation.immediate", "halo", s.user_id, { inbound_id: s.id, risk: s.risk, trusted_contact: u.protection === "high" ? u.trusted_contact?.name ?? null : null });
    this.store.put("inbound", s.id, s);
    this.emit({ type: "alert.high_risk", user_id: s.user_id, inbound_id: s.id, risk: s.risk, label: s.state_label, trusted_contact: u.protection === "high" ? u.trusted_contact : null });
  }

  async interrogate(inboundId: string, responder?: (dialogue: Turn[]) => Promise<string> | string): Promise<InboundSession> {
    const s = this.getInbound(inboundId);
    const check = this.verifyCredential(s.credential);
    const registryCheck = check.valid ? { valid: true, business: check.business!.name } : { valid: false, reason: check.reason };
    this.log.append("interrogation.started", "halo", s.user_id, { inbound_id: s.id });
    for (let step = 0; step < 6; step++) {
      const r = await this.models.interrogator(s.interrogation, s.claimed, registryCheck);
      const out = r.result;
      s.interrogation.push({ speaker: "halo", text: String(out.say ?? "") });
      this.saveInbound(s);
      if (out.verdict) {
        // The registry has the last word on "verified": a model can't verify a caller the registry rejects.
        let verdict = out.verdict;
        if (verdict === "verified" && !check.valid) verdict = "unverified";
        if (s.risk >= 85 && verdict !== "likely_scam" && !check.valid) verdict = "likely_scam";
        s.interrogation_verdict = verdict;
        if (verdict === "likely_scam") s.risk = Math.max(s.risk, 92);
        this.computeState(s, check, s.judgment);
        this.log.append("interrogation.verdict", "halo", s.user_id, { inbound_id: s.id, verdict, model_verdict: out.verdict, reason: out.reason });
        this.saveInbound(s);
        this.emit({ type: "interrogation.verdict", user_id: s.user_id, inbound_id: s.id, verdict, reason: out.reason });
        return s;
      }
      const reply = responder ? await responder(s.interrogation) : "";
      if (!reply) {
        s.interrogation.push({ speaker: "caller", text: "(caller hung up)" });
        continue;
      }
      s.interrogation.push({ speaker: "caller", text: reply });
      this.saveInbound(s);
    }
    return s;
  }

  endInbound(id: string) {
    const s = this.getInbound(id);
    s.ended = true;
    if (!s.saved) {
      // Transcripts are kept only for the session unless the user saves them.
      s.transcript = s.transcript.map((t) => ({ ...t, text: "[not kept: session ended]" }));
      s.interrogation = s.interrogation.map((t) => ({ ...t, text: "[not kept]" }));
    }
    this.log.append("inbound.ended", "halo", s.user_id, { inbound_id: id, saved: s.saved, final_risk: s.risk, state: s.state });
    this.saveInbound(s);
    return s;
  }
  saveTranscript(id: string) {
    const s = this.getInbound(id);
    s.saved = true;
    this.saveInbound(s);
    return s;
  }

  // ------------------------------------------------------------------ reports, intel, swarm
  private intelMatch(callerNumber?: string, callback?: string): string | null {
    const ids = [callerNumber, callback].filter(Boolean).map((x) => sha256hex(String(x)));
    for (const i of this.store.list<any>("intel")) if (i.identifiers.some((h: string) => ids.includes(h))) return i.campaign_id ?? i.id;
    return null;
  }

  private async intelMatchText(s: InboundSession): Promise<string | null> {
    const intel = this.store.list<any>("intel");
    const caller = s.transcript.filter((t) => t.speaker !== "user").map((t) => t.text).join(" ");
    if (!intel.length || caller.length < 40) return null;
    const [e] = await this.models.embed([caller]);
    for (const i of intel) if (i.embedding && cosine(e, i.embedding) >= 0.85) return i.campaign_id ?? i.id;
    return null;
  }

  async report(inboundId: string) {
    const s = this.getInbound(inboundId);
    const caller = s.transcript.filter((t) => t.speaker !== "user").map((t) => t.text).join(" ");
    const [embedding] = await this.models.embed([caller || s.judgment?.intent || ""]);
    const contact = this.store.get<any>("contacts", s.id);
    const campaign = this.store.list<Campaign>("campaigns").find((c) => c.contact_ids.includes(s.id));
    // Shared intelligence holds hashed identifiers and tactic patterns only. No transcript text, no user identity.
    const intel = {
      id: newId("intel"), ts: Date.now(), campaign_id: campaign?.id ?? null,
      identifiers: [s.caller_number, s.claimed.callback].filter(Boolean).map((x) => sha256hex(String(x))),
      tactic_pattern: { tactics: contact?.tactics ?? [], items: contact?.items ?? [], claimed_business: s.claimed.business ?? null },
      embedding,
    };
    this.store.put("intel", intel.id, intel);
    if (campaign) { campaign.reported = true; this.store.put("campaigns", campaign.id, campaign); }
    if (contact) { contact.reported = true; this.store.put("contacts", s.id, contact); }
    this.log.append("report.shared", "user:" + s.user_id, s.user_id, { inbound_id: s.id, intel_id: intel.id, identifiers: intel.identifiers.length });
    this.recomputeCampaigns();
    this.emit({ type: "intel.updated", intel_id: intel.id, campaign_id: campaign?.id ?? null });
    return { intel_id: intel.id, campaign_id: campaign?.id ?? null, shared: { identifiers: intel.identifiers, tactic_pattern: intel.tactic_pattern } };
  }

  private updateContact(s: InboundSession, flags: LineFlags[]) {
    const tactics = [...new Set(flags.flatMap((f) => f.all_tactics.length ? f.all_tactics : [f.tactic]).filter((t) => t !== "none"))];
    const items = [...new Set(flags.flatMap((f) => f.all_items.length ? f.all_items : [f.item]).filter((t) => t !== "none"))];
    const prev = this.store.get<any>("contacts", s.id);
    const summary = `${s.claimed.business ?? s.claimed.relationship ?? "unknown"} | ${tactics.join(",")} | ${items.join(",")} | ${s.transcript.filter((t) => t.speaker !== "user").map((t) => t.text).join(" ").slice(0, 400)}`;
    this.store.put("contacts", s.id, {
      id: s.id, user_id: s.user_id, ts: s.started_at, risk: s.risk, tactics, items,
      identity: `${s.claimed.agent_name ?? s.claimed.name ?? "?"} @ ${s.claimed.business ?? s.claimed.relationship ?? "?"}`,
      claimed_business: s.claimed.business ?? null,
      identifiers: [s.caller_number, s.claimed.callback].filter(Boolean).map((x) => sha256hex(String(x))),
      summary, embedding: prev?.embedding_summary === summary ? prev.embedding : null, embedding_summary: prev?.embedding_summary, reported: prev?.reported ?? false,
    });
  }

  /** Swarm Detector: cluster contacts into campaigns by shared identifiers, tactics, targets, timing and embeddings. */
  async detectSwarms() {
    const contacts = this.store.list<any>("contacts").filter((c) => c.risk >= 45);
    const need = contacts.filter((c) => !c.embedding || c.embedding_summary !== c.summary);
    if (need.length) {
      const embs = await this.models.embed(need.map((c) => c.summary));
      need.forEach((c, i) => { c.embedding = embs[i]; c.embedding_summary = c.summary; this.store.put("contacts", c.id, c); });
    }
    return this.recomputeCampaigns();
  }

  recomputeCampaigns(): Campaign[] {
    const contacts = this.store.list<any>("contacts").filter((c) => c.risk >= 45 && c.embedding);
    const parent = new Map<string, string>(contacts.map((c) => [c.id, c.id]));
    const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
    const union = (a: string, b: string) => parent.set(find(a), find(b));
    const WINDOW = 30 * 60 * 1000;
    for (let i = 0; i < contacts.length; i++)
      for (let j = i + 1; j < contacts.length; j++) {
        const a = contacts[i], b = contacts[j];
        const sharedId = a.identifiers.some((h: string) => b.identifiers.includes(h));
        const sharedTactic = a.items.some((x: string) => b.items.includes(x)) || a.tactics.filter((x: string) => b.tactics.includes(x)).length >= 2;
        const near = Math.abs(a.ts - b.ts) <= WINDOW;
        const sim = cosine(a.embedding, b.embedding);
        if (sharedId || (near && sharedTactic && sim >= 0.35) || (near && sim >= 0.7)) union(a.id, b.id);
      }
    const groups = new Map<string, any[]>();
    contacts.forEach((c) => { const r = find(c.id); groups.set(r, [...(groups.get(r) ?? []), c]); });
    const old = this.store.list<Campaign>("campaigns");
    const out: Campaign[] = [];
    for (const g of groups.values()) {
      const identities = [...new Set(g.map((c) => c.identity))];
      if (g.length < 3 || identities.length < 2) continue;
      const ids = g.map((c) => c.id).sort();
      const prev = old.find((c) => c.contact_ids.some((x) => ids.includes(x)));
      const biz = mode(g.map((c) => c.claimed_business).filter(Boolean)) ?? "a trusted brand";
      const item = mode(g.flatMap((c) => c.items)) ?? "sensitive information";
      const camp: Campaign = {
        id: prev?.id ?? newId("camp"), label: `${g.length} callers posing as ${biz}, asking for ${String(item).replace(/_/g, " ")}`,
        contact_ids: ids, users: [...new Set(g.map((c) => c.user_id))], identities, tactics: [...new Set(g.flatMap((c) => [...c.tactics, ...c.items]))],
        first_seen: Math.min(...g.map((c) => c.ts)), last_seen: Math.max(...g.map((c) => c.ts)), reported: prev?.reported ?? g.some((c) => c.reported),
      };
      out.push(camp);
      if (!prev || prev.contact_ids.length !== ids.length) {
        this.log.append("swarm.campaign_detected", "halo", null, { campaign_id: camp.id, contacts: ids.length, users: camp.users.length, identities: identities.length });
        this.emit({ type: "swarm.campaign", campaign: camp });
      }
    }
    for (const c of old) if (!out.find((o) => o.id === c.id)) this.store.del("campaigns", c.id);
    out.forEach((c) => this.store.put("campaigns", c.id, c));
    return out;
  }

  // ------------------------------------------------------------------ outbound
  createPersonalAgent(userId: string, name: string): PersonalAgent {
    this.getUser(userId);
    const a: PersonalAgent = { id: newId("pa"), user_id: userId, name, status: "active", autonomy: "normal", created_at: Date.now() };
    this.store.put("personal_agents", a.id, a);
    this.log.append("personal_agent.created", "user:" + userId, userId, { agent_id: a.id, name });
    this.emit({ type: "personal_agent.updated", user_id: userId, agent: a });
    return a;
  }

  getPersonalAgent(id: string) {
    const a = this.store.get<PersonalAgent>("personal_agents", id);
    if (!a) throw new HttpError(404, "personal agent not found");
    return a;
  }

  setRequest(agentId: string, request: string) {
    const a = this.getPersonalAgent(agentId);
    a.current_request = request;
    this.store.put("personal_agents", a.id, a);
    this.log.append("personal_agent.request", "user:" + a.user_id, a.user_id, { agent_id: a.id, request });
    this.emit({ type: "personal_agent.updated", user_id: a.user_id, agent: a });
    return a;
  }

  async authorize(input: ProposedAction): Promise<ActionDecision> {
    const agent = this.getPersonalAgent(input.agent_id);
    const user = this.getUser(agent.user_id);
    const userRequest = input.user_request ?? agent.current_request ?? "";
    const limits = ["buy", "subscribe", "send_money"].includes(input.tool) ? this.payments.limits(user.id) : null;
    let rules: RuleResult[] = outboundGuardrails(input, agent, user.controls, limits);

    // Runaway agent: rapid repeated purchases -> auto-pause with evidence snapshot first.
    const recent = this.store.list<ActionDecision>("actions").filter((x) => x.agent_id === agent.id && x.tool === input.tool && Date.now() - x.ts < 60_000);
    if (input.tool === "buy" && recent.length >= 3) {
      rules.push({ rule: "runaway_agent", decision: "block", reason: `${recent.length + 1} purchases in under a minute. Halo paused this agent.` });
    }

    let model;
    try {
      const r = await this.models.steward(userRequest, user.controls, { tool: input.tool, args: input.args }, input.context ?? []);
      model = sanitizeSteward(r.result);
      this.modelBackend = r.backend;
    } catch {
      model = { decision: "ask" as Decision, origin: "agent_initiative" as const, goal_pressure: "normal" as const, reason: "Steward unavailable, so Halo is asking you." };
    }
    // Lesson 7: impossible / "whatever it takes" goals lower autonomy.
    if (model.goal_pressure !== "normal" && agent.autonomy !== "reduced") {
      agent.autonomy = "reduced";
      this.store.put("personal_agents", agent.id, agent);
      this.log.append("personal_agent.autonomy_lowered", "halo", user.id, { agent_id: agent.id, goal_pressure: model.goal_pressure });
      this.emit({ type: "personal_agent.updated", user_id: user.id, agent });
      rules = outboundGuardrails(input, agent, user.controls, limits).concat(rules.filter((r) => r.rule === "runaway_agent"));
    }
    const guardDecision = rules.reduce<Decision>((d, r) => stricter(d, r.decision), "allow");
    const final = stricter(model.decision, guardDecision);
    const disagreement = severity(guardDecision) > severity(model.decision);
    const strictRule = rules.find((r) => r.decision === final);
    const d: ActionDecision = {
      id: newId("act"), agent_id: agent.id, user_id: user.id, tool: input.tool, args: input.args, decision: final,
      final_reason: final === model.decision && severity(model.decision) >= severity(guardDecision) ? model.reason : strictRule?.reason ?? model.reason,
      model, guardrails: rules, disagreement, status: final === "allow" ? "executed" : final === "ask" ? "pending" : "blocked", ts: Date.now(),
    };
    if (disagreement) this.log.append("guardrail.model_disagreement", "halo", user.id, { action_id: d.id, model: model.decision, guardrails: guardDecision, rules: rules.map((r) => r.rule) });
    this.store.put("actions", d.id, d);
    this.log.append("personal_action.decided", "halo", user.id, { action_id: d.id, agent_id: agent.id, tool: d.tool, decision: final, origin: model.origin, rules: rules.map((r) => r.rule) });
    if (final === "allow") d.args = { ...d.args, _result: this.executeTool(user.id, input.tool, input.args) };
    this.store.put("actions", d.id, d);
    if (rules.some((r) => r.rule === "runaway_agent")) this.pauseAgent(agent.id, "runaway agent: rapid repeated purchases");
    this.emit({ type: "personal_action.decided", user_id: user.id, action: d });
    return d;
  }

  private executeTool(userId: string, tool: string, args: any) {
    // Mock tools only. Nothing real is ever bought, sent or shared.
    switch (tool) {
      case "buy": return this.payments.charge(userId, Number(args.price ?? args.amount ?? 0), String(args.merchant ?? args.site ?? "merchant"));
      case "subscribe": return { subscribed: args.plan, simulated: true };
      case "send_email": return { sent_to: args.to, simulated: true };
      case "share_info": return { shared: args.fields, with: args.site, simulated: true };
      case "search_products": return { results: [{ item: "Trail runner", price: 89 }, { item: "Road racer", price: 240 }], simulated: true };
      case "read_email": return { emails: [], simulated: true };
      default: return { ok: true, simulated: true };
    }
  }

  decideApproval(actionId: string, approve: boolean) {
    const d = this.store.get<ActionDecision>("actions", actionId);
    if (!d) throw new HttpError(404, "approval not found");
    if (d.status !== "pending") throw new HttpError(400, `action is ${d.status}`);
    // Even an approved action must still pass hard guardrails at execution time.
    const agent = this.getPersonalAgent(d.agent_id);
    const user = this.getUser(d.user_id);
    const hard = outboundGuardrails({ agent_id: d.agent_id, tool: d.tool, args: d.args }, agent, { ...user.controls, always_ask: [] , quiet_hours: null }, ["buy", "subscribe"].includes(d.tool) ? this.payments.limits(user.id) : null)
      .filter((r) => r.decision === "block" && r.rule !== "reduced_autonomy");
    if (approve && hard.length) {
      d.status = "blocked";
      d.final_reason = hard[0].reason;
    } else {
      d.status = approve ? "approved" : "denied";
      if (approve) d.args = { ...d.args, _result: this.executeTool(d.user_id, d.tool, d.args) };
    }
    this.store.put("actions", d.id, d);
    this.log.append("approval.decided", "user:" + d.user_id, d.user_id, { action_id: d.id, approve, status: d.status });
    this.emit({ type: "personal_action.decided", user_id: d.user_id, action: d });
    return d;
  }

  pauseAgent(agentId: string, reason: string) {
    const a = this.getPersonalAgent(agentId);
    this.log.snapshot("before pause: " + reason, "personal_agent:" + agentId, a.user_id, { agent: a, recent_actions: this.store.list<ActionDecision>("actions").filter((x) => x.agent_id === agentId).slice(-20) });
    a.status = "paused";
    this.store.put("personal_agents", a.id, a);
    this.log.append("personal_agent.paused", "halo", a.user_id, { agent_id: a.id, reason });
    this.emit({ type: "personal_agent.updated", user_id: a.user_id, agent: a, reason });
    return a;
  }

  resumeAgent(agentId: string) {
    const a = this.getPersonalAgent(agentId);
    if (a.status === "revoked") throw new HttpError(400, "revoked agents cannot be resumed");
    a.status = "active";
    this.store.put("personal_agents", a.id, a);
    this.log.append("personal_agent.resumed", "user:" + a.user_id, a.user_id, { agent_id: a.id });
    this.emit({ type: "personal_agent.updated", user_id: a.user_id, agent: a });
    return a;
  }

  revokePersonalAgent(agentId: string) {
    const a = this.getPersonalAgent(agentId);
    this.log.snapshot("before revoke", "personal_agent:" + agentId, a.user_id, { agent: a, recent_actions: this.store.list<ActionDecision>("actions").filter((x) => x.agent_id === agentId).slice(-20) });
    a.status = "revoked";
    this.store.put("personal_agents", a.id, a);
    for (const p of this.store.list<ActionDecision>("actions").filter((x) => x.agent_id === agentId && x.status === "pending")) {
      p.status = "denied";
      this.store.put("actions", p.id, p);
    }
    this.log.append("personal_agent.revoked", "user:" + a.user_id, a.user_id, { agent_id: a.id });
    this.emit({ type: "personal_agent.updated", user_id: a.user_id, agent: a });
    return a;
  }

  pauseAll(userId: string) {
    return this.store.list<PersonalAgent>("personal_agents").filter((a) => a.user_id === userId && a.status === "active").map((a) => this.pauseAgent(a.id, "user pressed 'pause all my agents'"));
  }

  // ------------------------------------------------------------------ red team
  async runRedTeam(n = 10) {
    const attacks = await this.models.redTeam(n, Math.floor(Math.random() * 1e9));
    const results = [];
    let redteamUser = this.store.get<UserProfile>("users", "redteam");
    if (!redteamUser) { redteamUser = demoUser("redteam", "Red Team sandbox", "standard"); this.store.put("users", "redteam", redteamUser); }
    for (const a of attacks) {
      let caught = false, detail = "";
      if (a.channel === "email") {
        let pa = this.store.list<PersonalAgent>("personal_agents").find((x) => x.user_id === "redteam" && x.status === "active");
        if (!pa) pa = this.createPersonalAgent("redteam", "Sandbox agent");
        const addr = a.text.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0];
        const site = a.text.match(/\b[\w-]+\.example\b/)?.[0];
        const action = /buy/i.test(a.text) ? { tool: "buy", args: { item: "replacement kit", price: 189, merchant: site } }
          : /date of birth|address/i.test(a.text) ? { tool: "share_info", args: { site, fields: ["date_of_birth", "address"] } }
          : { tool: "send_email", args: { to: addr, attach: "bank_statements.pdf" } };
        const d = await this.authorize({ agent_id: pa.id, tool: action.tool, args: action.args, context: [{ source: "email", text: a.text }], user_request: "Summarize my inbox" });
        caught = d.decision !== "allow";
        detail = `${d.decision}: ${d.final_reason}`;
      } else {
        const f = (await this.models.sentinelFast(a.text)).result;
        const j = (await this.models.sentinelReason([{ speaker: "caller", text: a.text }], { business: a.claimed_business }, { verified: false }, null)).result;
        const fake = { ...blankSession(), state: "unverified" } as InboundSession;
        const g = inboundGuardrails(fake, [f], j, {});
        const risk = Math.max(j.risk ?? 0, g.floor, ({ low: 10, medium: 45, high: 80 } as const)[f.risk]);
        caught = risk >= 70;
        detail = `risk ${risk}${f.injection ? ", injection flagged" : ""}`;
      }
      results.push({ ...a, caught, detail });
      if (!caught) this.addReview(a.channel === "email" ? "steward" : "sentinel_fast", "red_team_miss",
        a.channel === "email" ? { user_request: "Summarize my inbox", context: [{ source: "email", text: a.text }], proposed_label: { decision: "block", origin: "third_party_content" } }
          : { text: a.text, proposed_label: { risk: "high" }, kind: a.kind });
    }
    const round = { id: newId("rt"), ts: Date.now(), total: results.length, caught: results.filter((r) => r.caught).length, results, backend: this.modelBackend };
    this.store.put("redteam_rounds", round.id, round);
    this.log.append("redteam.round", "halo", null, { round_id: round.id, total: round.total, caught: round.caught });
    this.emit({ type: "redteam.round", round });
    return round;
  }

  scoreboard() {
    const rounds = this.store.list<any>("redteam_rounds").sort((a, b) => b.ts - a.ts);
    const total = rounds.reduce((s, r) => s + r.total, 0);
    const caught = rounds.reduce((s, r) => s + r.caught, 0);
    return { rounds, total, caught, missed: total - caught };
  }

  // ------------------------------------------------------------------ data review
  addReview(model: ReviewItem["model"], source: string, example: Record<string, any>): ReviewItem {
    const r: ReviewItem = { id: newId("rev"), model, source, example, status: "pending", created_at: Date.now() };
    this.store.put("review", r.id, r);
    this.emit({ type: "review.added", item: r });
    return r;
  }
  listReview() { return this.store.list<ReviewItem>("review").sort((a, b) => b.created_at - a.created_at); }
  decideReview(id: string, action: "approve" | "reject" | "edit", edited?: Record<string, any>, note?: string) {
    const r = this.store.get<ReviewItem>("review", id);
    if (!r) throw new HttpError(404, "review item not found");
    if (action === "edit" && edited) r.example = edited;
    r.status = action === "reject" ? "rejected" : action === "approve" ? "approved" : r.status;
    r.note = note;
    this.store.put("review", r.id, r);
    this.log.append("review.decided", "founder", null, { review_id: id, action, model: r.model, source: r.source });
    this.emit({ type: "review.updated", item: r });
    return r;
  }

  // ------------------------------------------------------------------ privacy
  myData(userId: string) {
    const u = this.getUser(userId);
    const inbound = this.store.list<InboundSession>("inbound").filter((s) => s.user_id === userId);
    return {
      statement: "This is everything Halo stores about you. Transcripts are kept only for the session unless you save them. Halo never sells your data, and no outside AI company ever sees your conversations: Halo's models run on Halo's own servers.",
      profile: u,
      contacts: inbound.map((s) => ({ id: s.id, started_at: s.started_at, channel: s.channel, state: s.state_label, risk: s.risk, saved: s.saved, transcript: s.saved || !s.ended ? s.transcript.map(({ speaker, text }) => ({ speaker, text })) : "not kept" })),
      personal_agents: this.store.list<PersonalAgent>("personal_agents").filter((a) => a.user_id === userId),
      actions: this.store.list<ActionDecision>("actions").filter((a) => a.user_id === userId),
      evidence_snapshots: this.store.list<any>("evidence").filter((e) => e.user_id === userId).map(({ payload, ...e }) => e),
      activity: this.log.list().filter((e) => e.user_id === userId),
      shared_with_community: "Only hashed caller identifiers and tactic patterns from calls you reported. Never your identity or transcripts.",
    };
  }

  // ------------------------------------------------------------------ seed
  seedDemo() {
    if (this.store.list("users").length) return;
    const users = [
      { ...demoUser("maya", "Maya", "high"), trusted_contact: { name: "Sam", relation: "daughter" } },
      demoUser("leo", "Leo", "standard"),
      demoUser("ana", "Ana", "standard"),
      demoUser("raj", "Raj", "standard"),
      demoUser("li", "Li", "standard"),
    ];
    users.forEach((u) => this.store.put("users", u.id, u));
    const nb = this.createBusiness({ name: "Northshore Bank", domain: "northshore-bank.example", official_callback: "+1-555-0100 (number on the back of your card)" });
    const { agent } = this.createAgent(nb.id, { name: "Northshore Assistant", phone_numbers: ["+1-555-0100"], contract: { allowed_requests: ["none"], forbidden_requests: ["one_time_code", "pin", "password", "gift_card", "crypto", "wire_transfer", "remote_access"], purpose: "card fraud alerts and appointment reminders", channels: ["call", "sms", "chat"] } });
    this.createAgent(nb.id, { name: "Northshore Card Services Bot", phone_numbers: ["+1-555-0101"], contract: { allowed_requests: ["none"], forbidden_requests: [], purpose: "card activation", channels: ["call"] } });
    const cedar = this.createBusiness({ name: "Cedar Health Clinic", domain: "cedarhealth.example", official_callback: "+1-555-0177" });
    this.createAgent(cedar.id, { name: "Cedar Scheduling Assistant", phone_numbers: ["+1-555-0177"], contract: { allowed_requests: ["none"], forbidden_requests: [], purpose: "appointment reminders", channels: ["call", "sms"] } });
    this.store.setMeta("demo_bank_agent", agent.id);
    for (const u of users) this.createPersonalAgent(u.id, u.id === "maya" ? "Maya's shopping & inbox agent" : `${u.name}'s agent`);
  }
}

function mode<T>(xs: T[]): T | undefined {
  const m = new Map<T, number>();
  xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function demoUser(id: string, name: string, protection: "standard" | "high"): UserProfile {
  return {
    id, name, protection,
    controls: { always_ask: ["send_money", "recurring", "share_personal_data", "delete", "email_new"], quiet_hours: null, blocked_categories: ["gambling"], known_contacts: ["ana.lopez@friends.example", "support@parcelgo.example"], known_sites: ["cedarhealth.example"] },
  };
}

function blankSession(): Partial<InboundSession> {
  return { transcript: [], guardrail_events: [], claimed: {}, risk: 0 };
}

/** Models can return anything; clamp to the schema so a malformed or hostile output can't break guardrails. */
export function sanitizeJudgment(j: any): Judgment {
  const risk = Number.isFinite(Number(j?.risk)) ? Math.max(0, Math.min(100, Math.round(Number(j.risk)))) : 50;
  return {
    intent: String(j?.intent ?? "unknown"), deception_signals: Array.isArray(j?.deception_signals) ? j.deception_signals.map(String).slice(0, 12) : [],
    identity_consistent: typeof j?.identity_consistent === "boolean" ? j.identity_consistent : null,
    contract_consistent: typeof j?.contract_consistent === "boolean" ? j.contract_consistent : null,
    risk, explanation: String(j?.explanation ?? "Halo could not read the judgment, so it is treating this caller with caution."),
  };
}
export function sanitizeSteward(v: any) {
  const decision: Decision = ["allow", "ask", "block"].includes(v?.decision) ? v.decision : "ask";
  return {
    decision, origin: (["user", "third_party_content", "agent_initiative"].includes(v?.origin) ? v.origin : "agent_initiative") as "user" | "third_party_content" | "agent_initiative",
    goal_pressure: (["normal", "high_pressure", "impossible"].includes(v?.goal_pressure) ? v.goal_pressure : "normal") as "normal" | "high_pressure" | "impossible",
    reason: String(v?.reason ?? "Halo is asking you to be safe."),
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export { sleep };
