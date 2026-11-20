// Runs the database integration tests (core and web) against a throwaway local Postgres, then
// stops it. Without a database those suites skip, so preflight cannot prove billing or auth code.
//
// Usage: bun run test:db [-- <vitest args>]       e.g. bun run test:db -- credits
//        bun run test:db --keep                   leave the server running and print its URL
//
// - TEST_DATABASE_URL already set (CI, your own scratch database): used as is. Nothing is started
//   and the schema is not touched; push it yourself first.
// - Otherwise: initdb in a temp folder, start Postgres on a free local port, build the schema from
//   packages/db/prisma/schema.prisma, run the tests, stop the server and delete the folder.
//   Needs the Postgres server binaries (initdb, pg_ctl, psql). Set PG_BIN to their folder if they
//   are not on PATH or under /usr/lib/postgresql/<version>/bin.
//
// Never points at a real database: the started server listens on 127.0.0.1 and lives in a temp dir.
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const args = process.argv.slice(2);
const keep = args.includes('--keep');
const vitestArgs = args.filter((arg) => arg !== '--keep' && arg !== '--');

function fail(message: string): never {
  console.error(`test:db: ${message}`);
  process.exit(1);
}

function run(cmd: string[], opts: { cwd?: string; env?: Record<string, string | undefined> } = {}) {
  return Bun.spawnSync(cmd, {
    cwd: opts.cwd ?? root,
    env: { ...process.env, ...opts.env },
    stdio: ['inherit', 'inherit', 'inherit'],
  });
}

function runTests(url: string): number {
  const cmd = [
    'bunx',
    'turbo',
    'run',
    'test',
    '--filter=@easyrender/core',
    '--filter=@easyrender/web',
    ...(vitestArgs.length > 0 ? ['--', ...vitestArgs] : []),
  ];
  console.log(`\n▶ ${cmd.join(' ')}`);
  return run(cmd, { env: { TEST_DATABASE_URL: url, DATABASE_URL: url } }).exitCode ?? 1;
}

if (process.env.TEST_DATABASE_URL) {
  console.log('test:db: using TEST_DATABASE_URL from the environment');
  process.exit(runTests(process.env.TEST_DATABASE_URL));
}

// Find the Postgres server binaries.
function findBinDir(): string {
  const wanted = 'initdb';
  const candidates: string[] = [];
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Dev-tool input for this script only; it does not run through Turbo.
  const pgBin = process.env.PG_BIN;
  if (pgBin) candidates.push(pgBin);
  const onPath = Bun.which(wanted);
  if (onPath) candidates.push(resolve(onPath, '..'));
  const versions = '/usr/lib/postgresql';
  if (existsSync(versions)) {
    const sorted = readdirSync(versions).sort((a, b) => Number(b) - Number(a));
    for (const version of sorted) candidates.push(join(versions, version, 'bin'));
  }
  for (const dir of candidates) {
    if (existsSync(join(dir, 'initdb')) && existsSync(join(dir, 'pg_ctl'))) return dir;
  }
  return fail(
    'no Postgres server binaries found (initdb, pg_ctl). Install postgresql, or set PG_BIN to its bin folder.',
  );
}

async function freePort(): Promise<number> {
  const server = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } });
  const port = server.port;
  server.stop(true);
  return port;
}

const bin = findBinDir();
const psql = existsSync(join(bin, 'psql')) ? join(bin, 'psql') : (Bun.which('psql') ?? '');
if (!psql) fail('psql not found');

// initdb refuses to run as root, so a root container (the cloud sandbox) drops to `postgres`.
const isRoot = process.getuid?.() === 0;
const dir = join(tmpdir(), `easyrender-scratch-pg-${process.pid}`);
const data = join(dir, 'data');
const port = await freePort();
const dbName = 'er_test';
const url = `postgresql://postgres@127.0.0.1:${port}/${dbName}`;

function asServerUser(command: string): number {
  const cmd = isRoot
    ? ['su', 'postgres', '-s', '/bin/bash', '-c', command]
    : ['bash', '-c', command];
  return run(cmd).exitCode ?? 1;
}

let isStarted = false;
function cleanup() {
  if (isStarted && !keep) {
    asServerUser(`"${join(bin, 'pg_ctl')}" -D "${data}" -m immediate stop`);
    isStarted = false;
  }
  if (!keep) rmSync(dir, { recursive: true, force: true });
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    cleanup();
    process.exit(130);
  });
}

function finish(code: number): never {
  cleanup();
  process.exit(code);
}

mkdirSync(dir, { recursive: true });
if (isRoot) run(['chown', '-R', 'postgres', dir]);
// The directory must be traversable by the postgres user (a temp dir is, a 0700 home is not).
run(['chmod', '755', dir]);

console.log(`test:db: starting a scratch Postgres on 127.0.0.1:${port} (${dir})`);
if (asServerUser(`"${join(bin, 'initdb')}" -D "${data}" -A trust -U postgres >/dev/null`) !== 0) {
  finish(1);
}
const startCommand = `"${join(bin, 'pg_ctl')}" -D "${data}" -l "${join(dir, 'server.log')}" -w -o "-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off" start >/dev/null`;
if (asServerUser(startCommand) !== 0) {
  console.error(`test:db: Postgres did not start; see ${join(dir, 'server.log')}`);
  if (keep) process.exit(1);
  asServerUser(`cat "${join(dir, 'server.log')}" >&2`);
  finish(1);
}
isStarted = true;

const adminUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`;
if (
  run([psql, adminUrl, '-v', 'ON_ERROR_STOP=1', '-c', `create database ${dbName}`]).exitCode !== 0
) {
  finish(1);
}

// `prisma db push` stalls on a fresh database, so build the schema from a diff against nothing.
const diff = Bun.spawnSync(
  [
    'bunx',
    'prisma',
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema',
    join(root, 'packages/db/prisma/schema.prisma'),
    '--script',
  ],
  { cwd: join(root, 'packages/db'), stdout: 'pipe', stderr: 'inherit' },
);
if (diff.exitCode !== 0) {
  console.error('test:db: prisma migrate diff failed');
  finish(1);
}
const schemaSql = join(dir, 'schema.sql');
await Bun.write(schemaSql, diff.stdout);
if (
  run([psql, url, '-v', 'ON_ERROR_STOP=1', '-q', '-f', schemaSql], {
    env: { PGOPTIONS: '-c client_min_messages=warning' },
  }).exitCode !== 0
) {
  console.error('test:db: applying the schema failed');
  finish(1);
}

if (keep) {
  console.log(`\ntest:db: schema ready. TEST_DATABASE_URL=${url}`);
  console.log(`test:db: stop it with: ${join(bin, 'pg_ctl')} -D ${data} stop`);
}
finish(runTests(url));
