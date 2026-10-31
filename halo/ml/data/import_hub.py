"""Import existing Hub datasets into the review queue, after a license check.

Only datasets on the allowlist below are imported, and only if the Hub metadata still reports a
commercial-use license. Every imported row goes to the human review page before it can be trained on.
"""
import json
import sys
from pathlib import Path

COMMERCIAL_OK = {"apache-2.0", "mit", "cc-by-4.0", "cc0-1.0", "bsd-3-clause", "odc-by"}
CANDIDATES = {
    # repo: (expected license, mapper)
    "deepset/prompt-injections": ("apache-2.0", "injection"),
}
OUT = Path(__file__).resolve().parent / "review" / "pending.jsonl"


def main():
    from datasets import load_dataset
    from huggingface_hub import HfApi

    api = HfApi()
    rows = []
    for repo, (expected, kind) in CANDIDATES.items():
        info = api.dataset_info(repo)
        lic = next((t.split(":", 1)[1] for t in info.tags if t.startswith("license:")), None)
        if lic not in COMMERCIAL_OK:
            print(f"SKIP {repo}: license {lic!r} not on the commercial allowlist")
            continue
        if lic != expected:
            print(f"NOTE {repo}: license changed from {expected} to {lic}; update DATASETS.md")
        ds = load_dataset(repo)
        for split in ds:
            for r in ds[split]:
                if kind == "injection":
                    # label 1 = injection. These are generic injections; review decides if they fit a phone/email context.
                    rows.append({"model": "sentinel_fast", "source": f"hub:{repo}", "example": {
                        "text": r["text"], "tactic": "none", "item": "none",
                        "risk": "high" if r["label"] == 1 else "low",
                        "category": "prompt_injection_vs_halo" if r["label"] == 1 else "legit", "hub_split": split}})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("a") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    print(f"Queued {len(rows)} rows for review in {OUT}")


if __name__ == "__main__":
    sys.exit(main())
