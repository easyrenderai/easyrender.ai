import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-20T12:00:00Z');
const roots: string[] = [];

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'easyrender-sitemap-'));
  roots.push(root);
  const blog = join(root, 'content/blog/en');
  const compare = join(root, 'content/compare/en');
  mkdirSync(blog, { recursive: true });
  mkdirSync(compare, { recursive: true });
  for (const [slug, date, updated, body] of [
    [
      'older',
      '2026-11-10',
      '2026-11-19',
      [
        '![Photo](/showcase/armchair.jpg)',
        '![Same photo](/showcase/armchair.jpg)',
        '![Model](/showcase/armchair.glb)',
        '![Diagram](diagram:glb-anatomy)',
        '![Unknown](/not-a-real-image.jpg)',
        '<!-- ![Draft image](/showcase/vase.jpg) -->',
      ].join('\n\n'),
    ],
    ['middle', '2026-11-11', '2026-11-11', 'Body.'],
    ['newest', '2026-11-12', '2026-11-12', 'Body.'],
    ['future', '2026-11-21', '2026-11-21', '![Future](/showcase/vase-angles.jpg)'],
  ]) {
    writeFileSync(
      join(blog, `${slug}.md`),
      `---\ngroup: ${slug}\ntitle: ${slug}\ndescription: Guide.\ndate: ${date}\nupdated: ${updated}\n---\n\n${body}`,
    );
  }
  writeFileSync(
    join(compare, 'meshy.md'),
    '---\ngroup: meshy\ntitle: Meshy\ndescription: Comparison.\nupdated: 2026-11-18\n---\n\n![Trial](/benchmarks/2026-11-15/meshy-viewer.jpg)',
  );
  vi.resetModules();
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  return import('./sitemap');
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('sitemap freshness and image discovery', () => {
  it('reflects an older guide update in the hub without exposing a scheduled post', async () => {
    const { localeEntries } = await fixture();
    const entries = localeEntries('en', NOW);
    expect(entries.find((entry) => entry.path === '/learn')?.lastModified).toBe(
      '2026-11-19T00:00:00.000Z',
    );
    expect(entries.some((entry) => entry.path === '/learn/future')).toBe(false);
  });

  it('dates the comparisons hub from its published content', async () => {
    const { localeEntries } = await fixture();
    expect(localeEntries('en', NOW).find((entry) => entry.path === '/compare')?.lastModified).toBe(
      '2026-11-18',
    );
  });

  it('lists rendered images and model posters once, on the page where they appear', async () => {
    const { localeSitemapXml } = await fixture();
    const xml = localeSitemapXml('en', NOW);
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    const guide =
      xml.split('<loc>https://easyrender.ai/learn/older</loc>')[1]?.split('</url>')[0] ?? '';
    expect(
      guide.match(/<image:loc>https:\/\/easyrender.ai\/showcase\/armchair.jpg<\/image:loc>/g),
    ).toHaveLength(1);
    expect(guide).toContain(
      '<image:loc>https://easyrender.ai/blog/models/armchair.webp</image:loc>',
    );
    const comparison = xml
      .split('<loc>https://easyrender.ai/compare/meshy</loc>')[1]
      ?.split('</url>')[0];
    expect(comparison).toContain(
      '<image:loc>https://easyrender.ai/benchmarks/2026-11-15/meshy-viewer.jpg</image:loc>',
    );
    for (const excluded of [
      '.glb</image:loc>',
      'diagram:',
      'not-a-real-image',
      '/showcase/vase.jpg',
      '/showcase/vase-angles.jpg',
    ]) {
      expect(xml).not.toContain(excluded);
    }
  });
});
