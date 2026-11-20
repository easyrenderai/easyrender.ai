// A spec that skips itself (a missing variable, a missing fixture) proves nothing and goes
// unnoticed. `bun run e2e` runs this after Playwright and fails if anything was skipped.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output =
  process.env.EVIDENCE_DIR || fileURLToPath(new URL('../../../.data/e2e', import.meta.url));
const { stats } = JSON.parse(await readFile(`${output}/playwright-results.json`, 'utf8'));
if (!stats.expected) {
  console.error('e2e: no test ran');
  process.exit(1);
}
if (stats.skipped) {
  console.error(`e2e: ${stats.skipped} test(s) were skipped. Fix the skip or delete the spec.`);
  process.exit(1);
}
console.log(`e2e: ${stats.expected} passed, none skipped`);
