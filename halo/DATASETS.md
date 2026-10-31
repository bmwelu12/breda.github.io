# Datasets

No real personal data is used. Every name, number, address, account and company is invented.

| Dataset | Use | License | Source | Status |
|---|---|---|---|---|
| Halo template set (`ml/data/seed_templates.py`) | All four guardians; labels set by construction | Halo proprietary | this repo | built (`make data`) |
| Open-model synthetic set (`ml/data/generate.py`) | Variation on every scenario type; goes through review | Halo proprietary; generator `Qwen/Qwen2.5-7B-Instruct` is Apache-2.0 | generated locally | needs Hub access + GPU |
| `deepset/prompt-injections` | Injection examples for Sentinel-Fast | Apache-2.0 (to re-verify on the Hub) | https://huggingface.co/datasets/deepset/prompt-injections | importer ready (`ml/data/import_hub.py`); Hub blocked here |
| Red Team misses | New hard examples | Halo proprietary | demo panel → Data review | live |

Other Hub datasets on scam calls, phishing and social engineering still need a search and license check once the Hub is reachable. `import_hub.py` only imports from an allowlist of commercial licenses.

## Coverage
Inbound: legitimate verified and unverified callers, fake bank OTP, slow-burn gift card, convincing excuse, contract break, family voice clone, fake identity pressure, injection against Halo, tech-support remote access, swarm members, hesitant agents, coordinated drop-site campaigns. Outbound: on-intent purchases, over budget, unrequested subscriptions, email and web injection, data sharing, "no matter what" goals, agent initiative, spoofed tool logs, rationalized secret sharing, reward hacking.

The last few types in each list are modeled on behaviors publicly reported in the July 2026 OpenAI agents / Hugging Face incident: coordination on a shared board, falsified tool-call logs, reward hacking, and crossing boundaries without asking a human.

## Current sizes (`make data`)
| Model | Train | Validation | Test (frozen) | Brief target |
|---|---|---|---|---|
| Sentinel-Fast lines | 8,304 | 1,113 | 1,642 | ≥ 5,000 |
| Sentinel-Reason (conversations → per-turn rows) | 3,492 rows | 437 rows | 221 conversations | ≥ 1,500 (1,367 unique so far: **short by ~130**, to be filled with reviewed generated data) |
| Steward actions | 1,221 | 154 | 225 | ≥ 1,500 (1,600 total) |
| Interrogator dialogues | 1,347 rows | 183 rows | 90 dialogues | ≥ 500 (600 total) |

**Caveat:** template data has limited variety, and the rule-based stand-in shares its vocabulary, so stand-in scores on this test set are inflated. Treat them as pipeline checks. The real benchmark needs reviewed open-model and Hub data in the test set.

## Splits and review
- Splits are assigned by hash of a group id, so a conversation stays in one split with all its prefixes. The test set is frozen in `processed/test_manifest.json` and `build.py` won't put those rows in training.
- Generated and imported rows go to `ml/data/review/pending.jsonl` → the Data review page → `reviewed/approved.jsonl`. Only approved rows are trained on.
- `make push-data` uploads each set to a **private** dataset repo `$HF_ORG/halo-data-<name>` with a dataset card.
