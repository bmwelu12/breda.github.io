"""Build train / validation / test sets and export them in AutoTrain's local-data format.

Sources, in order:
  1. ml/data/reviewed/approved.jsonl - human-approved examples from the review page
     (open-model generated, Hub-imported, and red-team misses)
  2. template bootstrap examples (seed_templates.py)

Splits are assigned by a hash of a group id (a conversation stays in one split
with all its prefixes), so they are stable across rebuilds. The test split is
frozen: its row hashes are written to processed/test_manifest.json, and
build.py refuses to put any of those hashes into train/validation.

Output (AutoTrain local format, train.csv + validation.csv per project):
  processed/sentinel-fast-{tactic,item,risk}/{train,validation}.csv  columns: text,target
  processed/{sentinel-reason,steward,interrogator}/{train,validation}.csv  column: text
  processed/<name>/test.jsonl   held-out test set (raw fields + label), never used for training
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from halo_ml import prompts  # noqa: E402
from halo_ml.taxonomy import HEADS  # noqa: E402
import seed_templates as st  # noqa: E402

DATA = Path(__file__).resolve().parent
OUT = DATA / "processed"
APPROVED = DATA / "reviewed" / "approved.jsonl"

TARGETS = {"sentinel_fast": 30000, "sentinel_reason": 1600, "steward": 1600, "interrogator": 600}


def split_of(group_id: str) -> str:
    h = int(hashlib.sha256(group_id.encode()).hexdigest()[:8], 16) % 100
    return "test" if h < 15 else "validation" if h < 25 else "train"


def row_hash(text: str) -> str:
    return hashlib.sha256(text.strip().lower().encode()).hexdigest()


def load_approved() -> dict[str, list[dict]]:
    by_model: dict[str, list[dict]] = {k: [] for k in TARGETS}
    if APPROVED.exists():
        for line in APPROVED.read_text().splitlines():
            if line.strip():
                ex = json.loads(line)
                by_model.setdefault(ex["model"], []).append(ex["example"])
    return by_model


def write_csv(path: Path, rows: list[dict], cols: list[str]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, quoting=csv.QUOTE_ALL)
        w.writeheader()
        for r in rows:
            w.writerow({c: r[c] for c in cols})


def write_jsonl(path: Path, rows: list[dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def dedupe(rows, key):
    seen, out = set(), []
    for r in rows:
        k = row_hash(key(r))
        if k not in seen:
            seen.add(k)
            out.append(r)
    return out


def build(scale: float = 1.0, tokenizer=None) -> dict:
    approved = load_approved()
    stats = {}
    manifest_path = OUT / "test_manifest.json"
    frozen = set(json.loads(manifest_path.read_text())["hashes"]) if manifest_path.exists() else set()
    test_hashes: set[str] = set(frozen)

    # ---- Sentinel-Fast ----
    lines = approved["sentinel_fast"] + st.sentinel_fast_lines(int(TARGETS["sentinel_fast"] * scale))
    lines = dedupe(lines, lambda r: r["text"])
    splits = {"train": [], "validation": [], "test": []}
    for r in lines:
        h = row_hash(r["text"])
        s = "test" if h in frozen else split_of(h)
        if s != "test" and h in frozen:
            continue
        splits[s].append(r)
        if s == "test":
            test_hashes.add(h)
    for head in HEADS:
        for s in ("train", "validation"):
            write_csv(OUT / f"sentinel-fast-{head}" / f"{s}.csv", [{"text": r["text"], "target": r[head]} for r in splits[s]], ["text", "target"])
    write_jsonl(OUT / "sentinel-fast" / "test.jsonl", splits["test"])
    stats["sentinel_fast"] = {k: len(v) for k, v in splits.items()}

    # ---- Sentinel-Reason (conversation prefixes) ----
    convs = approved["sentinel_reason"] + st.reason_conversations(int(TARGETS["sentinel_reason"] * scale))
    convs = dedupe(convs, lambda c: json.dumps(c["conversation"]))
    rows = {"train": [], "validation": [], "test": []}
    for c in convs:
        s = split_of(c["id"] + json.dumps(c["conversation"]))
        if s == "test":
            rows["test"].append(c)
            test_hashes.add(row_hash(json.dumps(c["conversation"])))
            continue
        for k in range(1, len(c["conversation"]) + 1):
            if c["conversation"][k - 1]["speaker"] == "user":
                continue
            label = st.reason_prefix_label(c, k) if c.get("kind") else c["label"]
            msgs = prompts.sentinel_reason_messages(c["conversation"][:k], c["claimed_identity"], c["registry_record"], c["contract"])
            text = prompts.training_text(msgs, label, tokenizer)
            if row_hash(text) in frozen:
                continue
            rows[s].append({"text": text})
    for s in ("train", "validation"):
        write_csv(OUT / "sentinel-reason" / f"{s}.csv", rows[s], ["text"])
    write_jsonl(OUT / "sentinel-reason" / "test.jsonl", rows["test"])
    stats["sentinel_reason"] = {"conversations": len(convs), **{k: len(v) for k, v in rows.items()}}

    # ---- Steward ----
    acts = approved["steward"] + st.steward_actions(int(TARGETS["steward"] * scale))
    acts = dedupe(acts, lambda a: a["user_request"] + json.dumps(a["action"], sort_keys=True) + json.dumps(a["context"]) + a["id"])
    rows = {"train": [], "validation": [], "test": []}
    for a in acts:
        s = split_of(a["id"] + a["user_request"])
        if s == "test":
            rows["test"].append(a)
            continue
        msgs = prompts.steward_messages(a["user_request"], a["preferences"], a["action"], a["context"])
        rows[s].append({"text": prompts.training_text(msgs, a["label"], tokenizer)})
    for s in ("train", "validation"):
        write_csv(OUT / "steward" / f"{s}.csv", rows[s], ["text"])
    write_jsonl(OUT / "steward" / "test.jsonl", rows["test"])
    stats["steward"] = {k: len(v) for k, v in rows.items()}

    # ---- Interrogator (one row per Halo turn) ----
    dlgs = approved["interrogator"] + st.interrogator_dialogues(int(TARGETS["interrogator"] * scale))
    rows = {"train": [], "validation": [], "test": []}
    for d in dlgs:
        s = split_of(d["id"] + json.dumps(d["dialogue"]))
        if s == "test":
            rows["test"].append(d)
            continue
        dlg = d["dialogue"]
        halo_idx = [i for i, t in enumerate(dlg) if t["speaker"] == "halo"]
        for i in halo_idx:
            msgs = prompts.interrogator_messages(dlg[:i], d["claimed_identity"], d.get("registry_check"))
            rows[s].append({"text": prompts.training_text(msgs, {"say": dlg[i]["text"], "verdict": None, "reason": None}, tokenizer)})
        msgs = prompts.interrogator_messages(dlg, d["claimed_identity"], d.get("registry_check"))
        rows[s].append({"text": prompts.training_text(msgs, d["label"], tokenizer)})
    for s in ("train", "validation"):
        write_csv(OUT / "interrogator" / f"{s}.csv", rows[s], ["text"])
    write_jsonl(OUT / "interrogator" / "test.jsonl", rows["test"])
    stats["interrogator"] = {"dialogues": len(dlgs), **{k: len(v) for k, v in rows.items()}}

    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps({"note": "Frozen test set. Never train on these.", "hashes": sorted(test_hashes)}, indent=0))
    (OUT / "stats.json").write_text(json.dumps(stats, indent=2))
    return stats


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", type=float, default=1.0, help="Multiply template target sizes (tests use a small scale)")
    ap.add_argument("--tokenizer", default=None, help="Render chat with this HF tokenizer (default: ChatML fallback, identical to Qwen2.5's template)")
    args = ap.parse_args()
    tok = None
    if args.tokenizer:
        from transformers import AutoTokenizer

        tok = AutoTokenizer.from_pretrained(args.tokenizer)
    print(json.dumps(build(args.scale, tok), indent=2))
