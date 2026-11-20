// Unused files, exports and types, found by knip (knip.json), against scripts/knip-baseline.json.
// Anything knip finds that the baseline does not list fails. Delete the code, or use it.
//
// bun run check:knip                    check against the baseline
// bun run check:knip --prune            lower the baseline to today's findings (never raises it)
// bun run check:knip --against <ref>    also fail if the baseline grew compared with <ref>
import { type NameMap, runNameRatchet } from './name-ratchet';

type KnipIssue = {
  file: string;
  files: Array<{ name: string }>;
  exports: Array<{ name: string }>;
  types: Array<{ name: string }>;
};

const result = Bun.spawnSync(
  ['bunx', 'knip', '--include', 'files,exports,types', '--reporter', 'json', '--no-exit-code'],
  { cwd: new URL('..', import.meta.url).pathname, stderr: 'pipe' },
);
if (result.exitCode !== 0) {
  console.error(result.stderr.toString());
  console.error('knip failed to run');
  process.exit(1);
}

const current: NameMap = {};
for (const issue of (JSON.parse(result.stdout.toString()) as { issues: KnipIssue[] }).issues) {
  const names = [
    ...issue.files.map(() => 'unused file'),
    ...issue.exports.map((entry) => `export ${entry.name}`),
    ...issue.types.map((entry) => `type ${entry.name}`),
  ];
  if (names.length > 0) current[issue.file] = names;
}

runNameRatchet({
  label: 'knip',
  command: 'bun run check:knip',
  baselinePath: 'scripts/knip-baseline.json',
  current,
  hint: [
    'Delete the unused file or export, or use it. Do not add to the baseline.',
    'After removing code, lower the baseline with: bun run check:knip --prune',
    'If knip is wrong about an entry point, fix knip.json instead.',
  ].join('\n'),
});
