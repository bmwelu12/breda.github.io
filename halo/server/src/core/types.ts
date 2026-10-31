// Shared types for the Halo engine (browser-safe: no Node imports).

export type Tactic = "none" | "urgency" | "authority" | "fear" | "secrecy" | "isolation" | "impersonation";
export type Item =
  | "none" | "one_time_code" | "pin" | "password" | "gift_card" | "crypto" | "wire_transfer" | "remote_access" | "personal_data";
export type RiskLevel = "low" | "medium" | "high";

export interface LineFlags {
  tactic: Tactic;
  item: Item;
  risk: RiskLevel;
  all_tactics: Tactic[];
  all_items: Item[];
  injection: boolean;
  scores?: Record<string, number>;
}

export interface Judgment {
  intent: string;
  deception_signals: string[];
  identity_consistent: boolean | null;
  contract_consistent: boolean | null;
  risk: number;
  explanation: string;
}

export interface StewardVerdict {
  decision: "allow" | "ask" | "block";
  origin: "user" | "third_party_content" | "agent_initiative";
  goal_pressure: "normal" | "high_pressure" | "impossible";
  reason: string;
}

export interface InterrogatorTurn {
  say: string;
  verdict: null | "verified" | "unverified" | "likely_scam";
  reason: string | null;
}

export interface Turn {
  speaker: string; // "caller" | "caller2" | "user" | "halo"
  text: string;
}

export interface ModelMeta {
  backend: string; // "hf" | "stub" | "browser-heuristic" | "mock"
  latency_ms: number;
}

export interface BehaviorContract {
  allowed_requests: Item[];
  forbidden_requests: Item[];
  channels: string[];
  purpose: string;
}

export interface Business {
  id: string;
  name: string;
  domain: string;
  official_callback: string;
  created_at: number;
}

export interface AgentRecord {
  id: string;
  business_id: string;
  name: string;
  phone_numbers: string[];
  contract: BehaviorContract;
  credential: string; // signed token
  status: "active" | "revoked";
  created_at: number;
}

export type InboundState = "verified" | "unverified" | "impersonating";

export interface InboundSession {
  id: string;
  user_id: string;
  channel: "call" | "sms" | "email" | "chat";
  caller_number: string;
  claimed: { business?: string; agent_name?: string; relationship?: string; name?: string; callback?: string };
  credential?: string;
  agent_id?: string;
  business_id?: string;
  state: InboundState;
  state_label: string;
  risk: number;
  transcript: (Turn & { flags?: LineFlags; ts: number })[];
  judgment?: Judgment;
  verification_code?: string;
  live_verified?: boolean;
  contract_violation?: boolean;
  identity_mismatch?: boolean;
  intel_match?: string | null;
  interrogation: Turn[];
  interrogation_verdict?: InterrogatorTurn["verdict"];
  saved: boolean;
  ended: boolean;
  escalated: boolean;
  notice_presented: boolean;
  guardrail_events: string[];
  started_at: number;
  scenario?: string;
}

export interface PersonalAgent {
  id: string;
  user_id: string;
  name: string;
  status: "active" | "paused" | "revoked";
  autonomy: "normal" | "reduced";
  current_request?: string;
  created_at: number;
}

export interface Controls {
  always_ask: string[]; // send_money, recurring, share_personal_data, delete, email_new
  quiet_hours: { start: number; end: number } | null;
  blocked_categories: string[];
  known_contacts: string[];
  known_sites: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  protection: "standard" | "high";
  trusted_contact?: { name: string; relation: string };
  controls: Controls;
}

export interface ProposedAction {
  agent_id: string;
  tool: string;
  args: Record<string, any>;
  context?: { source: string; text: string }[];
  user_request?: string;
}

export interface ActionDecision {
  id: string;
  agent_id: string;
  user_id: string;
  tool: string;
  args: Record<string, any>;
  decision: "allow" | "ask" | "block";
  final_reason: string;
  model?: StewardVerdict;
  guardrails: { rule: string; decision: "allow" | "ask" | "block"; reason: string }[];
  disagreement: boolean;
  status: "executed" | "pending" | "approved" | "denied" | "blocked";
  ts: number;
}

export interface Campaign {
  id: string;
  label: string;
  contact_ids: string[];
  users: string[];
  identities: string[];
  tactics: string[];
  first_seen: number;
  last_seen: number;
  reported: boolean;
}

export interface ReviewItem {
  id: string;
  model: "sentinel_fast" | "sentinel_reason" | "steward" | "interrogator";
  source: string;
  example: Record<string, any>;
  status: "pending" | "approved" | "rejected";
  note?: string;
  created_at: number;
}

export interface ActivityEntry {
  seq: number;
  ts: number;
  type: string;
  actor: string;
  user_id: string | null;
  data: Record<string, any>;
  prev_hash: string;
  hash: string;
}

export interface HaloEvent {
  type: string;
  user_id?: string | null;
  [k: string]: any;
}
