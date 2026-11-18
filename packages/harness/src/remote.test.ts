import { afterEach, describe, expect, it } from 'vitest';
import { LIMITS } from './guardrails';
import { MATERIALS } from './materials';
import { DEFAULT_BUILD_SETTINGS, DEFAULT_SHEET_SETTINGS } from './models';
import {
  clearHarnessCache,
  DEFAULT_HARNESS,
  loadHarness,
  parseHarness,
  parseSkills,
} from './remote';
import { SHEET_PROMPT } from './sheet';

const skillFile =
  '---\nname: ring\n---\nKeep the exact stone count and metal colour of this piece.';
const manifest = [{ id: 'ring', label: 'Rings', keywords: ['ring'], file: 'skills/ring/SKILL.md' }];

const fakeFetch = (routes: Record<string, string | number>): typeof fetch =>
  (async (url: string) => {
    const hit = Object.entries(routes).find(([key]) => String(url).endsWith(key));
    if (!hit) return new Response('not found', { status: 404 });
    return typeof hit[1] === 'number'
      ? new Response('error', { status: hit[1] })
      : new Response(hit[1]);
  }) as typeof fetch;

afterEach(clearHarnessCache);

describe('parseSkills', () => {
  it('reads guidance from the file body without the front matter', () => {
    const skills = parseSkills(manifest, { 'skills/ring/SKILL.md': skillFile });
    expect(skills?.[0]?.guidance).toBe(
      'Keep the exact stone count and metal colour of this piece.',
    );
  });

  it('rejects a manifest with a missing file or bad entry', () => {
    expect(parseSkills(manifest, {})).toBeNull();
    expect(parseSkills([{ id: 'x' }], {})).toBeNull();
    expect(parseSkills({}, {})).toBeNull();
  });
});

describe('parseHarness', () => {
  it('keeps defaults for anything missing or invalid', () => {
    const parsed = parseHarness({ build: { version: 'nope' }, limits: { maxEmptyCells: -1 } });
    expect(parsed?.build.version).toBe(DEFAULT_BUILD_SETTINGS.version);
    expect(parsed?.limits.maxEmptyCells).toBe(LIMITS.maxEmptyCells);
    expect(parsed?.sheetPrompt).toBe(SHEET_PROMPT);
  });

  it('takes material profiles from the harness only when every entry is valid', () => {
    const profile = {
      id: 'glass',
      label: 'Glass',
      keywords: ['glass', 'cristal'],
      guidance: 'Glass is cut, blown or bent hot, so show thick, even edges and smooth curves.',
    };
    expect(parseHarness({ materials: [profile] })?.materials).toEqual([profile]);
    expect(parseHarness({ materials: [profile, { id: 'x' }] })?.materials).toBe(MATERIALS);
    expect(parseHarness({ materials: [{ ...profile, keywords: ['.*'] }] })?.materials).toBe(
      MATERIALS,
    );
    expect(parseHarness({})?.materials).toBe(MATERIALS);
  });

  it('keeps the sheet model and its settings in code', () => {
    const parsed = parseHarness({
      sheet: { path: '/models/google/nano-banana-pro/predictions', input: { resolution: '2K' } },
    });
    expect(parsed?.sheet).toEqual(DEFAULT_SHEET_SETTINGS);
    expect(parsed?.sheet.path).toContain('nano-banana-2.1');
  });

  it('applies valid overrides and refuses a prompt that is not a 3x3 sheet', () => {
    const version = 'a'.repeat(64);
    const parsed = parseHarness({ build: { version }, limits: { duplicateViewDistance: 0.02 } });
    expect(parsed?.build.version).toBe(version);
    expect(parsed?.limits.duplicateViewDistance).toBe(0.02);
    expect(parseHarness({ sheetPrompt: 'x'.repeat(300) })).toBeNull();
  });
});

describe('loadHarness', () => {
  const skillsRoutes = {
    '/skills.json': JSON.stringify(manifest),
    '/skills/ring/SKILL.md': skillFile,
  };

  it('uses the remote skills and private harness when both load', async () => {
    const harness = await loadHarness({
      token: 't',
      fetchImpl: fakeFetch({
        ...skillsRoutes,
        '/harness.json': JSON.stringify({ limits: { maxEmptyCells: 1 } }),
      }),
    });
    expect(harness.skills.map((skill) => skill.id)).toEqual(['ring']);
    expect(harness.limits.maxEmptyCells).toBe(1);
    expect(harness.source).toEqual({ skills: 'remote', harness: 'remote' });
  });

  it('falls back to the bundled defaults when GitHub is down or there is no token', async () => {
    const harness = await loadHarness({ fetchImpl: fakeFetch({ '/skills.json': 500 }) });
    expect(harness).toEqual(DEFAULT_HARNESS);
  });

  it('caches the result', async () => {
    let calls = 0;
    const counting = ((url: string) => {
      calls++;
      return fakeFetch({ '/skills.json': 500 })(url);
    }) as typeof fetch;
    await loadHarness({ fetchImpl: counting, now: 1000 });
    await loadHarness({ fetchImpl: counting, now: 2000 });
    expect(calls).toBe(1);
  });
});
