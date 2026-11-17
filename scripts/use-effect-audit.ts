// Counts React effect hooks per source file. The ratchet in check-use-effect.ts compares the
// counts with scripts/use-effect-baseline.json so effects can only go down.
import ts from 'typescript';

export type EffectMetric = 'use_effect' | 'async_effect_without_abort';
export type EffectCounts = Record<EffectMetric, number>;

export const METRICS: readonly EffectMetric[] = ['use_effect', 'async_effect_without_abort'];

// One escape hatch: `// use-effect-audit: ignore <reason>` on the line above the effect call.
const IGNORE = /^\s*\/\/\s*use-effect-audit:\s*ignore(?:\s+(\S.*?))?\s*$/;
const EFFECT_HOOKS = new Set(['useEffect', 'useLayoutEffect']);
const ABORT_NAMES = new Set(['AbortController', 'AbortSignal', 'signal']);

export type EffectFinding = {
  line: number;
  isAsync: boolean;
  isIgnored: boolean;
};

export type EffectAudit = {
  counts: EffectCounts;
  findings: EffectFinding[];
  // Ignore comments written without a reason, as 1-based line numbers.
  reasonlessIgnores: number[];
};

function hookName(call: ts.CallExpression): string | undefined {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return undefined;
}

// True when the callback does asynchronous work: an await, a .then(...) chain, or fetch(...).
function isAsyncWork(node: ts.Node): boolean {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) return;
    if (ts.isAwaitExpression(child)) {
      found = true;
      return;
    }
    if (ts.isCallExpression(child)) {
      const callee = child.expression;
      if (ts.isIdentifier(callee) && callee.text === 'fetch') found = true;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'then') found = true;
      if (found) return;
    }
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return found;
}

// True when the callback names AbortController, AbortSignal or a `signal`.
function mentionsAbort(node: ts.Node): boolean {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) return;
    if (ts.isIdentifier(child) && ABORT_NAMES.has(child.text)) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return found;
}

export function auditSource(fileName: string, source: string): EffectAudit {
  const kind =
    fileName.endsWith('.tsx') || fileName.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const lines = source.split('\n');

  const reasonlessIgnores: number[] = [];
  lines.forEach((text, index) => {
    const match = IGNORE.exec(text);
    if (match && !match[1]) reasonlessIgnores.push(index + 1);
  });

  const findings: EffectFinding[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = hookName(node);
      if (name && EFFECT_HOOKS.has(name)) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const above = lines[line - 2] ?? '';
        const ignore = IGNORE.exec(above);
        const callback = node.arguments[0];
        const isFunction =
          callback !== undefined &&
          (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback));
        findings.push({
          line,
          isIgnored: Boolean(ignore?.[1]),
          isAsync: isFunction && isAsyncWork(callback) && !mentionsAbort(callback),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const counts: EffectCounts = { use_effect: 0, async_effect_without_abort: 0 };
  for (const finding of findings) {
    if (finding.isIgnored) continue;
    counts.use_effect += 1;
    if (finding.isAsync) counts.async_effect_without_abort += 1;
  }
  return { counts, findings, reasonlessIgnores };
}

export type Baseline = Record<string, Partial<EffectCounts>>;

export type Violation = { file: string; message: string };

// Compares current counts with the baseline. A new file, a higher count and a lower count that is
// still in the baseline all fail: the baseline is exact, so effects can only go down.
export function compareToBaseline(
  current: Record<string, EffectCounts>,
  baseline: Baseline,
): Violation[] {
  const violations: Violation[] = [];
  const files = [...new Set([...Object.keys(current), ...Object.keys(baseline)])].sort();
  for (const file of files) {
    for (const metric of METRICS) {
      const found = current[file]?.[metric] ?? 0;
      const allowed = baseline[file]?.[metric] ?? 0;
      if (found > allowed) {
        const reason = metric === 'use_effect' ? 'useEffect' : 'async effect without an abort';
        violations.push({
          file,
          message: `${found} ${reason} call(s), ${allowed} allowed.`,
        });
      } else if (found < allowed) {
        violations.push({
          file,
          message: `${found} ${metric} left, baseline says ${allowed}. Lower it: bun run check:use-effects --prune`,
        });
      }
    }
  }
  return violations;
}

// A baseline may shrink but never grow: any file or metric above the base ref's value fails.
export function findGrowth(baseline: Baseline, base: Baseline): Violation[] {
  const violations: Violation[] = [];
  for (const file of Object.keys(baseline).sort()) {
    for (const metric of METRICS) {
      const now = baseline[file]?.[metric] ?? 0;
      const before = base[file]?.[metric] ?? 0;
      if (now > before) {
        violations.push({
          file,
          message: `baseline ${metric} grew from ${before} to ${now}. The baseline may only shrink.`,
        });
      }
    }
  }
  return violations;
}

// Drops zero entries so the JSON only lists files that still have effects.
export function toBaseline(current: Record<string, EffectCounts>): Baseline {
  const baseline: Baseline = {};
  for (const file of Object.keys(current).sort()) {
    const counts = current[file];
    if (!counts || counts.use_effect === 0) continue;
    const entry: Partial<EffectCounts> = { use_effect: counts.use_effect };
    if (counts.async_effect_without_abort > 0) {
      entry.async_effect_without_abort = counts.async_effect_without_abort;
    }
    baseline[file] = entry;
  }
  return baseline;
}
