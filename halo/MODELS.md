# Halo — models

All models are **open-weight** models from the Hugging Face Hub, fine-tuned with **Hugging Face
AutoTrain** using its **default settings**, and run on Halo's own infrastructure. No closed AI
provider is used anywhere (product, training, data generation, or serving).

> **AutoTrain status (verified 2026-10-15).** `autotrain-advanced`, Python ≥ 3.10. Tasks used:
> text-classification and `llm-sft` — both currently supported. AutoTrain Advanced is now
> **officially unmaintained** (its README recommends TRL / Axolotl / `transformers.Trainer`); it
> still runs these two tasks with default settings, and we use it per the project's hard
> requirement. TRL is the documented fallback **only if** an AutoTrain default run fails — and only
> after raising it with the founder. We never choose or change the method or hyperparameters.

## Guardian models

| Model | Role | AutoTrain task | Base model | License (base) | Commercial use |
|---|---|---|---|---|---|
| **Sentinel-Fast** | per-line risk / tactic / item classifier (< 200 ms CPU) | `text_classification` | [`answerdotai/ModernBERT-base`](https://huggingface.co/answerdotai/ModernBERT-base) | Apache-2.0 | ✅ |
| **Sentinel-Reason** | conversation judge → structured JSON | `llm-sft` | [`Qwen/Qwen2.5-3B-Instruct`](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct) | Apache-2.0 | ✅ |
| **Steward** | outbound action reviewer → allow/ask/block | `llm-sft` | `Qwen/Qwen2.5-3B-Instruct` | Apache-2.0 | ✅ |
| **Interrogator** | safe, firm challenge dialogue | `llm-sft` | [`Qwen/Qwen2.5-1.5B-Instruct`](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct) | Apache-2.0 | ✅ |
| **Swarm Detector** | campaign clustering (not fine-tuned) | — (embeddings) | [`sentence-transformers/all-MiniLM-L6-v2`](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) | Apache-2.0 | ✅ |
| **Red Team** | adversarial generation (defensive testing only) | — (open instruct model) | an open Hub instruct model (e.g. Qwen2.5-1.5B-Instruct) | Apache-2.0 | ✅ |

Suggested fallback if the 3B base won't fit the default run: `Qwen/Qwen2.5-1.5B-Instruct` (Apache-2.0).
Base choices are justified by: permissive commercial licence, AutoTrain support for the task, and
size appropriate to the latency target (ModernBERT for < 200 ms CPU classification; small Qwen
instruct models for structured-JSON generation).

## Fine-tuning settings actually used by AutoTrain

> Filled in **after** each run from the project's `training_params.json` / logs — not inferred.
> We record exactly what AutoTrain's defaults chose (method, LoRA/quantization, learning rate,
> epochs, batch size, max length, scheduler, etc.).

| Model | AutoTrain version | Method | Key default settings | Train time | Hardware |
|---|---|---|---|---|---|
| Sentinel-Fast | _pending run_ | _(AutoTrain default)_ | _(record verbatim)_ | — | — |
| Sentinel-Reason | _pending run_ | _(AutoTrain default)_ | _(record verbatim)_ | — | — |
| Steward | _pending run_ | _(AutoTrain default)_ | _(record verbatim)_ | — | — |
| Interrogator | _pending run_ | _(AutoTrain default)_ | _(record verbatim)_ | — | — |

Runs are gated on founder approval of `PLAN.md` and real `HF_TOKEN` / `HF_ORG`; see
`ml/autotrain/RUN.md`.

## Storage & privacy

Fine-tuned models are pushed to **private** Hugging Face repos under `$HF_ORG`
(`$HF_ORG/halo-<model>`), each with a model card. `make models` downloads them into `ml/models/`
where the local FastAPI serving service (`ml/serve`) loads them. At runtime the Node app calls only
that local service, so **no user data leaves Halo's servers**.

## Serving fallback (how the app runs before/without training)

The serving service degrades gracefully per model: **fine-tuned → base open model → deterministic
rules engine**. With no weights downloaded it answers from the rules engine (tagged
`source: "heuristic"` everywhere in the UI), so `npm install && npm run dev` works end-to-end with
no GPU, no key, and no closed AI. The rules engine encodes the 2026-incident lessons and is also
the weak-labeler the fine-tunes distil, so the fine-tuned models inherit its policy and improve on
its generalization.

## Hardware requirements

- **App + serving fallback:** any CPU; Node 20+, Python 3.11. Sentinel-Fast rules path < 1 ms/line.
- **Base open models (optional):** CPU works for ModernBERT and 1.5B (slow); a small GPU recommended for the 3B models.
- **Fine-tuning:** a single modest GPU per model (T4/A10/L4) — see `ml/autotrain/RUN.md`.
