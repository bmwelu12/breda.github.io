"""Halo model service. Local only: binds to 127.0.0.1 by default; the Node server is its only client.

Run:  cd ml && python -m uvicorn serve.app:app --port 8100
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Literal

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from serve.backends import make_backend, timed  # noqa: E402

app = FastAPI(title="Halo model service", version="0.1.0")
backend = make_backend()

Variant = Literal["tuned", "base"]


class LineIn(BaseModel):
    text: str
    variant: Variant = "tuned"


class Turn(BaseModel):
    speaker: str
    text: str


class ReasonIn(BaseModel):
    conversation: list[Turn]
    claimed_identity: dict[str, Any] | None = None
    registry_record: dict[str, Any] | None = None
    contract: dict[str, Any] | None = None
    variant: Variant = "tuned"


class StewardIn(BaseModel):
    user_request: str
    preferences: dict[str, Any] = Field(default_factory=dict)
    action: dict[str, Any]
    context: list[dict[str, Any]] = Field(default_factory=list)
    variant: Variant = "tuned"


class InterrogateIn(BaseModel):
    dialogue: list[Turn]
    claimed_identity: dict[str, Any] | None = None
    registry_check: dict[str, Any] | None = None
    variant: Variant = "tuned"


class EmbedIn(BaseModel):
    texts: list[str]


class RedTeamIn(BaseModel):
    n: int = Field(10, ge=1, le=50)
    seed: int | None = None


class RoleplayIn(BaseModel):
    persona: dict[str, Any]
    history: list[Turn] = Field(default_factory=list)
    script: list[str]


def wrap(result, ms):
    return {"backend": backend.name, "latency_ms": round(ms, 2), "result": result}


@app.get("/health")
def health():
    return {"ok": True, **backend.info()}


@app.post("/v1/sentinel-fast")
def sentinel_fast(body: LineIn):
    return wrap(*timed(backend.sentinel_fast, body.text, body.variant))


@app.post("/v1/sentinel-reason")
def sentinel_reason(body: ReasonIn):
    convo = [t.model_dump() for t in body.conversation]
    return wrap(*timed(backend.sentinel_reason, convo, body.claimed_identity, body.registry_record, body.contract, body.variant))


@app.post("/v1/steward")
def steward(body: StewardIn):
    return wrap(*timed(backend.steward, body.user_request, body.preferences, body.action, body.context, body.variant))


@app.post("/v1/interrogator")
def interrogator(body: InterrogateIn):
    return wrap(*timed(backend.interrogator, [t.model_dump() for t in body.dialogue], body.claimed_identity, body.registry_check, body.variant))


@app.post("/v1/embed")
def embed(body: EmbedIn):
    return wrap(*timed(backend.embed, body.texts))


@app.post("/v1/redteam/generate")
def red_team(body: RedTeamIn):
    return wrap(*timed(backend.red_team, body.n, body.seed))


@app.post("/v1/roleplay")
def roleplay(body: RoleplayIn):
    return wrap(*timed(backend.roleplay, body.persona, [t.model_dump() for t in body.history], body.script))
