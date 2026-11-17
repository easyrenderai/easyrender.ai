import { db, type Render } from '@easyrender/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRenderQuality } from './renders';

vi.mock('@easyrender/db', () => ({ db: vi.fn() }));
const findUnique = vi.fn();
const stored = {
  id: 'render',
  userId: 'owner',
  anonId: 'old-anon',
  status: 'ready',
  isPublic: true,
  isLinkShared: true,
  glbKey: 'private/model.glb',
  quality: {
    sheetRecoveryAttempts: 1,
    fidelity: {
      report: { status: 'unavailable', isFlagged: true, warnings: [] },
      reportKey: 'private/report.json',
      htmlKey: 'private/report.html',
      comparisonKey: 'private/image.png',
    },
  },
} as unknown as Render;

beforeEach(() => {
  findUnique.mockReset().mockResolvedValue(stored);
  vi.mocked(db).mockReturnValue({ render: { findUnique } } as unknown as ReturnType<typeof db>);
});

describe('stored owner quality report', () => {
  it('returns the stored results without private artifact keys', async () => {
    expect(await getRenderQuality('render', { userId: 'owner' })).toEqual({
      sheetRecoveryAttempts: 1,
      fidelity: { report: { status: 'unavailable', isFlagged: true, warnings: [] } },
    });
  });
  it.each([{ userId: 'other' }, {}, { anonId: 'old-anon' }])(
    'denies non-owners even for a public or shared model (%j)',
    async (actor) => {
      await expect(getRenderQuality('render', actor)).rejects.toMatchObject({ status: 404 });
    },
  );
  it('allows the anonymous owner before registration', async () => {
    findUnique.mockResolvedValue({ ...stored, userId: null });
    expect(await getRenderQuality('render', { anonId: 'old-anon' })).toMatchObject({
      sheetRecoveryAttempts: 1,
    });
  });
  it('returns an empty report for an older model without stored QA', async () => {
    findUnique.mockResolvedValue({ ...stored, quality: null });
    expect(await getRenderQuality('render', { userId: 'owner' })).toEqual({});
  });
  it('denies a missing model', async () => {
    findUnique.mockResolvedValue(null);
    await expect(getRenderQuality('missing', { userId: 'owner' })).rejects.toMatchObject({
      status: 404,
    });
  });
});
