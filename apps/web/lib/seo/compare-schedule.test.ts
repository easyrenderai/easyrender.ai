import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';

it('serves and discovers each comparison translation only on its own date', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easyrender-compare-schedule-'));
  const first = new Date('2026-11-23T00:00:00.000Z');
  const before = new Date(first.getTime() - 1);
  const spanish = new Date('2026-11-24T00:00:00.000Z');
  const slug = 'scheduled-comparison';
  try {
    for (const [locale, date] of [
      ['en', '2026-11-23'],
      ['es', spanish.toISOString()],
    ] as const) {
      const dir = join(root, 'content', 'compare', locale);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, `${slug}.md`),
        `---\ngroup: ${slug}\ntitle: Scheduled comparison\ndescription: Compare two models.\npublishAt: ${date}\n---\n\nContent.\n`,
      );
    }
    const legacyPath = join(root, 'content', 'compare', 'en', 'legacy.md');
    writeFileSync(
      legacyPath,
      '---\ngroup: legacy\ntitle: Legacy\ndescription: Previous comparison.\ndate: 2099-12-30\n---\n\nContent.\n',
    );

    vi.resetModules();
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    const { compareLivePaths, getComparePage, listComparePages, parseComparePage } = await import(
      '@/lib/compare/pages'
    );
    const { localeEntries } = await import('./sitemap');
    const { equivalentPaths } = await import('./equivalents');

    expect(getComparePage(slug, 'en', before)).toBeNull();
    expect(getComparePage(slug, 'en', first)?.path).toBe(`/compare/${slug}`);
    expect(listComparePages('en', before).map((page) => page.slug)).toEqual(['legacy']);
    expect(getComparePage('legacy', 'en', before)?.path).toBe('/compare/legacy');
    expect(compareLivePaths(slug, before)).toEqual({});
    expect(compareLivePaths(slug, first)).toEqual({ en: `/compare/${slug}` });
    expect(compareLivePaths(slug, spanish)).toEqual({
      en: `/compare/${slug}`,
      es: `/es/comparativas/${slug}`,
    });
    expect(equivalentPaths(`/es/comparativas/${slug}`, first)).not.toContainEqual({
      locale: 'es',
      path: `/es/comparativas/${slug}`,
    });
    expect(localeEntries('en', before).some((entry) => entry.path === `/compare/${slug}`)).toBe(
      false,
    );
    expect(
      localeEntries('en', first).find((entry) => entry.path === `/compare/${slug}`)?.alternates,
    ).toEqual({ en: `/compare/${slug}` });
    expect(
      localeEntries('es', spanish).some((entry) => entry.path === `/es/comparativas/${slug}`),
    ).toBe(true);
    expect(
      parseComparePage(
        'en',
        'bad-date',
        '---\ngroup: bad-date\ntitle: Bad date\ndescription: Invalid.\npublishAt: soon\n---\n\nContent.',
      ),
    ).toHaveProperty('error');
  } finally {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  }
});
