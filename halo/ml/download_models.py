"""`make models`: download Halo's fine-tuned models from the founder's private HF repos, plus the
open base/embedding models they need, into ml/models. Inference afterwards is fully local."""
import os
import sys
from pathlib import Path

from huggingface_hub import snapshot_download

ORG, TOKEN = os.environ.get("HF_ORG"), os.environ.get("HF_TOKEN")
if not ORG or not TOKEN:
    sys.exit("Set HF_ORG and HF_TOKEN (read access to the private Halo repos).")
OUT = Path(__file__).resolve().parent / "models"
FINE_TUNED = ["sentinel-fast-tactic", "sentinel-fast-item", "sentinel-fast-risk", "sentinel-reason", "steward", "interrogator"]
OPEN = {"base-llm": "Qwen/Qwen2.5-1.5B-Instruct", "all-MiniLM-L6-v2": "sentence-transformers/all-MiniLM-L6-v2"}

for name in FINE_TUNED:
    print(f"- {ORG}/halo-{name}")
    snapshot_download(f"{ORG}/halo-{name}", local_dir=OUT / name, token=TOKEN)
for name, repo in OPEN.items():
    print(f"- {repo}")
    snapshot_download(repo, local_dir=OUT / name)
print(f"Models in {OUT}. Start the model service with HALO_BACKEND=hf.")
