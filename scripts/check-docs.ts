// Keeps AGENTS.md honest about the repo: every top-level folder is in the Layout block, and the
// `Languages:` line matches LOCALES in apps/web/i18n/config.ts.
// Usage: bun run check:docs [--file <path to a AGENTS.md>]   (--file is for testing the check)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '../apps/web/i18n/config';

const root = join(import.meta.dir, '..');
const fileFlag = process.argv.indexOf('--file');
const agentsPath = fileFlag >= 0 ? (process.argv[fileFlag + 1] ?? '') : join(root, 'AGENTS.md');
const text = readFileSync(agentsPath, 'utf8');

const problems: string[] = [];

// The Layout block is the first fenced block after the "## Layout" heading.
const layoutBlock = /^## Layout\s*\n+```[^\n]*\n([\s\S]*?)\n```/m.exec(text)?.[1];
if (!layoutBlock) {
  problems.push('AGENTS.md has no fenced block under "## Layout".');
} else {
  const listed = new Set<string>();
  for (const line of layoutBlock.split('\n')) {
    if (!line || /^\s/.test(line)) continue; // continuation lines are indented
    const first = line.split(/\s+/)[0]?.replace(/\/+$/, '').split('/')[0];
    if (first) listed.add(first);
  }
  const folders = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .map((e) => e.name)
    .sort();
  for (const folder of folders) {
    if (!listed.has(folder))
      problems.push(`Folder "${folder}/" is missing from the AGENTS.md layout.`);
  }
  for (const name of [...listed].sort()) {
    if (!folders.includes(name))
      problems.push(`The AGENTS.md layout lists "${name}/", which does not exist.`);
  }
}

const languagesLine = /^Languages:\s*(.+)$/m.exec(text)?.[1];
if (!languagesLine) {
  problems.push('AGENTS.md has no "Languages:" line.');
} else {
  const documented = [...languagesLine.matchAll(/`([a-z]{2})`/g)].map((m) => m[1]);
  const actual = [...LOCALES];
  if (documented.join(',') !== actual.join(',')) {
    problems.push(
      `AGENTS.md Languages (${documented.join(', ') || 'none'}) differ from LOCALES in apps/web/i18n/config.ts (${actual.join(', ')}).`,
    );
  }
}

if (problems.length > 0) {
  console.error(`check:docs failed for ${agentsPath}:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('check:docs: AGENTS.md layout and languages match the repo.');
