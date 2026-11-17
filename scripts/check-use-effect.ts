// Ratchet for React effects. Counts useEffect calls and async effects without an abort per source
// file (tests excluded) and compares them with scripts/use-effect-baseline.json. A new file or a
// higher count fails; a lower count fails until the baseline is pruned. Effects only go down.
//
// bun run check:use-effects                  check against the baseline
// bun run check:use-effects --prune          lower the baseline to today's counts (never raises it)
// bun run check:use-effects --report         print today's counts per file
// bun run check:use-effects --against <ref>  also fail if the baseline grew compared with <ref>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  auditSource,
  type Baseline,
  compareToBaseline,
  type EffectCounts,
  findGrowth,
  toBaseline,
  type Violation,
} from './use-effect-audit';

const ROOT = new URL('..', import.meta.url).pathname;
const BASELINE_PATH = 'scripts/use-effect-baseline.json';
const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const SKIPPED =
  /(?:^|\/)(?:node_modules|\.next|\.expo|\.turbo|dist|build|coverage|generated|e2e|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/;

function git(...args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], { cwd: ROOT, stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim());
  return result.stdout.toString();
}

function sourceFiles(): string[] {
  return git('ls-files')
    .split('\n')
    .filter((file) => SOURCE.test(file) && !SKIPPED.test(file));
}

function readBaseline(text: string): Baseline {
  return JSON.parse(text) as Baseline;
}

const HINT = [
  '',
  'Do not add effects: derive the value in render, run the work in the event handler that caused it,',
  'or reset state with a key. An async effect needs an AbortController signal. For a subscription to',
  'a system outside React, put "// use-effect-audit: ignore <reason>" on the line above the call.',
  'After removing effects, lower the baseline with: bun run check:use-effects --prune',
].join('\n');

const args = process.argv.slice(2);
const isPrune = args.includes('--prune');
const isReport = args.includes('--report');
const againstIndex = args.indexOf('--against');
const againstRef = againstIndex === -1 ? undefined : args[againstIndex + 1];

const current: Record<string, EffectCounts> = {};
const problems: Violation[] = [];
for (const file of sourceFiles()) {
  const audit = auditSource(file, readFileSync(join(ROOT, file), 'utf8'));
  for (const line of audit.reasonlessIgnores) {
    problems.push({
      file: `${file}:${line}`,
      message: 'use-effect-audit: ignore needs a reason after "ignore".',
    });
  }
  if (audit.counts.use_effect > 0) current[file] = audit.counts;
}

if (isReport) {
  const rows = Object.entries(current).sort(([a], [b]) => a.localeCompare(b));
  for (const [file, counts] of rows) {
    console.log(`${counts.use_effect}\t${counts.async_effect_without_abort}\t${file}`);
  }
  const total = (key: keyof EffectCounts) => rows.reduce((sum, [, counts]) => sum + counts[key], 0);
  console.log(
    `total: ${total('use_effect')} effects, ${total('async_effect_without_abort')} async without abort, ${rows.length} files`,
  );
  process.exit(0);
}

const baseline = readBaseline(readFileSync(join(ROOT, BASELINE_PATH), 'utf8'));
const violations = [...problems, ...compareToBaseline(current, baseline)];

if (isPrune) {
  const raised = violations.filter((violation) => !violation.message.includes('left, baseline'));
  if (raised.length > 0) {
    console.error(raised.map((violation) => `${violation.file}: ${violation.message}`).join('\n'));
    console.error('Refusing to prune: counts went up. The baseline never grows.');
    process.exit(1);
  }
  writeFileSync(join(ROOT, BASELINE_PATH), `${JSON.stringify(toBaseline(current), null, 2)}\n`);
  console.log(
    `use-effect baseline pruned: ${Object.keys(toBaseline(current)).length} file(s) left`,
  );
  process.exit(0);
}

if (againstRef) {
  let base: Baseline | undefined;
  try {
    base = readBaseline(git('show', `${againstRef}:${BASELINE_PATH}`));
  } catch {
    // The ref has no baseline yet: this is the change that introduces it.
    console.log(`use-effect baseline: none on ${againstRef}, skipping the growth check`);
  }
  if (base) violations.push(...findGrowth(baseline, base));
}

if (violations.length > 0) {
  console.error(
    violations.map((violation) => `${violation.file}: ${violation.message}`).join('\n'),
  );
  console.error(HINT);
  process.exit(1);
}
console.log('use-effect ratchet: ok');
