import { describe, expect, test } from 'bun:test';
import { auditSource, compareToBaseline, findGrowth, toBaseline } from './use-effect-audit';

const counts = (source: string, name = 'a.tsx') => auditSource(name, source).counts;

describe('auditSource', () => {
  test('counts every useEffect call, including React.useEffect and useLayoutEffect', () => {
    const source = `
      import React, { useEffect, useLayoutEffect } from 'react';
      function A() {
        useEffect(() => { document.title = 'a'; }, []);
        React.useEffect(() => { document.title = 'b'; }, []);
        useLayoutEffect(() => { document.title = 'c'; }, []);
        return null;
      }`;
    expect(counts(source)).toEqual({ use_effect: 3, async_effect_without_abort: 0 });
  });

  test('ignores effect names inside strings and comments', () => {
    const source = `
      // useEffect(() => {}, [])
      const text = 'useEffect(() => {}, [])';`;
    expect(counts(source)).toEqual({ use_effect: 0, async_effect_without_abort: 0 });
  });

  test('flags await, .then and fetch effects that never mention an abort', () => {
    const source = `
      function A() {
        useEffect(() => { void (async () => { await load(); })(); }, []);
        useEffect(() => { load().then(setData); }, []);
        useEffect(() => { fetch('/api/x'); }, []);
        return null;
      }`;
    expect(counts(source)).toEqual({ use_effect: 3, async_effect_without_abort: 3 });
  });

  test('accepts AbortController, AbortSignal and a signal', () => {
    const source = `
      function A() {
        useEffect(() => {
          const controller = new AbortController();
          fetch('/api/x', { signal: controller.signal });
          return () => controller.abort();
        }, []);
        useEffect(() => {
          const timeout = AbortSignal.timeout(1000);
          fetch('/api/y', { signal: timeout });
        }, []);
        useEffect((signal) => { load(signal).then(setData); }, []);
        return null;
      }`;
    expect(counts(source)).toEqual({ use_effect: 3, async_effect_without_abort: 0 });
  });

  test('does not call a synchronous effect async', () => {
    const source = `
      function A() {
        useEffect(() => {
          const id = setInterval(tick, 1000);
          return () => clearInterval(id);
        }, []);
        return null;
      }`;
    expect(counts(source)).toEqual({ use_effect: 1, async_effect_without_abort: 0 });
  });

  test('skips an effect with an ignore comment and a reason on the line above', () => {
    const source = `
      function A() {
        // use-effect-audit: ignore subscribes to the browser matchMedia API
        useEffect(() => { query.addEventListener('change', update); }, []);
        useEffect(() => { document.title = 'x'; }, []);
        return null;
      }`;
    const audit = auditSource('a.tsx', source);
    expect(audit.counts).toEqual({ use_effect: 1, async_effect_without_abort: 0 });
    expect(audit.findings.map((finding) => [finding.line, finding.isIgnored])).toEqual([
      [4, true],
      [5, false],
    ]);
  });

  test('an ignore comment without a reason does not skip the effect and is reported', () => {
    const source = [
      'function A() {',
      '  // use-effect-audit: ignore',
      '  useEffect(() => { document.title = "x"; }, []);',
      '  return null;',
      '}',
    ].join('\n');
    const audit = auditSource('a.tsx', source);
    expect(audit.counts).toEqual({ use_effect: 1, async_effect_without_abort: 0 });
    expect(audit.reasonlessIgnores).toEqual([2]);
  });

  test('an ignore comment two lines above does not apply', () => {
    const source = ['// use-effect-audit: ignore reason', '', 'useEffect(() => {}, []);'].join(
      '\n',
    );
    expect(counts(source, 'a.ts')).toEqual({ use_effect: 1, async_effect_without_abort: 0 });
  });
});

describe('compareToBaseline', () => {
  const baseline = { 'a.tsx': { use_effect: 2, async_effect_without_abort: 1 } };

  test('passes when the counts match the baseline exactly', () => {
    const current = { 'a.tsx': { use_effect: 2, async_effect_without_abort: 1 } };
    expect(compareToBaseline(current, baseline)).toEqual([]);
  });

  test('fails a new file', () => {
    const current = {
      'a.tsx': { use_effect: 2, async_effect_without_abort: 1 },
      'b.tsx': { use_effect: 1, async_effect_without_abort: 0 },
    };
    expect(compareToBaseline(current, baseline)).toEqual([
      { file: 'b.tsx', message: '1 useEffect call(s), 0 allowed.' },
    ]);
  });

  test('fails a higher count', () => {
    const current = { 'a.tsx': { use_effect: 3, async_effect_without_abort: 2 } };
    expect(compareToBaseline(current, baseline)).toEqual([
      { file: 'a.tsx', message: '3 useEffect call(s), 2 allowed.' },
      { file: 'a.tsx', message: '2 async effect without an abort call(s), 1 allowed.' },
    ]);
  });

  test('fails a lower count until the baseline is pruned', () => {
    const current = { 'a.tsx': { use_effect: 1, async_effect_without_abort: 1 } };
    expect(compareToBaseline(current, baseline)).toEqual([
      {
        file: 'a.tsx',
        message: '1 use_effect left, baseline says 2. Lower it: bun run check:use-effects --prune',
      },
    ]);
  });

  test('fails a baseline file that no longer has effects', () => {
    expect(compareToBaseline({}, baseline).map((violation) => violation.file)).toEqual([
      'a.tsx',
      'a.tsx',
    ]);
  });
});

describe('findGrowth', () => {
  test('fails when the baseline grew or gained a file', () => {
    const base = { 'a.tsx': { use_effect: 2 } };
    const grown = { 'a.tsx': { use_effect: 3 }, 'b.tsx': { use_effect: 1 } };
    expect(findGrowth(grown, base)).toEqual([
      {
        file: 'a.tsx',
        message: 'baseline use_effect grew from 2 to 3. The baseline may only shrink.',
      },
      {
        file: 'b.tsx',
        message: 'baseline use_effect grew from 0 to 1. The baseline may only shrink.',
      },
    ]);
  });

  test('passes when the baseline only shrank', () => {
    const base = { 'a.tsx': { use_effect: 2 }, 'b.tsx': { use_effect: 1 } };
    expect(findGrowth({ 'a.tsx': { use_effect: 1 } }, base)).toEqual([]);
  });
});

describe('toBaseline', () => {
  test('keeps only files with effects and omits a zero async count', () => {
    const current = {
      'b.tsx': { use_effect: 1, async_effect_without_abort: 0 },
      'a.tsx': { use_effect: 2, async_effect_without_abort: 1 },
      'c.tsx': { use_effect: 0, async_effect_without_abort: 0 },
    };
    const baseline = toBaseline(current);
    expect(Object.keys(baseline)).toEqual(['a.tsx', 'b.tsx']);
    expect(baseline).toEqual({
      'a.tsx': { use_effect: 2, async_effect_without_abort: 1 },
      'b.tsx': { use_effect: 1 },
    });
  });
});
