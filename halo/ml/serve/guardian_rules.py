"""Deterministic guardian engine (Python) — mirrors server/src/ml/heuristic.ts.

Used as the always-available fallback when fine-tuned / base weights are not loaded, and as the
weak-labeler for synthetic training data. Core rule: a stated justification NEVER lowers the risk
of what is requested (2026 lesson #1 — judge actions, not explanations).
"""
from __future__ import annotations
import math
import re
from typing import Any

TACTICS = ["urgency", "authority", "fear", "secrecy", "isolation", "impersonation"]
ITEMS = ["one_time_code", "pin", "password", "gift_card", "crypto", "wire_transfer", "remote_access", "personal_data"]
NEVER_SHARE = {"one_time_code", "pin", "password"}
HIGH_HARM = {"gift_card", "crypto", "wire_transfer", "remote_access"}

TACTIC_PATTERNS = {
    "urgency": [r"\b(urgent|immediately|right now|within \d+ ?(min|minutes|hours)|expires?|deadline|last chance|act now|hurry|time.?sensitive)\b"],
    "authority": [r"\b(fraud department|security team|federal|irs|police|officer|investigator|on behalf of|official|compliance|account manager|supervisor)\b"],
    "fear": [r"\b(suspended|locked|compromised|breach|unauthori[sz]ed|arrest|lawsuit|penalty|frozen|closed your account|lose (your )?money|hacked)\b"],
    "secrecy": [r"\b(don'?t tell|do not tell|keep this (between|confidential)|do not (share|hang up|discuss)|stay on the (line|phone)|secret|just between us)\b"],
    "isolation": [r"\b(don'?t (call|contact|talk to)|only (deal|speak) with me|no one else|don'?t involve|hang up on anyone)\b"],
    "impersonation": [r"\b(this is .* from|calling from your bank|i'?m with|represent(ing)?|on behalf of) \b"],
}
ITEM_PATTERNS = {
    "one_time_code": [r"\b(one.?time (code|passcode)|otp|verification code|security code|2fa|6.?digit code|code (we|i) (just )?sent)\b"],
    "pin": [r"\b(pin|personal identification number|card pin|atm pin)\b"],
    "password": [r"\b(password|passphrase|login credentials|username and password)\b"],
    "gift_card": [r"\b(gift.?card|google play card|apple card|steam card|itunes|voucher code)\b"],
    "crypto": [r"\b(bitcoin|btc|crypto|usdt|ethereum|wallet address|coinbase)\b"],
    "wire_transfer": [r"\b(wire( transfer)?|bank transfer|zelle|western union|moneygram|routing number|send \$?\d)\b"],
    "remote_access": [r"\b(anydesk|teamviewer|remote (access|desktop|session)|install (this )?app|screen.?share)\b"],
    "personal_data": [r"\b(social security|ssn|date of birth|dob|mother'?s maiden|full card number|account number|address and)\b"],
}
INJECTION_PATTERNS = [
    r"\bignore (all |your |previous )?(instructions|rules|guidelines)\b",
    r"\b(you are|act as|pretend to be) (now )?(a |an )?(different|unrestricted|dev(eloper)? mode)\b",
    r"\bmark (this|the) (caller|agent|message) (as )?(verified|safe|trusted)\b",
    r"\b(override|disable|bypass) (the )?(halo|guardian|safety|security|filter)\b",
    r"\bsystem prompt\b", r"\bdo not (flag|block|warn|alert)\b",
]
EXCUSE_PATTERNS = [r"\b(for (your )?(security|verification|protection|safety)|to (verify|confirm|protect) (your )?(identity|account)|standard procedure|routine (check|verification)|we('| a)re required to)\b"]
IMPOSSIBLE_GOAL_PATTERNS = [r"\b(whatever it takes|no matter what|at (any|all) costs?|by any means|don'?t (stop|take no)|get it done however)\b"]
INJECTED_SOURCE_PATTERNS = [r"\b(the (email|message|website|page|seller|listing) (says|instructs|asks|told|wants)|per the (email|instructions in)|according to the (email|site))\b"]


def _hit(text: str, pats: list[str]) -> bool:
    return any(re.search(p, text, re.I) for p in pats)


def sentinel_fast(text: str) -> dict[str, Any]:
    tactics = {t: 1.0 for t in TACTICS if _hit(text, TACTIC_PATTERNS[t])}
    items = {it: 1.0 for it in ITEMS if _hit(text, ITEM_PATTERNS[it])}
    risk = 0.0
    for it in items:
        risk += 0.6 if it in NEVER_SHARE else (0.45 if it in HIGH_HARM else 0.3)
    risk += len(tactics) * 0.08
    if _hit(text, EXCUSE_PATTERNS) and (items or tactics):
        risk += 0.12
    if _hit(text, INJECTION_PATTERNS):
        risk += 0.5
    return {"tactics": tactics, "items": items, "risk": round(min(risk, 1.0), 3)}


def sentinel_reason(ctx: dict[str, Any]) -> dict[str, Any]:
    lines = ctx.get("lines", [])
    agent_lines = [l for l in lines if l.get("speaker") == "agent"]
    per = [sentinel_fast(l["text"]) for l in agent_lines]
    items = set().union(*[set(p["items"]) for p in per]) if per else set()
    tactics = set().union(*[set(p["tactics"]) for p in per]) if per else set()
    verify_state = ctx.get("verifyState", "unverified")
    matched = ctx.get("matchedAgent")

    deception = []
    if _hit(" ".join(l["text"] for l in agent_lines), EXCUSE_PATTERNS) and items:
        deception.append('Pairs a sensitive request with a reassuring excuse ("for your security").')
    if "urgency" in tactics and items:
        deception.append("Manufactures time pressure around a request.")
    if "secrecy" in tactics or "isolation" in tactics:
        deception.append("Tries to keep the person from checking with anyone else.")
    if _hit(" ".join(l["text"] for l in lines), INJECTION_PATTERNS):
        deception.append("Contains text aimed at Halo itself (prompt injection).")
    never = [i for i in items if i in NEVER_SHARE]
    if never:
        deception.append(f"Requests credentials no legitimate agent asks for: {', '.join(never)}.")

    identity = "unknown"
    if verify_state == "impersonation":
        identity = "inconsistent"
    elif verify_state == "verified" and matched:
        identity = "consistent"
    contract = "na"
    if matched:
        forbidden = set(matched.get("contract", {}).get("neverRequest", [])) | NEVER_SHARE
        contract = "violation" if (items & forbidden) else "consistent"

    risk = (max([p["risk"] for p in per], default=0.0)) * 70
    risk += max(0, len(items) - 1) * 6
    if items & HIGH_HARM:
        risk = max(risk, 68)
    if contract == "violation":
        risk = max(risk, 78)
    if identity == "inconsistent":
        risk = max(risk, 85)
    if never:
        risk = max(risk, 82)
    if any("injection" in d for d in deception):
        risk = max(risk, 80)
    if verify_state == "verified" and contract == "consistent" and not items:
        risk = min(risk, 12)

    intent = (
        "Routine contact with no sensitive request so far." if not items and not tactics else
        f"Trying to obtain {', '.join(i.replace('_', ' ') for i in items)}." if items else
        f"Applying pressure ({', '.join(tactics)}) without a concrete ask yet — possible slow-burn setup."
    )
    return {
        "intent": intent, "deceptionSignals": deception, "identityConsistency": identity,
        "contractConsistency": contract, "risk": int(max(0, min(100, round(risk)))),
        "explanation": deception[0] if deception else ("Verified agent behaving within its contract so far." if verify_state == "verified" else "Unverified AI caller; nothing harmful requested yet."),
    }


def steward(ctx: dict[str, Any]) -> dict[str, Any]:
    reasons, verdict = [], "allow"
    rank = {"allow": 0, "ask": 1, "block": 2}

    def bump(v):
        nonlocal verdict
        if rank[v] > rank[verdict]:
            verdict = v

    source = (ctx.get("sourceText") or "") + " " + str(ctx.get("params", {}))
    injected = _hit(source, INJECTED_SOURCE_PATTERNS) or _hit(source, INJECTION_PATTERNS)
    impossible = _hit(ctx.get("userRequest", ""), IMPOSSIBLE_GOAL_PATTERNS)
    amount = ctx.get("amount")
    m = re.search(r"(?:under|below|max|less than)\s*\$?\s*(\d[\d,]*)", ctx.get("userRequest", ""), re.I)
    off_intent = False
    if m and amount is not None and float(amount) > float(m.group(1).replace(",", "")):
        off_intent = True
        reasons.append(f"You asked to stay under ${m.group(1)}, but this is ${amount}.")
        bump("block")
    if injected:
        reasons.append("This instruction came from an email or web page, not from you.")
        bump("block")
    if impossible:
        reasons.append('Your goal was open-ended ("whatever it takes"), so Halo is holding risky steps.')
        bump("ask")
    gate = {"buy": "send_money", "send_money": "send_money", "subscribe": "recurring",
            "share_info": "share_personal_data", "send_email": "email_new", "delete": "delete"}
    pref = gate.get(ctx.get("tool", ""))
    always = ctx.get("preferences", {}).get("alwaysAsk", [])
    if pref and pref in always:
        reasons.append(f"Your settings say always ask before {pref.replace('_', ' ')}.")
        bump("ask")
    if ctx.get("tool") == "share_info" and re.search(r"ssn|social security|date of birth|dob|passport|card number|address", str(ctx.get("params", {})), re.I):
        reasons.append("Sharing personal data with an unfamiliar destination.")
        bump("ask")
    if verdict == "allow":
        reasons.append("Matches your request and preferences.")
    return {"verdict": verdict, "reason": " ".join(reasons), "offIntent": off_intent, "injected": injected, "impossibleGoal": impossible}


def interrogator(ctx: dict[str, Any]) -> dict[str, Any]:
    r = sentinel_reason(ctx)
    qs = [
        "Which company do you represent, and what is your registered agent ID with Halo?",
        "I will not share any codes, passwords or personal details. What is the official callback number for your business?",
        "What is the reason for this contact, and can it wait until I call that number back?",
    ]
    if r["contractConsistency"] == "violation" or r["identityConsistency"] == "inconsistent":
        qs.append("Your request does not match what a verified agent is permitted to ask. Please explain.")
    verdict = "fraudulent" if ctx.get("verifyState") == "impersonation" or r["risk"] >= 80 else ("suspicious" if r["risk"] >= 55 else "verified")
    note = {
        "fraudulent": "This caller is not a verified agent and is using scam tactics. Do not continue.",
        "suspicious": "This caller could not satisfy verification. Call the business back on an official number.",
        "verified": "This caller answered consistently and stayed within bounds.",
    }[verdict]
    return {"questions": qs, "verdict": verdict, "note": note}


def local_embed(text: str, dims: int = 64) -> list[float]:
    v = [0.0] * dims
    for tok in re.findall(r"[a-z0-9]+", text.lower()):
        h = 2166136261
        for ch in tok:
            h ^= ord(ch)
            h = (h * 16777619) & 0xFFFFFFFF
        v[h % dims] += 1
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / norm for x in v]
