// Hard guardrails: deterministic rules no model can override. Stricter outcome always wins.
import type { Controls, InboundSession, Item, Judgment, LineFlags, PersonalAgent, ProposedAction } from "./types.ts";

export const SECRET_ITEMS: Item[] = ["one_time_code", "pin", "password"];
export const MONEY_ITEMS: Item[] = ["gift_card", "crypto", "wire_transfer"];
const SECRET_TEXT = /\b\d{4,8}\b.*\b(code|otp|pin)\b|\b(code|otp|pin|password)\b[^.]{0,20}\b\d{4,8}\b|password\s*[:=]/i;

export interface InboundGuard { floor: number; events: string[] }

/** Risk floor computed ONLY from what was requested/done. Explanations never lower it (lesson 1). */
export function inboundGuardrails(s: InboundSession, lineFlags: LineFlags[], judgment: Judgment | undefined, ctx: { contractItems?: { allowed: Item[]; forbidden: Item[] } }): InboundGuard {
  const events: string[] = [];
  let floor = 0;
  const items = new Set(lineFlags.flatMap((f) => [f.item, ...f.all_items]).filter((i) => i !== "none"));
  if ([...items].some((i) => SECRET_ITEMS.includes(i))) {
    floor = Math.max(floor, 90);
    events.push("secret_requested: Halo never lets anyone obtain one-time codes, PINs or passwords");
  }
  if ([...items].some((i) => MONEY_ITEMS.includes(i) || i === "remote_access") && s.state !== "verified") {
    floor = Math.max(floor, 85);
    events.push("irreversible_payment_or_remote_access_requested_by_unverified_caller");
  }
  if (lineFlags.some((f) => f.injection)) {
    floor = Math.max(floor, 85);
    events.push("instruction_to_halo_ignored: caller text is data, not instructions");
  }
  if (ctx.contractItems) {
    const bad = [...items].filter((i) => !ctx.contractItems!.allowed.includes(i) || ctx.contractItems!.forbidden.includes(i));
    if (bad.length) {
      floor = Math.max(floor, 85);
      events.push(`contract_violation: asked for ${bad.join(", ")}`);
    }
  }
  if (s.intel_match) {
    floor = Math.max(floor, 90);
    events.push("matches_reported_campaign");
  }
  if (s.identity_mismatch) {
    floor = Math.max(floor, 70);
    events.push("identity_claim_does_not_match_records");
  }
  if (judgment && judgment.risk < floor) events.push(`model_risk_${judgment.risk}_raised_to_floor_${floor}`);
  return { floor, events };
}

export type Decision = "allow" | "ask" | "block";
export const severity = (d: Decision) => ({ allow: 0, ask: 1, block: 2 })[d];
export const stricter = (a: Decision, b: Decision): Decision => (severity(a) >= severity(b) ? a : b);

export interface PaymentLimits { per_transaction: number; daily: number; spent_today: number }

export interface RuleResult { rule: string; decision: Decision; reason: string }

const PERSONAL_FIELDS = ["date_of_birth", "address", "ssn", "phone", "card", "passport", "bank_account"];
const SECRET_FIELDS = ["one_time_code", "otp", "pin", "password"];

export function outboundGuardrails(a: ProposedAction, agent: PersonalAgent, controls: Controls, limits: PaymentLimits | null, now = new Date()): RuleResult[] {
  const r: RuleResult[] = [];
  const args = a.args ?? {};
  if (agent.status !== "active") r.push({ rule: "agent_not_active", decision: "block", reason: `This agent is ${agent.status}.` });
  const fields: string[] = args.fields ?? [];
  const blob = JSON.stringify(args);
  if (fields.some((f) => SECRET_FIELDS.includes(f)) || SECRET_TEXT.test(blob))
    r.push({ rule: "never_share_secrets", decision: "block", reason: "Halo never lets one-time codes, PINs or passwords leave through an agent." });
  if (a.tool === "buy" || a.tool === "subscribe" || a.tool === "send_money") {
    const amount = Number(args.price ?? args.amount ?? 0);
    if (limits) {
      if (amount > limits.per_transaction) r.push({ rule: "payment_limit_per_transaction", decision: "block", reason: `$${amount} is over your $${limits.per_transaction} per-purchase limit.` });
      else if (limits.spent_today + amount > limits.daily) r.push({ rule: "payment_limit_daily", decision: "block", reason: `This would pass your $${limits.daily} daily limit.` });
    }
    if (controls.always_ask.includes("send_money")) r.push({ rule: "always_ask_money", decision: "ask", reason: "You asked to approve every payment." });
    if (args.category && controls.blocked_categories.includes(String(args.category)))
      r.push({ rule: "blocked_category", decision: "block", reason: `${args.category} is a blocked category.` });
  }
  if (a.tool === "subscribe" && controls.always_ask.includes("recurring")) r.push({ rule: "always_ask_recurring", decision: "ask", reason: "Recurring sign-ups always need your OK." });
  if (a.tool === "share_info" && fields.some((f) => PERSONAL_FIELDS.includes(f)) && controls.always_ask.includes("share_personal_data"))
    r.push({ rule: "always_ask_personal_data", decision: "ask", reason: `Sharing ${fields.filter((f) => PERSONAL_FIELDS.includes(f)).join(", ").replace(/_/g, " ")} needs your OK.` });
  if (a.tool === "delete" && controls.always_ask.includes("delete")) r.push({ rule: "always_ask_delete", decision: "ask", reason: "Deleting always needs your OK." });
  if (a.tool === "send_email" && controls.always_ask.includes("email_new") && args.to && !controls.known_contacts.includes(String(args.to).toLowerCase()))
    r.push({ rule: "always_ask_new_recipient", decision: "ask", reason: `${args.to} isn't someone you've emailed before.` });
  if (controls.quiet_hours && ["buy", "send_email", "subscribe", "share_info", "delete"].includes(a.tool)) {
    const h = now.getHours();
    const { start, end } = controls.quiet_hours;
    const inQuiet = start <= end ? h >= start && h < end : h >= start || h < end;
    if (inQuiet) r.push({ rule: "quiet_hours", decision: "ask", reason: "It's your quiet hours, so Halo is holding this." });
  }
  if (agent.autonomy === "reduced" && ["buy", "send_email", "subscribe", "share_info", "delete"].includes(a.tool))
    r.push({ rule: "reduced_autonomy", decision: "ask", reason: "This agent's autonomy was lowered, so every step needs your OK." });
  return r;
}
