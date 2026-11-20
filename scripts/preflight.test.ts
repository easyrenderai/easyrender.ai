import { describe, expect, test } from 'bun:test';
import { countSkipped } from './preflight';

describe('countSkipped', () => {
  test('adds the skipped tests of every package in a turbo run', () => {
    const output = [
      '@easyrender/core:test:  \u001b[2m Test Files \u001b[22m 59 passed | 3 skipped (62)',
      '@easyrender/core:test:  \u001b[2m      Tests \u001b[22m \u001b[1m\u001b[32m444 passed\u001b[39m | \u001b[33m255 skipped\u001b[39m (699)',
      '@easyrender/web:test: \u001b[2m      Tests \u001b[22m 1158 passed | 12 skipped (1170)',
      '@easyrender/harness:test:       Tests  90 passed (90)',
    ].join('\n');
    expect(countSkipped(output)).toBe(267);
  });

  test('is zero when nothing skipped', () => {
    expect(
      countSkipped('      Tests  699 passed (699)\n Test Files  62 passed | 1 skipped (63)'),
    ).toBe(0);
  });
});
