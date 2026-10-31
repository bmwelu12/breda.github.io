"""Upload each processed dataset to a PRIVATE HF dataset repo under $HF_ORG, with a dataset card."""
import os
import sys
from pathlib import Path

from huggingface_hub import HfApi

ORG, TOKEN = os.environ.get("HF_ORG"), os.environ.get("HF_TOKEN")
if not ORG or not TOKEN:
    sys.exit("Set HF_ORG and HF_TOKEN.")
P = Path(__file__).resolve().parent / "processed"
CARDS = Path(__file__).resolve().parent / "cards"
api = HfApi(token=TOKEN)
for name in ["sentinel-fast-tactic", "sentinel-fast-item", "sentinel-fast-risk", "sentinel-reason", "steward", "interrogator"]:
    repo = f"{ORG}/halo-data-{name}"
    api.create_repo(repo, repo_type="dataset", private=True, exist_ok=True)
    card = (CARDS / "dataset_card.md").read_text().replace("{{name}}", name)
    (P / name / "README.md").write_text(card)
    api.upload_folder(folder_path=str(P / name), repo_id=repo, repo_type="dataset", allow_patterns=["*.csv", "README.md"])
    print("pushed (private)", repo)
