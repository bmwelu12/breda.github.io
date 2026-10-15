import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Acceptance: no code path may call a closed AI provider. This scans every workspace's
// dependencies and every source file's imports / network targets for closed-provider markers.

const ROOT = resolve(__dirname, '../../..'); // halo/

// Banned dependency package names (closed model providers / their SDKs).
const BANNED_DEPS = [
  'openai', '@openai/', 'anthropic', '@anthropic-ai/', '@google/generative-ai', '@google-ai/generativelanguage',
  'google-generativeai', 'cohere-ai', 'cohere', '@mistralai/', '@azure/openai', 'replicate',
];

// Banned network endpoints (closed inference APIs).
const BANNED_HOSTS = [
  'api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com',
  'api.cohere.ai', 'api.mistral.ai', 'openai.azure.com',
];

// Banned import specifiers in source.
const BANNED_IMPORTS = [/\bfrom\s+['"]openai['"]/, /\brequire\(\s*['"]openai['"]/, /\bfrom\s+['"]@anthropic-ai\//, /\bimport\s+anthropic\b/, /\bimport\s+openai\b/, /\bfrom\s+['"]cohere-ai['"]/, /\bgoogle\.generativeai\b/];

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git', '__pycache__', '.venv', 'models'].includes(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, acc);
    else if (exts.some((e) => name.endsWith(e))) acc.push(p);
  }
  return acc;
}

describe('no closed AI provider anywhere', () => {
  it('no workspace declares a closed-provider dependency', () => {
    const pkgs = walk(ROOT, ['package.json']).filter((p) => !p.includes('node_modules'));
    const offenders: string[] = [];
    for (const p of pkgs) {
      const json = JSON.parse(readFileSync(p, 'utf8'));
      const deps = { ...json.dependencies, ...json.devDependencies, ...json.peerDependencies };
      for (const name of Object.keys(deps)) {
        if (BANNED_DEPS.some((b) => (b.endsWith('/') ? name.startsWith(b) : name === b))) offenders.push(`${p}: ${name}`);
      }
    }
    expect(offenders, `closed-provider dependencies found:\n${offenders.join('\n')}`).toHaveLength(0);
  });

  it('no source file imports a closed-provider SDK or calls a closed inference endpoint', () => {
    // Exclude the scanner files themselves: they name banned providers on purpose (to check for them).
    const SCANNERS = ['no-closed-ai.test.ts', 'test_guardians.py'];
    const files = [...walk(ROOT, ['.ts', '.tsx', '.py', '.js', '.mjs'])].filter(
      (p) => !p.includes('node_modules') && !SCANNERS.some((s) => p.endsWith(s)),
    );
    const offenders: string[] = [];
    for (const p of files) {
      const src = readFileSync(p, 'utf8');
      for (const re of BANNED_IMPORTS) if (re.test(src)) offenders.push(`${p}: import ${re}`);
      for (const host of BANNED_HOSTS) if (src.includes(host)) offenders.push(`${p}: endpoint ${host}`);
    }
    expect(offenders, `closed-provider usage found:\n${offenders.join('\n')}`).toHaveLength(0);
  });

  it('the Python requirements use only open tooling', () => {
    const reqs = walk(ROOT, ['.txt']).filter((p) => p.includes('ml') && p.endsWith('requirements.txt'));
    const offenders: string[] = [];
    for (const p of reqs) {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const name = line.split(/[=<>~\s#]/)[0].trim().toLowerCase();
        if (BANNED_DEPS.some((b) => name === b.replace(/[@/]/g, '') || name === b)) offenders.push(`${p}: ${name}`);
      }
    }
    expect(offenders, `closed-provider python deps:\n${offenders.join('\n')}`).toHaveLength(0);
  });
});
