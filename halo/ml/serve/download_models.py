"""Download Halo's fine-tuned models from PRIVATE HF repos into ml/models/<model>.
No-op with a message if HF_TOKEN/HF_ORG are unset. Uses huggingface_hub only (open tooling)."""
import os, sys
from pathlib import Path
MODELS = ["sentinel-fast", "sentinel-reason", "steward", "interrogator"]
def main():
    token, org = os.environ.get("HF_TOKEN"), os.environ.get("HF_ORG")
    if not token or not org:
        print("HF_TOKEN / HF_ORG not set — skipping. The app runs on base models + the rules engine."); return
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("pip install -r ml/serve/requirements.txt (with transformers extras) first."); return
    dest = Path(__file__).parent.parent / "models"
    for m in MODELS:
        repo = f"{org}/halo-{m}"
        try:
            snapshot_download(repo_id=repo, local_dir=str(dest / m), token=token)
            print(f"  downloaded {repo} -> ml/models/{m}")
        except Exception as e:
            print(f"  skip {repo}: {e}")
if __name__ == "__main__":
    main()
