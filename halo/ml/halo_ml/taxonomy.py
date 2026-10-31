"""Label taxonomy shared by data prep, serving and evals.

Sentinel-Fast is three single-label AutoTrain text-classification heads (PLAN.md D1):
each line gets its dominant tactic, its dominant requested item, and an overall risk.
"""

TACTICS = ["none", "urgency", "authority", "fear", "secrecy", "isolation", "impersonation"]
ITEMS = [
    "none",
    "one_time_code",
    "pin",
    "password",
    "gift_card",
    "crypto",
    "wire_transfer",
    "remote_access",
    "personal_data",
]
RISK = ["low", "medium", "high"]

HEADS = {"tactic": TACTICS, "item": ITEMS, "risk": RISK}

# Items Halo never lets anyone obtain, regardless of model output (hard guardrail).
SECRET_ITEMS = {"one_time_code", "pin", "password"}
MONEY_ITEMS = {"gift_card", "crypto", "wire_transfer"}

# Hard evaluation categories reported separately by `make eval`.
HARD_CATEGORIES = ["slow_burn", "convincing_excuse", "prompt_injection_vs_halo", "fake_identity", "swarm"]

STEWARD_DECISIONS = ["allow", "ask", "block"]
STEWARD_ORIGINS = ["user", "third_party_content", "agent_initiative"]
GOAL_PRESSURE = ["normal", "high_pressure", "impossible"]

INTERROGATOR_VERDICTS = ["verified", "unverified", "likely_scam"]
