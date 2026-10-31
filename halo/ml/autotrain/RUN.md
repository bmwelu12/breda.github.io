# Running AutoTrain for Halo

**Do not start a paid run until the founder has approved PLAN.md and the budget (§6).**

Verified against `autotrain-advanced==0.8.36` (latest on PyPI, 2025-01-21).

## Setup
```bash
python3.11 -m venv .venv-autotrain && . .venv-autotrain/bin/activate
pip install autotrain-advanced==0.8.36
export HF_TOKEN=...            # write token for the founder's account
export HF_ORG=...              # founder's username or org; models are pushed to $HF_ORG/halo-*
export AUTOTRAIN_BACKEND=spaces-t4-small   # or local (own GPU), spaces-a10g-large, ...
make data                      # builds ml/data/processed/*
```

## Runs (one per model)
| Model | Config | Suggested hardware |
|---|---|---|
| Sentinel-Fast tactic / item / risk | `sentinel-fast-{tactic,item,risk}.yml` | `spaces-t4-small` |
| Sentinel-Reason | `sentinel-reason.yml` | `spaces-a10g-large` |
| Steward | `steward.yml` | `spaces-a10g-large` |
| Interrogator | `interrogator.yml` | `spaces-a10g-large` |

```bash
envsubst < ml/autotrain/sentinel-fast-risk.yml > /tmp/run.yml && autotrain --config /tmp/run.yml
```
The same settings work in the AutoTrain UI (Docker Space "AutoTrain"): choose the task, the base model, upload `train.csv` + `validation.csv`, and leave every parameter at its default.

## Rules
- **Defaults only.** The YAML files copy AutoTrain's UI defaults. Do not change them.
- **If a run fails** (out of memory, etc.): stop and report to the founder with the options. Don't change settings.
- After each run, AutoTrain writes `training_params.json` into the private model repo. `make models` downloads it and `python ml/autotrain/capture_settings.py` copies the exact values into `MODELS.md`.
