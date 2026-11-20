// Shared by the knip and env checks: a baseline lists, per file, the names that are allowed to
// fail today. A name that is not in the baseline fails the check; a baseline name that no longer
// fails also fails until the baseline is pruned, and the baseline may never grow. Same idea as the
// useEffect ratchet (check-use-effect.ts), for lists of names instead of counts.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type NameMap = Record<string, string[]>;
export type NameViolation = { file: string; message: string };

const ROOT = new URL('..', import.meta.url).pathname;

export function normalize(map: NameMap): NameMap {
  const out: NameMap = {};
  for (const file of Object.keys(map).sort()) {
    const names = [...new Set(map[file])].sort();
    if (names.length > 0) out[file] = names;
  }
  return out;
}

export function compareNames(
  current: NameMap,
  baseline: NameMap,
  pruneCommand: string,
): NameViolation[] {
  const violations: NameViolation[] = [];
  const files = [...new Set([...Object.keys(current), ...Object.keys(baseline)])].sort();
  for (const file of files) {
    const allowed = new Set(baseline[file] ?? []);
    const found = new Set(current[file] ?? []);
    for (const name of [...found].sort()) {
      if (!allowed.has(name))
        violations.push({ file, message: `${name}: new, not in the baseline.` });
    }
    for (const name of [...allowed].sort()) {
      if (!found.has(name)) {
        violations.push({
          file,
          message: `${name}: fixed, still in the baseline. Lower it: ${pruneCommand}`,
        });
      }
    }
  }
  return violations;
}

// A baseline may shrink but never grow: any file or name the base ref did not have fails.
export function findNameGrowth(baseline: NameMap, base: NameMap): NameViolation[] {
  const violations: NameViolation[] = [];
  for (const file of Object.keys(baseline).sort()) {
    const before = new Set(base[file] ?? []);
    for (const name of baseline[file] ?? []) {
      if (!before.has(name)) {
        violations.push({
          file,
          message: `${name}: added to the baseline. The baseline may only shrink.`,
        });
      }
    }
  }
  return violations;
}

function git(...args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], { cwd: ROOT, stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim());
  return result.stdout.toString();
}

/**
 * The command line of a check built on a baseline:
 *   <check>                check against the baseline
 *   <check> --prune        lower the baseline to today's list (never raises it)
 *   <check> --against <ref>  also fail if the baseline grew compared with <ref>
 */
export function runNameRatchet(options: {
  label: string;
  command: string;
  baselinePath: string;
  hint: string;
  current: NameMap;
}) {
  const { label, command, baselinePath, hint } = options;
  const args = process.argv.slice(2);
  const againstIndex = args.indexOf('--against');
  const againstRef = againstIndex === -1 ? undefined : args[againstIndex + 1];
  const current = normalize(options.current);
  const baseline = normalize(JSON.parse(readFileSync(join(ROOT, baselinePath), 'utf8')) as NameMap);
  const violations = compareNames(current, baseline, `${command} --prune`);

  if (args.includes('--prune')) {
    const raised = violations.filter((violation) => violation.message.includes('new, not in'));
    if (raised.length > 0) {
      console.error(
        raised.map((violation) => `${violation.file}: ${violation.message}`).join('\n'),
      );
      console.error(`Refusing to prune: something new fails. The ${label} baseline never grows.`);
      process.exit(1);
    }
    writeFileSync(join(ROOT, baselinePath), `${JSON.stringify(current, null, 2)}\n`);
    const left = Object.values(current).reduce((sum, names) => sum + names.length, 0);
    console.log(`${label} baseline pruned: ${left} name(s) left`);
    process.exit(0);
  }

  if (againstRef) {
    let base: NameMap | undefined;
    try {
      base = normalize(JSON.parse(git('show', `${againstRef}:${baselinePath}`)) as NameMap);
    } catch {
      // The ref has no baseline yet: this is the change that introduces it.
      console.log(`${label} baseline: none on ${againstRef}, skipping the growth check`);
    }
    if (base) violations.push(...findNameGrowth(baseline, base));
  }

  if (violations.length > 0) {
    console.error(
      violations.map((violation) => `${violation.file}: ${violation.message}`).join('\n'),
    );
    console.error(`\n${hint}`);
    process.exit(1);
  }
  const left = Object.values(baseline).reduce((sum, names) => sum + names.length, 0);
  console.log(`${label}: ok (${left} known in the baseline)`);
}
