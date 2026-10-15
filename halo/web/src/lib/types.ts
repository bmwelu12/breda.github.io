export type Channel = 'call' | 'sms' | 'email' | 'chat';
export type VerifyState = 'verified' | 'unverified' | 'impersonation';
export type Verdict = 'allow' | 'ask' | 'block';
export type RiskBand = 'low' | 'guarded' | 'elevated' | 'high';
export type ModelSource = 'finetuned' | 'base' | 'heuristic';

export interface GuardrailHit { rule: string; severity: 'block' | 'warn'; reason: string }

export interface SentinelFast { tactics: Record<string, number>; items: Record<string, number>; risk: number; latencyMs: number; source: ModelSource }
export interface SentinelReason { intent: string; deceptionSignals: string[]; identityConsistency: string; contractConsistency: string; risk: number; explanation: string; latencyMs: number; source: ModelSource }
export interface Steward { verdict: Verdict; reason: string; offIntent: boolean; injected: boolean; impossibleGoal: boolean; latencyMs: number; source: ModelSource }

export interface Line { idx: number; speaker: 'agent' | 'user' | 'halo'; text: string; ts: number }

export interface InboundSession {
  id: string; channel: Channel; claimedBusiness: string | null; matchedAgentId: string | null;
  verifyState: VerifyState; verifyCode: string | null; userId: string; scenario: string | null;
  lines: Line[]; perLine: Array<{ fast: SentinelFast; reason?: SentinelReason; guardrails: GuardrailHit[] }>;
  risk: number; band: RiskBand; status: 'live' | 'ended' | 'intervened'; campaignId: string | null;
  createdAt: number; updatedAt: number;
}

export interface RegisteredAgent {
  id: string; businessId: string; businessName: string; displayName: string; purpose: string;
  channels: Channel[]; contract: { mayRequest: string[]; neverRequest: string[]; maxAmount: number; callbackNumber: string; jurisdictions: string[] };
  status: string; createdAt: number;
}
export interface Business { id: string; name: string; domain: string; category: string; verified: boolean; createdAt: number; agents?: RegisteredAgent[] }

export interface Campaign { id: string; label: string; reportIds: string[]; sessionIds: string[]; sharedTactics: string[]; targets: number; fingerprints: string[]; firstSeen: number; lastSeen: number }

export interface PersonalAgent { id: string; userId: string; name: string; model: string; task: string; status: string; autonomy: string; createdAt: number }
export interface PersonalAction {
  id: string; agentId: string; userId: string; tool: string; params: Record<string, unknown>; amount: number | null;
  verdict: Verdict; status: 'allowed' | 'blocked' | 'pending' | 'approved' | 'rejected'; reason: string;
  steward: Steward | null; guardrails: GuardrailHit[]; evidenceId: string | null; ts: number; resolvedBy: string | null;
}
export interface Preferences { alwaysAsk: string[]; quietHours: { start: number; end: number } | null; blockedCategories: string[]; highProtection: boolean }

export interface ActivityEvent { seq: number; ts: number; type: string; actor: string; subject: string | null; summary: string; payload: unknown; prevHash: string; hash: string }
export interface VerifyResult { ok: boolean; count: number; headHash?: string; brokenAt?: number; reason?: string; checkedAt: number }

export interface RedTeamResult { runId: string; total: number; caught: number; missed: Array<{ kind: string; claimedBusiness: string | null; finalRisk: number; lines: string[] }>; byKind: Record<string, { total: number; caught: number }>; ts: number }

export interface Status { org: string; ml: { reachable: boolean; models: Record<string, { source: string; model: string | null }> }; businesses: number; agents: number; note: string }
