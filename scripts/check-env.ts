// Every environment variable the app reads (process.env.NAME in apps/web and packages/*) has to be
// in .env.example and in turbo.json, so a new variable is never missing from the docs or from the
// Turborepo cache key. Known gaps are in scripts/env-baseline.json and only shrink.
//
// bun run check:env                    check against the baseline
// bun run check:env --prune            lower the baseline to today's gaps (never raises it)
// bun run check:env --against <ref>    also fail if the baseline grew compared with <ref>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type NameMap, runNameRatchet } from './name-ratchet';

const ROOT = new URL('..', import.meta.url).pathname;
const SOURCE = /^(?:apps\/web|packages\/[^/]+)\/.*\.(?:[cm]?[jt]s|[jt]sx)$/;
const SKIPPED =
  /(?:^|\/)(?:node_modules|\.next|generated|e2e|__tests__|scripts)\/|\.(?:test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/;
// Set by the platform (Node, Next.js, Vercel), never by us.
const PLATFORM =
  /^(?:NODE_ENV|CI|PORT|NEXT_RUNTIME|NEXT_PHASE|VERCEL(?:_.*)?|NEXT_PUBLIC_VERCEL_.*)$/;
const READ = /process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\])/g;

export function envReads(source: string): string[] {
  return [...source.matchAll(READ)].map((match) => match[1] ?? match[2] ?? '');
}

export function exampleNames(text: string): Set<string> {
  const names = new Set<string>();
  for (const line of text.split('\n')) {
    const match = line.match(/^#?\s?([A-Z][A-Z0-9_]*)=/);
    if (match?.[1]) names.add(match[1]);
  }
  return names;
}

// Names and `PREFIX_*` patterns from every env list in turbo.json.
export function turboPatterns(config: unknown): string[] {
  const patterns: string[] = [];
  const visit = (value: unknown, key?: string) => {
    if (
      Array.isArray(value) &&
      key &&
      /^(?:globalEnv|globalPassThroughEnv|env|passThroughEnv)$/.test(key)
    ) {
      for (const entry of value) if (typeof entry === 'string') patterns.push(entry);
    } else if (value && typeof value === 'object') {
      for (const [name, child] of Object.entries(value)) visit(child, name);
    }
  };
  visit(config);
  return patterns;
}

export function isInTurbo(name: string, patterns: string[]): boolean {
  return patterns.some((pattern) =>
    pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : pattern === name,
  );
}

if (import.meta.main) {
  const files = Bun.spawnSync(['git', 'ls-files'], { cwd: ROOT })
    .stdout.toString()
    .split('\n')
    .filter((file) => SOURCE.test(file) && !SKIPPED.test(file));
  const example = exampleNames(readFileSync(join(ROOT, '.env.example'), 'utf8'));
  const turbo = turboPatterns(JSON.parse(readFileSync(join(ROOT, 'turbo.json'), 'utf8')));

  const current: NameMap = {};
  for (const file of files) {
    const missing = new Set<string>();
    for (const name of envReads(readFileSync(join(ROOT, file), 'utf8'))) {
      if (PLATFORM.test(name)) continue;
      if (!example.has(name)) missing.add(`${name} missing from .env.example`);
      if (!isInTurbo(name, turbo)) missing.add(`${name} missing from turbo.json`);
    }
    if (missing.size > 0) current[file] = [...missing];
  }

  runNameRatchet({
    label: 'env',
    command: 'bun run check:env',
    baselinePath: 'scripts/env-baseline.json',
    current,
    hint: [
      'Add the variable to .env.example (no value) and to turbo.json (build.env), and say in the PR that Vercel needs it.',
      'After fixing a gap, lower the baseline with: bun run check:env --prune',
    ].join('\n'),
  });
}
