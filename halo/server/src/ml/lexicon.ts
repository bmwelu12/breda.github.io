// Shared signal lexicon for the heuristic guardian engine. Mirrored in ml/serve for Python.
// The lexicon is also what the data pipeline uses to weak-label synthetic lines before human review.

import type { RequestedItem, Tactic } from '../domain.js';

export const TACTIC_PATTERNS: Record<Tactic, RegExp[]> = {
  urgency: [/\b(urgent|immediately|right now|within \d+ ?(min|minutes|hours)|expires?|deadline|last chance|act now|hurry|time.?sensitive)\b/i],
  authority: [/\b(fraud department|security team|federal|irs|police|officer|investigator|on behalf of|official|compliance|account manager|supervisor)\b/i],
  fear: [/\b(suspended|locked|compromised|breach|unauthorI?zed|arrest|lawsuit|penalty|frozen|closed your account|lose (your )?money|hacked)\b/i],
  secrecy: [/\b(don'?t tell|do not tell|keep this (between|confidential)|do not (share|hang up|discuss)|stay on the (line|phone)|secret|just between us)\b/i],
  isolation: [/\b(don'?t (call|contact|talk to)|only (deal|speak) with me|no one else|don'?t involve|hang up on anyone)\b/i],
  impersonation: [/\b(this is .* from|calling from your bank|i'?m with|represent(ing)?|on behalf of) \b/i],
};

export const ITEM_PATTERNS: Record<RequestedItem, RegExp[]> = {
  one_time_code: [/\b(one.?time (code|passcode)|otp|verification code|security code|2fa|6.?digit code|code (we|i) (just )?sent)\b/i],
  pin: [/\b(pin|personal identification number|card pin|atm pin)\b/i],
  password: [/\b(password|passphrase|login credentials|username and password)\b/i],
  gift_card: [/\b(gift.?card|google play card|apple card|steam card|itunes|voucher code)\b/i],
  crypto: [/\b(bitcoin|btc|crypto|usdt|ethereum|wallet address|coinbase)\b/i],
  wire_transfer: [/\b(wire( transfer)?|bank transfer|zelle|western union|moneygram|routing number|send \$?\d)\b/i],
  remote_access: [/\b(anydesk|teamviewer|remote (access|desktop|session)|install (this )?app|screen.?share)\b/i],
  personal_data: [/\b(social security|ssn|date of birth|dob|mother'?s maiden|full card number|account number|address and)\b/i],
};

/** Phrases that look like an attempt to instruct the guardian itself (prompt injection). */
export const INJECTION_PATTERNS: RegExp[] = [
  /\bignore (all |your |previous )?(instructions|rules|guidelines)\b/i,
  /\b(you are|act as|pretend to be) (now )?(a |an )?(different|unrestricted|dev(eloper)? mode)\b/i,
  /\bmark (this|the) (caller|agent|message) (as )?(verified|safe|trusted)\b/i,
  /\b(override|disable|bypass) (the )?(halo|guardian|safety|security|filter)\b/i,
  /\bsystem prompt\b/i,
  /\bdo not (flag|block|warn|alert)\b/i,
];

/** Excuses that sound reasonable but must never lower the risk of what is being requested. */
export const EXCUSE_PATTERNS: RegExp[] = [
  /\b(for (your )?(security|verification|protection|safety)|to (verify|confirm|protect) (your )?(identity|account)|standard procedure|routine (check|verification)|we('| a)re required to)\b/i,
];

export const IMPOSSIBLE_GOAL_PATTERNS: RegExp[] = [
  /\b(whatever it takes|no matter what|at (any|all) costs?|by any means|don'?t (stop|take no)|get it done however)\b/i,
];

/** Signals that an instruction originated from fetched content, not the user. */
export const INJECTED_SOURCE_PATTERNS: RegExp[] = [
  /\b(the (email|message|website|page|seller|listing) (says|instructs|asks|told|wants)|per the (email|instructions in)|according to the (email|site))\b/i,
];
