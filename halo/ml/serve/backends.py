"""Model backends for the Halo model service.

- StubBackend: deterministic heuristics (ml/halo_ml/heuristics.py). Always labelled
  `backend: "stub"` in every response so it can never be mistaken for a trained model.
- HFBackend: loads the AutoTrain fine-tuned models from ./models (downloaded by
  `make models` from the founder's private Hugging Face repos) with `transformers`.
  Nothing is sent anywhere: inference is local.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

from halo_ml import heuristics, prompts
from halo_ml.taxonomy import HEADS

MODELS_DIR = Path(os.environ.get("HALO_MODELS_DIR", Path(__file__).resolve().parents[1] / "models"))
BASE_LLM = os.environ.get("HALO_BASE_LLM", "Qwen/Qwen2.5-1.5B-Instruct")


class StubBackend:
    name = "stub"

    def sentinel_fast(self, text: str, variant: str = "tuned") -> dict:
        return heuristics.classify_line(text)

    def sentinel_reason(self, conversation, claimed_identity, registry_record, contract, variant="tuned") -> dict:
        return heuristics.judge_conversation(conversation, claimed_identity, registry_record, contract)

    def steward(self, user_request, preferences, action, context, variant="tuned") -> dict:
        return heuristics.review_action(user_request, preferences, action, context)

    def interrogator(self, dialogue, claimed_identity, registry_check=None, variant="tuned") -> dict:
        return heuristics.interrogate(dialogue, claimed_identity, registry_check)

    def embed(self, texts):
        return heuristics.embed(texts)

    def red_team(self, n: int, seed=None):
        return heuristics.red_team_attacks(n, seed)

    def roleplay(self, persona, history, script):
        return heuristics.roleplay_next(persona, history, script)

    def info(self):
        return {"backend": "stub", "note": "Heuristic stand-in. Not a trained model. Run `make models` and set HALO_BACKEND=hf."}


class HFBackend:  # pragma: no cover - needs downloaded models
    name = "hf"

    def __init__(self):
        import torch
        from transformers import AutoModelForCausalLM, AutoModelForSequenceClassification, AutoTokenizer

        self.torch = torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        torch.set_num_threads(max(1, os.cpu_count() or 1))

        self.cls = {}
        for head in HEADS:
            path = MODELS_DIR / f"sentinel-fast-{head}"
            tok = AutoTokenizer.from_pretrained(path)
            mdl = AutoModelForSequenceClassification.from_pretrained(path).eval()
            self.cls[head] = (tok, mdl)

        base_path = MODELS_DIR / "base-llm" if (MODELS_DIR / "base-llm").exists() else BASE_LLM
        self.tok = AutoTokenizer.from_pretrained(base_path)
        dtype = torch.bfloat16 if self.device == "cuda" else torch.float32
        base = AutoModelForCausalLM.from_pretrained(base_path, torch_dtype=dtype).to(self.device).eval()
        from peft import PeftModel

        self.llm = PeftModel.from_pretrained(base, MODELS_DIR / "sentinel-reason", adapter_name="sentinel-reason")
        for name in ("steward", "interrogator"):
            self.llm.load_adapter(MODELS_DIR / name, adapter_name=name)
        self.llm.eval()

        from sentence_transformers import SentenceTransformer

        emb_path = MODELS_DIR / "all-MiniLM-L6-v2"
        self.embedder = SentenceTransformer(str(emb_path) if emb_path.exists() else "sentence-transformers/all-MiniLM-L6-v2", device=self.device)

    # --- classifier heads ---
    def sentinel_fast(self, text: str, variant: str = "tuned") -> dict:
        out = {"all_tactics": [], "all_items": [], "scores": {}}
        with self.torch.inference_mode():
            for head, (tok, mdl) in self.cls.items():
                enc = tok(text, truncation=True, max_length=128, return_tensors="pt")
                probs = self.torch.softmax(mdl(**enc).logits[0], dim=-1)
                idx = int(probs.argmax())
                label = mdl.config.id2label[idx]
                out[head] = label
                out["scores"][head] = float(probs[idx])
        out["all_tactics"] = [] if out["tactic"] == "none" else [out["tactic"]]
        out["all_items"] = [] if out["item"] == "none" else [out["item"]]
        out["injection"] = bool(heuristics.INJECTION_RE.search(text))  # rule signal, also enforced by guardrails
        return out

    # --- LLM heads ---
    def _generate(self, messages, adapter: str | None, max_new_tokens=256) -> dict:
        text = prompts.render_with_tokenizer(messages, self.tok, add_generation_prompt=True)
        enc = self.tok(text, return_tensors="pt").to(self.device)
        with self.torch.inference_mode():
            if adapter is None:
                with self.llm.disable_adapter():
                    ids = self.llm.generate(**enc, max_new_tokens=max_new_tokens, do_sample=False)
            else:
                self.llm.set_adapter(adapter)
                ids = self.llm.generate(**enc, max_new_tokens=max_new_tokens, do_sample=False)
        reply = self.tok.decode(ids[0][enc["input_ids"].shape[1]:], skip_special_tokens=True)
        parsed = prompts.parse_json_reply(reply)
        return parsed if parsed is not None else {"_unparsed": reply}

    def sentinel_reason(self, conversation, claimed_identity, registry_record, contract, variant="tuned"):
        msgs = prompts.sentinel_reason_messages(conversation, claimed_identity, registry_record, contract)
        return self._generate(msgs, None if variant == "base" else "sentinel-reason")

    def steward(self, user_request, preferences, action, context, variant="tuned"):
        msgs = prompts.steward_messages(user_request, preferences, action, context)
        return self._generate(msgs, None if variant == "base" else "steward", 160)

    def interrogator(self, dialogue, claimed_identity, registry_check=None, variant="tuned"):
        msgs = prompts.interrogator_messages(dialogue, claimed_identity, registry_check)
        return self._generate(msgs, None if variant == "base" else "interrogator", 160)

    def embed(self, texts):
        return self.embedder.encode(texts, normalize_embeddings=True).tolist()

    def _sample(self, messages, max_new_tokens=200, temperature=0.9):
        text = prompts.render_with_tokenizer(messages, self.tok, add_generation_prompt=True)
        enc = self.tok(text, return_tensors="pt").to(self.device)
        with self.torch.inference_mode(), self.llm.disable_adapter():
            ids = self.llm.generate(**enc, max_new_tokens=max_new_tokens, do_sample=True, temperature=temperature, top_p=0.95)
        return self.tok.decode(ids[0][enc["input_ids"].shape[1]:], skip_special_tokens=True).strip()

    def red_team(self, n: int, seed=None):
        """Defensive test generation only: scam dialogue lines and injected instructions
        aimed at Halo's own guardian models. Never exploit code or intrusion steps."""
        seeds = heuristics.red_team_attacks(n, seed)
        out = []
        for a in seeds:
            msgs = [{"role": "system", "content": RED_TEAM_SYSTEM},
                    {"role": "user", "content": f"Rewrite this test attack so it is harder to detect, same goal, one message, no explanations:\n{a['text']}"}]
            out.append({**a, "text": self._sample(msgs, 120) or a["text"], "source_seed": a["text"]})
        return out

    def roleplay(self, persona, history, script):
        idx = len([h for h in history if h.get("speaker") == "caller"])
        if idx >= len(script):
            return ""
        convo = "\n".join(f"{h['speaker']}: {h['text']}" for h in history)
        msgs = [{"role": "system", "content": ROLEPLAY_SYSTEM + json.dumps(persona)},
                {"role": "user", "content": f"Conversation so far:\n{convo}\n\nYour next line should convey: {script[idx]}\nReply with the line only."}]
        return self._sample(msgs, 80) or script[idx]

    def info(self):
        return {"backend": "hf", "device": self.device, "models_dir": str(MODELS_DIR), "base_llm": BASE_LLM}


RED_TEAM_SYSTEM = (
    "You write test messages for a scam-detection system, used only to test and train that system. "
    "Write realistic social-engineering phone lines, phishing texts, or instructions hidden in emails "
    "that target an AI assistant. Use invented names and numbers. Never write malware, exploit code, "
    "or real-world hacking steps."
)
ROLEPLAY_SYSTEM = (
    "You play a simulated caller in a scam-awareness training demo. Stay in character, keep lines short "
    "and natural, use only invented details. Persona: "
)


def make_backend():
    kind = os.environ.get("HALO_BACKEND", "auto")
    if kind == "stub":
        return StubBackend()
    if kind in ("hf", "auto"):
        try:
            return HFBackend()
        except Exception as exc:  # noqa: BLE001
            if kind == "hf":
                raise
            print(f"[halo-ml] trained models not available ({exc.__class__.__name__}: {exc}); using stub backend")
    return StubBackend()


def timed(fn, *a, **kw):
    t0 = time.perf_counter()
    res = fn(*a, **kw)
    return res, (time.perf_counter() - t0) * 1000
