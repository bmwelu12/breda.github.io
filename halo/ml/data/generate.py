"""Generate synthetic examples with an open Hub model (never a closed API) into the review queue.

Default generator: Qwen/Qwen2.5-7B-Instruct (Apache-2.0), run locally with transformers.
The template examples in seed_templates.py are shown as seeds; the model writes new, more varied
versions with the SAME label, which the founder then approves, edits or rejects on the review page.
"""
import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import seed_templates as st  # noqa: E402

OUT = Path(__file__).resolve().parent / "review" / "pending.jsonl"
SYSTEM = ("You write training examples for a scam-protection system. Use only invented names, numbers and companies. "
          "Never write malware, exploit code or real-world hacking steps. Keep the same meaning and label as the seed, "
          "but change wording, length and style so it sounds natural.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="Qwen/Qwen2.5-7B-Instruct")
    ap.add_argument("--n", type=int, default=500)
    args = ap.parse_args()
    from transformers import pipeline

    gen = pipeline("text-generation", model=args.model, device_map="auto")
    seeds = st.sentinel_fast_lines(args.n * 3, seed=random.randint(0, 10**6))
    rnd = random.Random()
    written = 0
    with OUT.open("a") as f:
        for s in rnd.sample(seeds, args.n):
            msgs = [{"role": "system", "content": SYSTEM},
                    {"role": "user", "content": f"Seed line (label: tactic={s['tactic']}, item={s['item']}, risk={s['risk']}):\n{s['text']}\n\nWrite one new line with the same label. Reply with the line only."}]
            out = gen(msgs, max_new_tokens=80, do_sample=True, temperature=0.9)[0]["generated_text"][-1]["content"].strip()
            if out:
                f.write(json.dumps({"model": "sentinel_fast", "source": f"model:{args.model}", "example": {**s, "text": out, "seed": s["text"]}}) + "\n")
                written += 1
    print(f"Queued {written} generated lines for review in {OUT}")


if __name__ == "__main__":
    main()
