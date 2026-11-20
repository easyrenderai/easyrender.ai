import { expect, test } from 'bun:test';
import { envReads, exampleNames, isInTurbo, turboPatterns } from './check-env';
import { compareNames, findNameGrowth, normalize } from './name-ratchet';

test('a name outside the baseline fails, and so does a fixed name left in it', () => {
  const baseline = { 'a.ts': ['export one', 'export two'] };
  expect(compareNames({ 'a.ts': ['export one', 'export two'] }, baseline, 'prune')).toEqual([]);
  expect(
    compareNames({ 'a.ts': ['export one', 'export two', 'export three'] }, baseline, 'prune'),
  ).toEqual([{ file: 'a.ts', message: 'export three: new, not in the baseline.' }]);
  expect(compareNames({ 'b.ts': ['export one'] }, baseline, 'prune').map((v) => v.file)).toEqual([
    'a.ts',
    'a.ts',
    'b.ts',
  ]);
  expect(
    compareNames({ 'a.ts': ['export one'] }, baseline, 'bun run x --prune')[0]?.message,
  ).toContain('bun run x --prune');
});

test('the baseline may not grow against its base', () => {
  expect(findNameGrowth({ 'a.ts': ['x'] }, { 'a.ts': ['x', 'y'] })).toEqual([]);
  expect(findNameGrowth({ 'a.ts': ['x', 'y'] }, { 'a.ts': ['x'] })).toHaveLength(1);
  expect(findNameGrowth({ 'b.ts': ['x'] }, {})).toHaveLength(1);
});

test('normalize sorts, dedupes and drops empty files', () => {
  expect(normalize({ 'b.ts': ['z', 'a', 'a'], 'a.ts': [] })).toEqual({ 'b.ts': ['a', 'z'] });
});

test('env reads cover dot and bracket access', () => {
  expect(
    envReads('process.env.FOO; process.env[\'BAR_1\']; process.env["BAZ"]; process.env.lower'),
  ).toEqual(['FOO', 'BAR_1', 'BAZ']);
});

test('.env.example counts set and commented names, turbo.json counts names and prefixes', () => {
  const names = exampleNames('A=1\n# B=2\n# prose without equals\nC=\n#D_E=x');
  expect([...names].sort()).toEqual(['A', 'B', 'C', 'D_E']);
  const patterns = turboPatterns({
    globalEnv: ['G'],
    tasks: { build: { env: ['STRIPE_*', 'X'] }, test: { env: ['T'] } },
  });
  expect(patterns.sort()).toEqual(['G', 'STRIPE_*', 'T', 'X']);
  expect(isInTurbo('STRIPE_PRICE', patterns)).toBe(true);
  expect(isInTurbo('STRIPE', patterns)).toBe(false);
  expect(isInTurbo('Y', patterns)).toBe(false);
});
