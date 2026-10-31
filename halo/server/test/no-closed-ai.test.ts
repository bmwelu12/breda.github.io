// Acceptance: no code path calls a closed AI API.
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { HttpModelClient, ALLOWED_MODEL_HOSTS } from "../src/core/models.ts";
import { makeHalo } from "./helpers.ts";
import { runScenario } from "../src/core/scenarios.ts";

const ROOT = join(__dirname, "..", "..");
const CLOSED = [
  "api.openai.com", "openai", "anthropic", "@anthropic-ai", "claude-", "generativelanguage.googleapis.com", "google-generativeai", "@google/generative-ai",
  "vertexai", "aiplatform.googleapis.com", "api.cohere", "cohere-ai", "api.mistral.ai", "@mistralai", "api.groq.com", "api.together", "bedrock-runtime",
  "azure.com/openai", "openai.azure.com", "api.perplexity", "x.ai/api", "api.deepseek.com", "replicate.com",
];
const SKIP = new Set(["node_modules", ".git", "dist", "dist-standalone", "models", "processed", "raw", "__pycache__", "results"]);
const SELF = ["no-closed-ai.test.ts", "test_no_closed_ai.py", "MODELS.md", "README.md", "PLAN.md", "DATASETS.md", "package-lock.json"];

function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    if (SKIP.has(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs|py|json|txt|yml|yaml|toml|cfg|html)$/.test(f) && !SELF.includes(f)) out.push(p);
  }
  return out;
}

describe("no closed AI providers", () => {
  it("no dependency on a closed AI SDK", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const d of deps) for (const c of CLOSED) expect(d.toLowerCase().includes(c), `${d} matches ${c}`).toBe(false);
    const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));
    const all = Object.keys(lock.packages ?? {}).map((k) => k.replace(/^.*node_modules\//, ""));
    for (const bad of ["openai", "@anthropic-ai/sdk", "@google/generative-ai", "cohere-ai", "@mistralai/mistralai"]) expect(all).not.toContain(bad);
  });

  it("no source file references a closed AI endpoint or SDK", () => {
    const hits: string[] = [];
    for (const f of walk(ROOT)) {
      const txt = readFileSync(f, "utf8").toLowerCase();
      for (const c of CLOSED) if (txt.includes(c)) hits.push(`${f.replace(ROOT, "")}: ${c}`);
    }
    expect(hits).toEqual([]);
  });

  it("the model client refuses any host that is not Halo's own", () => {
    expect(() => new HttpModelClient("https://api.openai.com")).toThrow();
    expect(() => new HttpModelClient("http://127.0.0.1:8100")).not.toThrow();
  });

  it("running every scenario makes no outbound network call", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (u: any) => { throw new Error("unexpected network call to " + String(u)); });
    const { halo } = makeHalo();
    for (const id of ["verified-bank", "fake-bank", "slow-burn", "swarm", "email-injection", "off-intent", "redteam"]) await runScenario(halo, id, { delayMs: 0 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(ALLOWED_MODEL_HOSTS.every((h) => !/openai|anthropic|google|cohere|mistral/.test(h))).toBe(true);
  });
});
