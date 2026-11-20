// Runs what CI runs, in order, and stops at the first failure: Biome, UI guards, secrets, effect
// ratchet, typecheck, tests, the release promotion contract and the REST example typecheck.
// Tests that need a database skip without TEST_DATABASE_URL; the run ends by saying how many
// skipped and how to run them (`bun run test:db`).
// Usage: bun run preflight [--keep-going]
const keepGoing = process.argv.includes('--keep-going');

const steps: Array<[string, string[]]> = [
  ['biome', ['bunx', 'biome', 'check', '.']],
  ['ui guards', ['bun', 'scripts/check-ui-guards.ts']],
  ['secrets', ['bun', 'scripts/check-secrets.ts']],
  ['use-effect ratchet', ['bun', 'scripts/check-use-effect.ts']],
  ['use-effect ratchet tests', ['bun', 'test', 'scripts/use-effect-audit.test.ts']],
  ['preflight tests', ['bun', 'test', 'scripts/preflight.test.ts']],
  ['typecheck', ['bunx', 'turbo', 'run', 'typecheck']],
  ['tests', ['bunx', 'turbo', 'run', 'test']],
  ['examples/rest typecheck', ['bunx', 'tsc', '-p', 'examples/rest/tsconfig.json']],
];

// CI runs the release promotion contract with Node's test runner.
if (Bun.which('node')) {
  steps.push(['release promotion contract', ['node', '--test', 'scripts/promote-vercel.test.mjs']]);
} else {
  console.warn('preflight: node not found, skipping the release promotion contract test');
}

// The store plugins are PHP; CI checks them in their own job, and so does this when php is installed.
if (Bun.which('php')) {
  steps.push(['woocommerce plugin', ['php', 'plugins/woocommerce/easyrender-3d/tests/run.php']]);
  steps.push(['prestashop module', ['php', 'plugins/prestashop/easyrender3d/tests/run.php']]);
}

// Vitest prints `Tests  444 passed | 255 skipped (699)` once per package; turbo prefixes the line.
const SKIPPED_LINE = /^(?:\S+:test:\s+)?\s*Tests\s+.*?(\d+) skipped/gm;

export function countSkipped(output: string): number {
  let total = 0;
  for (const match of Bun.stripANSI(output).matchAll(SKIPPED_LINE)) total += Number(match[1]);
  return total;
}

// Runs a step with its output shown live and also returned, so the tests step can be read.
async function run(cmd: string[]): Promise<{ exitCode: number; output: string }> {
  const child = Bun.spawn(cmd, { stdin: 'inherit', stdout: 'pipe', stderr: 'pipe' });
  let output = '';
  const pump = async (stream: ReadableStream<Uint8Array>, sink: NodeJS.WriteStream) => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) {
      sink.write(chunk);
      output += decoder.decode(chunk, { stream: true });
    }
  };
  await Promise.all([pump(child.stdout, process.stdout), pump(child.stderr, process.stderr)]);
  return { exitCode: await child.exited, output };
}

if (import.meta.main) {
  let failed = 0;
  let skipped = 0;
  for (const [name, cmd] of steps) {
    console.log(`\n▶ ${name}: ${cmd.join(' ')}`);
    const result = await run(cmd);
    if (name === 'tests') skipped = countSkipped(result.output);
    if (result.exitCode !== 0) {
      failed += 1;
      console.error(`✖ ${name} failed`);
      if (!keepGoing) process.exit(result.exitCode);
    }
  }
  if (failed > 0) process.exit(1);
  if (skipped > 0) {
    console.log(
      `\npreflight: ${skipped} tests skipped because no database is set (TEST_DATABASE_URL). Run them with: bun run test:db`,
    );
  }
  console.log('\npreflight: ok');
}
