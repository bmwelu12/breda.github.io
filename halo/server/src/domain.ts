// Shared domain types for Halo.

export type Channel = 'call' | 'sms' | 'email' | 'chat';
export type VerifyState = 'verified' | 'unverified' | 'impersonation';
export type Verdict = 'allow' | 'ask' | 'block';
export type RiskBand = 'low' | 'guarded' | 'elevated' | 'high';

/** Manipulation tactics Sentinel labels per line. */
export const TACTICS = ['urgency', 'authority', 'fear', 'secrecy', 'isolation', 'impersonation'] as const;
export type Tactic = (typeof TACTICS)[number];

/** Sensitive items an agent might request. */
export const ITEMS = ['one_time_code', 'pin', 'password', 'gift_card', 'crypto', 'wire_transfer', 'remote_access', 'personal_data'] as const;
export type RequestedItem = (typeof ITEMS)[number];

/** Items Halo must NEVER let anyone obtain through it (hard guardrail). */
export const NEVER_SHARE: RequestedItem[] = ['one_time_code', 'pin', 'password'];

export interface Business {
  id: string;
  name: string;
  domain: string;
  category: string; // bank, carrier, retailer, delivery, utility…
  verified: boolean;
  createdAt: number;
}

/** A business's registered AI agent, with a behavior contract. */
export interface RegisteredAgent {
  id: string;
  businessId: string;
  businessName: string;
  displayName: string;
  purpose: string;
  channels: Channel[];
  /** Behavior contract: what this agent may and may not do. Enforced even when verified. */
  contract: {
    mayRequest: RequestedItem[];
    neverRequest: RequestedItem[];
    maxAmount: number; // 0 = may not move money
    callbackNumber: string;
    jurisdictions: string[];
  };
  credentialId: string | null;
  status: 'active' | 'revoked';
  createdAt: number;
}

export interface Line {
  idx: number;
  speaker: 'agent' | 'user' | 'halo';
  text: string;
  ts: number;
}

export interface SentinelFastResult {
  tactics: Partial<Record<Tactic, number>>;
  items: Partial<Record<RequestedItem, number>>;
  risk: number; // 0..1
  latencyMs: number;
  source: ModelSource;
}

export interface SentinelReasonResult {
  intent: string;
  deceptionSignals: string[];
  identityConsistency: 'consistent' | 'inconsistent' | 'unknown';
  contractConsistency: 'consistent' | 'violation' | 'na';
  risk: number; // 0..100
  explanation: string;
  latencyMs: number;
  source: ModelSource;
}

export interface StewardResult {
  verdict: Verdict;
  reason: string;
  offIntent: boolean;
  injected: boolean; // instruction came from email/web, not the user
  impossibleGoal: boolean;
  latencyMs: number;
  source: ModelSource;
}

/** Where a model answer came from, for honesty in the UI. */
export type ModelSource = 'finetuned' | 'base' | 'heuristic';

export interface GuardrailHit {
  rule: string;
  severity: 'block' | 'warn';
  reason: string;
}

export interface InboundSession {
  id: string;
  channel: Channel;
  claimedBusiness: string | null;
  claimedAgentId: string | null;
  matchedAgentId: string | null;
  verifyState: VerifyState;
  verifyCode: string | null;
  userId: string;
  scenario: string | null;
  lines: Line[];
  perLine: Array<{ fast: SentinelFastResult; reason?: SentinelReasonResult; guardrails: GuardrailHit[] }>;
  risk: number; // 0..100 running
  band: RiskBand;
  status: 'live' | 'ended' | 'intervened';
  campaignId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Report {
  id: string;
  sessionId: string | null;
  reporterId: string;
  claimedBusiness: string | null;
  channel: Channel;
  tactics: Tactic[];
  items: RequestedItem[];
  // hashed identifiers only — never raw content
  fingerprints: string[];
  summary: string;
  createdAt: number;
}

export interface Campaign {
  id: string;
  label: string;
  reportIds: string[];
  sessionIds: string[];
  sharedTactics: Tactic[];
  targets: number;
  fingerprints: string[];
  firstSeen: number;
  lastSeen: number;
}

export interface PersonalAgent {
  id: string;
  userId: string;
  name: string;
  model: string;
  task: string;
  status: 'active' | 'paused' | 'revoked';
  autonomy: 'full' | 'reduced' | 'minimal';
  credentialId: string | null;
  createdAt: number;
}

export interface Preferences {
  alwaysAsk: string[]; // send_money, recurring, share_personal_data, delete, email_new
  quietHours: { start: number; end: number } | null;
  blockedCategories: string[];
  highProtection: boolean;
}

export interface PersonalAction {
  id: string;
  agentId: string;
  userId: string;
  tool: string;
  params: Record<string, unknown>;
  amount: number | null;
  verdict: Verdict;
  status: 'allowed' | 'blocked' | 'pending' | 'approved' | 'rejected';
  reason: string;
  steward: StewardResult | null;
  guardrails: GuardrailHit[];
  evidenceId: string | null;
  ts: number;
  resolvedBy: string | null;
  resolvedAt: number | null;
}

export const RISK_BANDS: Array<{ band: RiskBand; min: number; label: string }> = [
  { band: 'low', min: 0, label: 'Looks fine' },
  { band: 'guarded', min: 35, label: 'Stay alert' },
  { band: 'elevated', min: 60, label: 'Likely a scam' },
  { band: 'high', min: 80, label: 'Stop — scam' },
];

export const bandForRisk = (risk: number): RiskBand =>
  [...RISK_BANDS].reverse().find((b) => risk >= b.min)!.band;
