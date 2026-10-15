// Deterministic reference engine for the guardian models. Used as the always-available fallback
// when the Python serving service is offline or has no weights, and as the weak-labeler for
// synthetic training data. Every answer it returns is marked source: 'heuristic'.
//
// Core rule (2026 lesson #1 — judge actions, not explanations): a stated justification NEVER
// lowers the risk of what is being requested. Excuses are detected and *raise* suspicion instead.

import type {
  RegisteredAgent,
  RequestedItem,
  SentinelFastResult,
  SentinelReasonResult,
  StewardResult,
  Tactic,
} from '../domain.js';
import { ITEMS, NEVER_SHARE, TACTICS } from '../domain.js';
import { clamp, round } from '../util.js';
import {
  EXCUSE_PATTERNS,
  IMPOSSIBLE_GOAL_PATTERNS,
  INJECTED_SOURCE_PATTERNS,
  INJECTION_PATTERNS,
  ITEM_PATTERNS,
  TACTIC_PATTERNS,
} from './lexicon.js';

const hit = (text: string, pats: RegExp[]) => pats.some((p) => p.test(text));
const strength = (text: string, pats: RegExp[]) => clamp(pats.filter((p) => p.test(text)).length / Math.max(1, pats.length) + (pats.some((p) => p.test(text)) ? 0.6 : 0), 0, 1);

export function sentinelFast(text: string): Omit<SentinelFastResult, 'latencyMs' | 'source'> {
  const tactics: Partial<Record<Tactic, number>> = {};
  for (const t of TACTICS) if (hit(text, TACTIC_PATTERNS[t])) tactics[t] = round(strength(text, TACTIC_PATTERNS[t]), 2);
  const items: Partial<Record<RequestedItem, number>> = {};
  for (const it of ITEMS) if (hit(text, ITEM_PATTERNS[it])) items[it] = round(strength(text, ITEM_PATTERNS[it]), 2);

  // Risk: the REQUEST drives it. High-harm items dominate; tactics add; excuses add (never subtract).
  let risk = 0;
  for (const it of Object.keys(items) as RequestedItem[]) {
    risk += NEVER_SHARE.includes(it) ? 0.6 : ['gift_card', 'crypto', 'wire_transfer', 'remote_access'].includes(it) ? 0.45 : 0.3;
  }
  risk += Object.keys(tactics).length * 0.08;
  if (hit(text, EXCUSE_PATTERNS) && (Object.keys(items).length || Object.keys(tactics).length)) risk += 0.12; // excuse + ask = worse
  if (hit(text, INJECTION_PATTERNS)) risk += 0.5;
  return { tactics, items, risk: round(clamp(risk, 0, 1), 3) };
}

export interface ReasonContext {
  lines: { speaker: string; text: string }[];
  claimedBusiness: string | null;
  matchedAgent: RegisteredAgent | null;
  verifyState: 'verified' | 'unverified' | 'impersonation';
}

export function sentinelReason(ctx: ReasonContext): Omit<SentinelReasonResult, 'latencyMs' | 'source'> {
  const agentText = ctx.lines.filter((l) => l.speaker === 'agent').map((l) => l.text).join(' \n');
  const all = ctx.lines.map((l) => l.text).join(' \n');
  const perLine = ctx.lines.filter((l) => l.speaker === 'agent').map((l) => sentinelFast(l.text));

  const itemsAsked = new Set<string>();
  const tacticsSeen = new Set<string>();
  for (const r of perLine) {
    Object.keys(r.items).forEach((i) => itemsAsked.add(i));
    Object.keys(r.tactics).forEach((t) => tacticsSeen.add(t));
  }

  const deception: string[] = [];
  if (hit(agentText, EXCUSE_PATTERNS) && itemsAsked.size) deception.push('Pairs a sensitive request with a reassuring excuse ("for your security").');
  if (tacticsSeen.has('urgency') && itemsAsked.size) deception.push('Manufactures time pressure around a request.');
  if (tacticsSeen.has('secrecy') || tacticsSeen.has('isolation')) deception.push('Tries to keep the person from checking with anyone else.');
  if (hit(all, INJECTION_PATTERNS)) deception.push('Contains text aimed at Halo itself (prompt injection).');
  const neverItems = [...itemsAsked].filter((i) => NEVER_SHARE.includes(i as any));
  if (neverItems.length) deception.push(`Requests credentials that no legitimate agent asks for: ${neverItems.join(', ')}.`);

  // Identity consistency: does the claim match a verified record?
  let identityConsistency: SentinelReasonResult['identityConsistency'] = 'unknown';
  if (ctx.verifyState === 'impersonation') identityConsistency = 'inconsistent';
  else if (ctx.verifyState === 'verified' && ctx.matchedAgent) identityConsistency = 'consistent';

  // Contract consistency for verified agents: did it ask for something its contract forbids?
  let contractConsistency: SentinelReasonResult['contractConsistency'] = ctx.matchedAgent ? 'consistent' : 'na';
  if (ctx.matchedAgent) {
    const forbidden = [...ctx.matchedAgent.contract.neverRequest, ...NEVER_SHARE];
    if ([...itemsAsked].some((i) => forbidden.includes(i as any))) contractConsistency = 'violation';
  }

  // Risk: driven by what was asked and done, not by the explanation.
  let risk = Math.max(0, ...perLine.map((r) => r.risk)) * 70;
  risk += (itemsAsked.size - 1) * 6;
  // High-harm payment/access asks are scams regardless of how they're justified.
  const HIGH_HARM = ['gift_card', 'crypto', 'wire_transfer', 'remote_access'];
  if ([...itemsAsked].some((i) => HIGH_HARM.includes(i))) risk = Math.max(risk, 68);
  if (contractConsistency === 'violation') risk = Math.max(risk, 78);
  if (identityConsistency === 'inconsistent') risk = Math.max(risk, 85);
  if (neverItems.length) risk = Math.max(risk, 82);
  if (deception.find((d) => d.includes('prompt injection'))) risk = Math.max(risk, 80);
  // A verified, contract-consistent agent asking for nothing sensitive stays low.
  if (ctx.verifyState === 'verified' && contractConsistency === 'consistent' && !itemsAsked.size) risk = Math.min(risk, 12);

  const intent = describeIntent([...itemsAsked], [...tacticsSeen]);
  const explanation = buildExplanation(risk, ctx, [...itemsAsked], deception);
  return {
    intent,
    deceptionSignals: deception,
    identityConsistency,
    contractConsistency,
    risk: Math.round(clamp(risk, 0, 100)),
    explanation,
  };
}

function describeIntent(items: string[], tactics: string[]): string {
  if (!items.length && !tactics.length) return 'Routine contact with no sensitive request so far.';
  if (items.length) return `Trying to obtain ${items.join(', ').replace(/_/g, ' ')}${tactics.length ? ` using ${tactics.join(', ')}` : ''}.`;
  return `Applying pressure (${tactics.join(', ')}) without a concrete ask yet — possible slow-burn setup.`;
}

function buildExplanation(risk: number, ctx: ReasonContext, items: string[], deception: string[]): string {
  if (ctx.verifyState === 'impersonation') return `Claims to be ${ctx.claimedBusiness} but no matching verified agent exists — likely impersonation.`;
  if (risk >= 80) return `High risk: ${deception[0] ?? 'behaviour matches known scam patterns'} Do not share codes, money or access.`;
  if (risk >= 60) return `Likely a scam: ${deception[0] ?? 'the request does not fit a legitimate interaction'}.`;
  if (items.length) return `Asked for ${items.join(', ').replace(/_/g, ' ')}; treat with caution and verify independently.`;
  return ctx.verifyState === 'verified' ? 'Verified agent behaving within its contract so far.' : 'Unverified AI caller; nothing harmful requested yet.';
}

export interface StewardContext {
  tool: string;
  params: Record<string, unknown>;
  amount: number | null;
  userRequest: string; // what the person actually asked for
  preferences: { alwaysAsk: string[]; blockedCategories: string[] };
  sourceText?: string; // the agent's reasoning / where the instruction came from
}

export function steward(ctx: StewardContext): Omit<StewardResult, 'latencyMs' | 'source'> {
  const reasons: string[] = [];
  let verdict: StewardResult['verdict'] = 'allow';
  const bump = (v: StewardResult['verdict']) => {
    if (v === 'block' || verdict === 'block') verdict = 'block';
    else if (v === 'ask') verdict = 'ask';
  };

  const source = (ctx.sourceText ?? '') + ' ' + JSON.stringify(ctx.params);
  const injected = hit(source, INJECTED_SOURCE_PATTERNS) || hit(source, INJECTION_PATTERNS);
  const impossibleGoal = hit(ctx.userRequest, IMPOSSIBLE_GOAL_PATTERNS);

  // Off-intent: does the action match what the user asked for? (very simple token/constraint check)
  const req = ctx.userRequest.toLowerCase();
  const budget = req.match(/(?:under|below|max|less than)\s*\$?\s*(\d[\d,]*)/);
  let offIntent = false;
  if (budget && ctx.amount != null && ctx.amount > Number(budget[1].replace(/,/g, ''))) {
    offIntent = true;
    reasons.push(`You asked to stay under $${budget[1]}, but this is $${ctx.amount}.`);
    bump('block');
  }

  if (injected) {
    reasons.push('This instruction came from an email or web page, not from you.');
    bump('block');
  }
  if (impossibleGoal) {
    reasons.push('Your goal was open-ended ("whatever it takes"), so Halo is holding risky steps and lowering the agent\'s autonomy.');
    bump('ask');
  }

  // Preference-gated tools.
  const gate: Record<string, string> = {
    buy: 'send_money', send_money: 'send_money', subscribe: 'recurring',
    share_info: 'share_personal_data', send_email: 'email_new', delete: 'delete',
  };
  const pref = gate[ctx.tool];
  if (pref && ctx.preferences.alwaysAsk.includes(pref)) {
    reasons.push(`Your settings say always ask before ${pref.replace(/_/g, ' ')}.`);
    bump('ask');
  }
  if (ctx.tool === 'subscribe') { reasons.push('Recurring sign-up — held for your ok.'); bump('ask'); }
  if (ctx.tool === 'share_info') {
    const sensitive = /ssn|social security|date of birth|dob|passport|card number|address/i.test(JSON.stringify(ctx.params));
    if (sensitive) { reasons.push('Sharing personal data with an unfamiliar destination.'); bump('ask'); }
  }

  if (verdict === 'allow') reasons.push('Matches your request and preferences.');
  return {
    verdict,
    reason: reasons.join(' '),
    offIntent,
    injected,
    impossibleGoal,
  };
}

/** Interrogator: generate safe, firm challenge questions and a verdict. Never reveals user info. */
export function interrogator(ctx: ReasonContext): { questions: string[]; verdict: 'verified' | 'suspicious' | 'fraudulent'; note: string } {
  const r = sentinelReason(ctx);
  const questions = [
    'Which company do you represent, and what is your registered agent ID with Halo?',
    'I will not share any codes, passwords or personal details. What is the official callback number listed for your business?',
    'What is the reason for this contact, and can it wait until I call that number back?',
  ];
  if (r.contractConsistency === 'violation' || r.identityConsistency === 'inconsistent') {
    questions.push('Your request does not match what a verified agent for this business is permitted to ask. Please explain.');
  }
  const verdict = ctx.verifyState === 'impersonation' || r.risk >= 80 ? 'fraudulent' : r.risk >= 55 ? 'suspicious' : 'verified';
  const note =
    verdict === 'fraudulent'
      ? 'This caller is not a verified agent and is using scam tactics. Do not continue.'
      : verdict === 'suspicious'
        ? 'This caller could not satisfy verification. Treat as unverified; call the business back on an official number.'
        : 'This caller answered consistently and stayed within bounds.';
  return { questions, verdict, note };
}
