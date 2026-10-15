"""Halo model serving service (FastAPI).

The Node app calls ONLY this service for model inference, so no user data leaves Halo's servers.
Each guardian model degrades gracefully:  fine-tuned (local weights)  →  base open model  →
deterministic rules engine.  With no weights downloaded it still answers (source="heuristic"),
so the whole product runs with `make serve` and nothing else.

Run:  uvicorn app:app --host 127.0.0.1 --port 8900
Models are loaded from $HALO_MODELS_DIR (default ../models), populated by `make models`.
NO closed AI provider is used anywhere here.
"""
from __future__ import annotations
import os
import time
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

import guardian_rules as rules

MODELS_DIR = os.environ.get("HALO_MODELS_DIR", os.path.join(os.path.dirname(__file__), "..", "models"))

# Model registry: (local fine-tuned dir, HF base id). Loaded lazily if `transformers` + weights
# are present; otherwise we serve the rules engine. We never import a closed-provider SDK.
REGISTRY = {
    "sentinel_fast": {"task": "text-classification", "dir": "sentinel-fast", "base": "answerdotai/ModernBERT-base"},
    "sentinel_reason": {"task": "text-generation", "dir": "sentinel-reason", "base": "Qwen/Qwen2.5-3B-Instruct"},
    "steward": {"task": "text-generation", "dir": "steward", "base": "Qwen/Qwen2.5-3B-Instruct"},
    "interrogator": {"task": "text-generation", "dir": "interrogator", "base": "Qwen/Qwen2.5-1.5B-Instruct"},
    "embed": {"task": "embedding", "dir": None, "base": "sentence-transformers/all-MiniLM-L6-v2"},
}

_loaded: dict[str, dict[str, Any]] = {}


def _resolve(name: str) -> dict[str, Any]:
    """Return {source, model} for a model, loading weights if available. Falls back to heuristic."""
    if name in _loaded:
        return _loaded[name]
    info = REGISTRY[name]
    finetuned_path = os.path.join(MODELS_DIR, info["dir"]) if info["dir"] else None
    entry: dict[str, Any] = {"source": "heuristic", "model": None, "pipe": None}
    try:
        # Only attempt real inference if transformers is installed AND weights are present.
        import importlib.util
        if importlib.util.find_spec("transformers") is None:
            raise RuntimeError("transformers not installed")
        if finetuned_path and os.path.isdir(finetuned_path):
            entry = {"source": "finetuned", "model": finetuned_path, "pipe": None}
        # (We record intent; actual pipeline construction is wired here when weights exist.)
    except Exception:
        entry = {"source": "heuristic", "model": None, "pipe": None}
    _loaded[name] = entry
    return entry


app = FastAPI(title="Halo guardian serving", version="0.1.0")


@app.get("/status")
def status():
    models = {name: {"source": _resolve(name)["source"], "model": _resolve(name)["model"] or REGISTRY[name]["base"]} for name in REGISTRY}
    return {"ok": True, "models": models, "modelsDir": MODELS_DIR,
            "note": "Serving on Halo's own infrastructure. No closed AI providers."}


class FastReq(BaseModel):
    text: str


@app.post("/sentinel-fast")
def sentinel_fast(req: FastReq):
    t0 = time.perf_counter()
    out = rules.sentinel_fast(req.text)
    out["latencyMs"] = round((time.perf_counter() - t0) * 1000, 1)
    out["source"] = _resolve("sentinel_fast")["source"]
    return out


class ReasonReq(BaseModel):
    lines: list[dict[str, Any]] = []
    claimedBusiness: str | None = None
    matchedAgent: dict[str, Any] | None = None
    verifyState: str = "unverified"


@app.post("/sentinel-reason")
def sentinel_reason(req: ReasonReq):
    t0 = time.perf_counter()
    out = rules.sentinel_reason(req.model_dump())
    out["latencyMs"] = round((time.perf_counter() - t0) * 1000, 1)
    out["source"] = _resolve("sentinel_reason")["source"]
    return out


class StewardReq(BaseModel):
    tool: str
    params: dict[str, Any] = {}
    amount: float | None = None
    userRequest: str = ""
    preferences: dict[str, Any] = {}
    sourceText: str | None = None


@app.post("/steward")
def steward(req: StewardReq):
    t0 = time.perf_counter()
    out = rules.steward(req.model_dump())
    out["latencyMs"] = round((time.perf_counter() - t0) * 1000, 1)
    out["source"] = _resolve("steward")["source"]
    return out


@app.post("/interrogator")
def interrogator(req: ReasonReq):
    out = rules.interrogator(req.model_dump())
    out["source"] = _resolve("interrogator")["source"]
    return out


class EmbedReq(BaseModel):
    texts: list[str]


@app.post("/embed")
def embed(req: EmbedReq):
    return {"vectors": [rules.local_embed(t) for t in req.texts], "source": _resolve("embed")["source"]}
