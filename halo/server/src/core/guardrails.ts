// Hard guardrails: deterministic rules no model can override. If a model says "allow" and a
// guardrail says "block", the stricter outcome wins and the disagreement is logged.

import type { GuardrailHit, RegisteredAgent, RequestedItem, Verdict } from '../domain.js';
import { NEVER_SHARE } from '../domain.js';
import { ITEM_PATTERNS } from '../ml/lexicon.js';

export interface InboundGuardInput {
  text: string;
  itemsDetected: RequestedItem[];
  verifyState: 'verified' | 'unverified' | 'impersonation';
  matchedAgent: RegisteredAgent | null;
  credentialValid: boolean;
}

/** Inbound guardrails applied to each line from an arriving agent. */
export function inboundGuardrails(i: InboundGuardInput): GuardrailHit[] {
  const hits: GuardrailHit[] = [];
  const items = new Set<RequestedItem>(i.itemsDetected);
  for (const [item, pats] of Object.entries(ITEM_PATTERNS) as [RequestedItem, RegExp[]][]) {
    if (pats.some((p) => p.test(i.text))) items.add(item);
  }

  // 1. Never let anyone obtain OTP / PIN / password through Halo — regardless of verification.
  for (const item of items) {
    if (NEVER_SHARE.includes(item)) {
      hits.push({ rule: 'never_share_secret', severity: 'block', reason: `Requests a ${item.replace(/_/g, ' ')}. Halo never lets anyone obtain one-time codes, PINs or passwords.` });
    }
  }

  // 2. Impersonation / forged or revoked credential is always blocked.
  if (i.verifyState === 'impersonation') {
    hits.push({ rule: 'impersonation', severity: 'block', reason: 'Claims a business identity with no matching verified agent.' });
  }
  if (i.matchedAgent && !i.credentialValid) {
    hits.push({ rule: 'revoked_credential', severity: 'block', reason: 'The agent\'s Halo credential is revoked or invalid.' });
  }

  // 3. Behavior-contract enforcement, even for verified agents.
  if (i.matchedAgent) {
    for (const item of items) {
      if (i.matchedAgent.contract.neverRequest.includes(item)) {
        hits.push({ rule: 'contract_violation', severity: 'block', reason: `${i.matchedAgent.businessName}'s registered agent is not permitted to request a ${item.replace(/_/g, ' ')}.` });
      }
    }
  }
  return hits;
}

export interface OutboundGuardInput {
  tool: string;
  amount: number | null;
  params: Record<string, unknown>;
  paymentLimit: number; // from the payment adapter
}

/** Outbound guardrails applied to a personal agent's proposed action. */
export function outboundGuardrails(i: OutboundGuardInput): GuardrailHit[] {
  const hits: GuardrailHit[] = [];
  const text = JSON.stringify(i.params).toLowerCase();

  // 1. Never exfiltrate secrets on the user's behalf.
  if (/\b(one.?time code|otp|\bpin\b|password|2fa)\b/.test(text)) {
    hits.push({ rule: 'never_share_secret', severity: 'block', reason: 'This action would share a one-time code, PIN or password. Halo never allows that.' });
  }
  // 2. Enforce payment limits from the payment adapter.
  if (i.amount != null && i.amount > i.paymentLimit) {
    hits.push({ rule: 'payment_limit', severity: 'block', reason: `$${i.amount} exceeds the payment limit of $${i.paymentLimit}.` });
  }
  return hits;
}

/**
 * Reconcile a model verdict with guardrail hits. The stricter outcome always wins; any
 * disagreement (model lenient, guardrail strict) is surfaced for logging.
 */
export function reconcile(modelVerdict: Verdict, hits: GuardrailHit[]): { verdict: Verdict; overrode: boolean } {
  const blocked = hits.some((h) => h.severity === 'block');
  const warned = hits.some((h) => h.severity === 'warn');
  const strict: Verdict = blocked ? 'block' : warned && modelVerdict === 'allow' ? 'ask' : modelVerdict;
  const rank: Record<Verdict, number> = { allow: 0, ask: 1, block: 2 };
  const final = rank[strict] >= rank[modelVerdict] ? strict : modelVerdict;
  return { verdict: final, overrode: blocked && modelVerdict !== 'block' };
}
