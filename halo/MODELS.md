# Models

All models are open-weight models from the Hugging Face Hub, run on Halo's own infrastructure. No closed AI provider is used anywhere (enforced by `server/test/no-closed-ai.test.ts` and `ml/tests/test_no_closed_ai.py`).

**Training status (2026-10-31): not trained yet.** Paid AutoTrain runs wait for founder approval of PLAN.md §6, and this build environment cannot reach `huggingface.co` (PLAN.md D6). Until then the model service runs a clearly labelled rule-based stand-in (`HALO_BACKEND=stub`).

**Licenses:** these are from my knowledge and must be re-checked on each model page before training. The Hub was unreachable from the build environment.

| Guardian | AutoTrain task | Base model | License | Source | Private repo (after training) |
|---|---|---|---|---|---|
| Sentinel-Fast (tactic head) | text classification | `answerdotai/ModernBERT-base` | Apache-2.0 | https://huggingface.co/answerdotai/ModernBERT-base | `$HF_ORG/halo-sentinel-fast-tactic` |
| Sentinel-Fast (item head) | text classification | `answerdotai/ModernBERT-base` | Apache-2.0 | same | `$HF_ORG/halo-sentinel-fast-item` |
| Sentinel-Fast (risk head) | text classification | `answerdotai/ModernBERT-base` | Apache-2.0 | same | `$HF_ORG/halo-sentinel-fast-risk` |
| Sentinel-Reason | LLM SFT | `Qwen/Qwen2.5-1.5B-Instruct` | Apache-2.0 | https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct | `$HF_ORG/halo-sentinel-reason` |
| Steward | LLM SFT | `Qwen/Qwen2.5-1.5B-Instruct` | Apache-2.0 | same | `$HF_ORG/halo-steward` |
| Interrogator | LLM SFT | `Qwen/Qwen2.5-1.5B-Instruct` | Apache-2.0 | same | `$HF_ORG/halo-interrogator` |
| Swarm Detector (not fine-tuned) | — | `sentence-transformers/all-MiniLM-L6-v2` | Apache-2.0 | https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2 | — |
| Red Team / data generator (not fine-tuned) | — | `Qwen/Qwen2.5-7B-Instruct` (data gen), base 1.5B (live demo) | Apache-2.0 | https://huggingface.co/Qwen/Qwen2.5-7B-Instruct | — |

## Substitutions and why
- **`Qwen/Qwen2.5-3B-Instruct` → `Qwen/Qwen2.5-1.5B-Instruct`.** The 3B model is, to my knowledge, under the Qwen Research License (non-commercial), which fails the commercial-use rule. 1.5B is Apache-2.0 and was the brief's named fallback. Founder chose this (PLAN.md D4).
- **Sentinel-Fast is three single-label heads instead of one multi-label model.** AutoTrain 0.8.36 has no multi-label text task (PLAN.md D1).
- **Newer bases (Qwen3, etc.) are not used.** AutoTrain 0.8.36 pins `transformers==4.48.0`, which can't load them.

## AutoTrain settings
Version: `autotrain-advanced==0.8.36`. Settings are AutoTrain's **UI defaults** (founder decision D2), copied into `ml/autotrain/*.yml` from `autotrain/app/params.py`:

- **Text classification:** lr 5e-5, epochs 3, max_seq_length 128, batch 8, warmup 0.1, grad accum 1, adamw_torch, linear schedule, weight decay 0, max grad norm 1.0, seed 42, fp16, early stopping patience 5 / threshold 0.01.
- **LLM SFT:** trainer `sft`, peft (LoRA) true, r 16, α 32, dropout 0.05, target_modules all-linear, quantization int4, lr 3e-5, epochs 3, batch 2, grad accum 4, block_size 1024, model_max_length 2048, warmup 0.1, adamw_torch, linear, fp16, padding right, chat_template none (text pre-rendered in the base model's ChatML format), merge_adapter false.

The exact values AutoTrain actually used are copied from each repo's `training_params.json` by `make models`:

<!-- autotrain-settings:start -->
_No trained models downloaded yet. Run the AutoTrain jobs, then `make models`._
<!-- autotrain-settings:end -->
