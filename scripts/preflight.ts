// Runs what CI runs, in order, and stops at the first failure: Biome (warnings fail), UI guards,
// effect ratchet, unused code and env checks, typecheck, tests.
// Usage: bun run preflight [--keep-going]
const keepGoing = process.argv.includes('--keep-going');

const steps: Array<[string, string[]]> = [
  ['biome', ['bunx', 'biome', 'check', '.', '--error-on-warnings']],
  ['ui guards', ['bun', 'scripts/check-ui-guards.ts']],
  ['use-effect ratchet', ['bun', 'scripts/check-use-effect.ts']],
  ['use-effect ratchet tests', ['bun', 'test', 'scripts/use-effect-audit.test.ts']],
  ['unused code (knip)', ['bun', 'scripts/check-knip.ts']],
  ['env variables', ['bun', 'scripts/check-env.ts']],
  ['baseline checks tests', ['bun', 'test', 'scripts/name-ratchet.test.ts']],
  ['typecheck', ['bunx', 'turbo', 'run', 'typecheck']],
  ['tests', ['bunx', 'turbo', 'run', 'test']],
];

// The store plugins are PHP; CI checks them in their own job, and so does this when php is installed.
if (Bun.which('php')) {
  steps.push(['woocommerce plugin', ['php', 'plugins/woocommerce/easyrender-3d/tests/run.php']]);
  steps.push(['prestashop module', ['php', 'plugins/prestashop/easyrender3d/tests/run.php']]);
}

let failed = 0;
for (const [name, cmd] of steps) {
  console.log(`\n▶ ${name}: ${cmd.join(' ')}`);
  const result = Bun.spawnSync(cmd, { stdio: ['inherit', 'inherit', 'inherit'] });
  if (result.exitCode !== 0) {
    failed += 1;
    console.error(`✖ ${name} failed`);
    if (!keepGoing) process.exit(result.exitCode ?? 1);
  }
}
if (failed > 0) process.exit(1);
console.log('\npreflight: ok');
