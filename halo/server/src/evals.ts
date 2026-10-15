import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const RESULTS = process.env.HALO_EVAL_RESULTS ?? resolve(here, '../../ml/evals/results/latest.json');

/** Latest eval results written by `make eval` (ml/evals). Returns a placeholder until run. */
export function loadEvalResults() {
  if (existsSync(RESULTS)) {
    try {
      return { available: true, ...JSON.parse(readFileSync(RESULTS, 'utf8')) };
    } catch {
      /* fall through */
    }
  }
  return {
    available: false,
    note: 'No eval results yet. Run `make eval` (ml/evals) to compare each fine-tuned guardian model against its untuned base on the held-out test set.',
    models: [],
  };
}
