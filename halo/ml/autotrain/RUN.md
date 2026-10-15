# Running AutoTrain for Halo's guardian models

> **Verified 2026-10-15.** AutoTrain Advanced is installed with `pip install autotrain-advanced`
> (Python ≥ 3.10, plus `git-lfs` and a CUDA torch stack for GPU). Tasks used: **text-classification**
> (Sentinel-Fast) and **llm-sft** (Sentinel-Reason, Steward, Interrogator) — both currently
> supported. ⚠️ AutoTrain Advanced is now **unmaintained** (its README recommends TRL / Axolotl /
> `transformers.Trainer`); it still runs these two tasks with default settings. We use it per the
> project's hard requirement and record the exact defaults AutoTrain reports in `../../MODELS.md`.
> If a default run fails (e.g. OOM), **stop and raise it with the founder** — do not change the
> method or hyperparameters, and do not switch tools without asking.

## 0. Prerequisites

```bash
pip install autotrain-advanced
export HF_USERNAME=<your-hf-username>      # also used as HF_ORG for dataset upload
export HF_TOKEN=<your-hf-write-token>
python ../data/build_all.py                # build datasets into ../data/out/
python ../data/upload_hf.py                # (optional) push datasets to PRIVATE HF repos
```

## 1. Train each model with default settings

```bash
autotrain --config sentinel-fast.yaml
autotrain --config sentinel-reason.yaml
autotrain --config steward.yaml
autotrain --config interrogator.yaml
```

Each config pins only the task, the base model, the data mapping and the Hub target — **`params`
is empty on purpose** so AutoTrain's defaults choose the fine-tuning method and hyperparameters.

## 2. Record what AutoTrain used

After each run, AutoTrain writes the resolved training config (method, LoRA/quantization, LR,
epochs, batch size, etc.) into the project folder's `training_params.json` and logs. Copy those
exact values into `../../MODELS.md` — do not infer or edit them.

## 3. Pull the models for serving

Fine-tuned models push to **private** repos (`$HF_USERNAME/halo-<model>`). `make models` downloads
them into `../models/<model>` where `ml/serve` loads them. Until then, serving runs on base open
models and the deterministic rules engine, so the app works without any trained model.

## Alternatives for running AutoTrain
- **Local Web UI:** `autotrain app --port 8080 --host 127.0.0.1`
- **Hugging Face Spaces:** duplicate the AutoTrain Space ("Deploy on Spaces") and upload the config.
- **Hugging Face hardware:** select a GPU Space / training hardware in the UI.

## Compute (confirm from the first small run before any large paid run)
| Model | Base | Suggested HW | Est. time | Est. cost |
|---|---|---|---|---|
| Sentinel-Fast | ModernBERT-base (~150M) | 1× T4/A10 | 15–40 min | ≈ $1–3 |
| Sentinel-Reason | Qwen2.5-3B | 1× A10G/L4 | 1–3 h | ≈ $5–15 |
| Steward | Qwen2.5-3B | 1× A10G/L4 | 1–3 h | ≈ $5–15 |
| Interrogator | Qwen2.5-1.5B | 1× A10G/L4 | 0.5–1.5 h | ≈ $3–8 |

**No paid run starts without founder approval of `PLAN.md` and real `HF_TOKEN`/`HF_ORG`.**
