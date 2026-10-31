from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BAD = ["api.openai.com", "import openai", "from openai", "import anthropic", "from anthropic", "api.anthropic.com",
       "google.generativeai", "generativelanguage.googleapis.com", "import cohere", "mistralai", "api.groq.com"]


def test_python_has_no_closed_ai_calls():
    for p in list(ROOT.rglob("*.py")) + list(ROOT.rglob("requirements*.txt")):
        if "models" in p.parts or p.name == "test_no_closed_ai.py":
            continue
        t = p.read_text().lower()
        for b in BAD:
            assert b not in t, f"{p}: {b}"
