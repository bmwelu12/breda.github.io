"""Copy the exact settings AutoTrain used (training_params.json in each downloaded model repo) into MODELS.md."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "ml" / "models"
DOC = ROOT / "MODELS.md"
START, END = "<!-- autotrain-settings:start -->", "<!-- autotrain-settings:end -->"
HIDE = {"token", "username", "data_path", "project_name"}

parts = []
for d in sorted(MODELS.glob("*")):
    p = d / "training_params.json"
    if p.exists():
        params = {k: v for k, v in json.loads(p.read_text()).items() if k not in HIDE}
        parts.append(f"### {d.name}\n```json\n{json.dumps(params, indent=2, sort_keys=True)}\n```")
body = "\n\n".join(parts) or "_No trained models downloaded yet. Run the AutoTrain jobs, then `make models`._"
text = DOC.read_text()
text = re.sub(re.escape(START) + ".*?" + re.escape(END), START + "\n" + body + "\n" + END, text, flags=re.S)
DOC.write_text(text)
print(f"Updated MODELS.md with {len(parts)} model(s).")
