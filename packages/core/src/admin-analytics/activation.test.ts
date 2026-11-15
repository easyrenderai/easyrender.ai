import { describe, expect, it } from 'vitest';
import { type ActivationRender, activationTables } from './activation';
import { periodRange } from './helpers';

const range = periodRange(
  { period: 'custom', from: '2026-11-01', to: '2026-11-07' },
  new Date('2026-11-08T12:00:00Z'),
  undefined,
  'UTC',
);
const row = (id: string, fields: Partial<ActivationRender> = {}): ActivationRender => ({
  id,
  userId: 'user-a',
  source: 'api',
  status: 'ready',
  glbKey: 'model',
  createdAt: new Date('2026-11-01T01:00:00Z'),
  completedAt: new Date('2026-11-01T01:10:00Z'),
  ...fields,
});
const summary = (rows: ActivationRender[], source = 'api') =>
  activationTables(rows, range)[0].rows.find((r) => r.source === source);

describe('developer 3D activation cohorts', () => {
  it('counts distinct first and second models by creation channel, regardless of authentication type', () => {
    const rows = [
      row('a'),
      row('b', { completedAt: new Date('2026-11-01T01:30:00Z') }),
      row('mcp', { source: 'mcp' }),
      row('anon', { userId: null, source: 'web' }),
    ];
    expect(summary(rows)).toMatchObject({
      activationAccounts: 1,
      measuredAccounts: 1,
      firstSuccess: 1,
      secondSuccess: 1,
      activationPercent: 100,
      repeatPercent: 100,
      firstSuccessMinutes: 10,
      repeatMinutes: 20,
    });
    expect(summary(rows, 'mcp')).toMatchObject({
      activationAccounts: 1,
      firstSuccess: 1,
      secondSuccess: 0,
    });
    expect(summary(rows, 'web')).toMatchObject({ activationAccounts: 0, activationPercent: null });
  });
  it('uses the first request cohort and the observation cutoff, not a recent request or later completion', () => {
    const rows = [
      row('old', {
        userId: 'old',
        createdAt: new Date('2026-10-01'),
        completedAt: new Date('2026-10-01T01:00Z'),
      }),
      row('recent-old', { userId: 'old' }),
      row('later', { completedAt: new Date('2026-12-01') }),
    ];
    expect(summary(rows)).toMatchObject({
      activationAccounts: 1,
      measuredAccounts: 1,
      firstSuccess: 0,
      secondSuccess: 0,
      activationPercent: 0,
    });
  });
  it('keeps undated historical successes out of measured rates rather than inventing a completion time', () => {
    expect(summary([row('legacy', { completedAt: null }), row('known')])).toMatchObject({
      activationAccounts: 1,
      measuredAccounts: 0,
      legacyAccounts: 1,
      firstSuccess: 0,
      secondSuccess: 0,
      activationPercent: null,
    });
  });
  it('keeps a successful use in its original cohort after a later retry or file change', () => {
    expect(
      summary([
        row('previous-success', { status: 'rendering', glbKey: null }),
        row('second-success', {
          status: 'failed',
          glbKey: null,
          completedAt: new Date('2026-11-02T01:10Z'),
        }),
      ]),
    ).toMatchObject({ firstSuccess: 1, secondSuccess: 1, legacyAccounts: 0 });
  });
  it('does not treat previews, failed work, duplicate rows or absent files as a successful use', () => {
    const successful = row('a');
    const rows = [
      successful,
      successful,
      row('failed', { status: 'failed', completedAt: null }),
      row('no-file', { glbKey: null, completedAt: null }),
      row('preview', { status: 'preview_ready', completedAt: null, glbKey: null }),
    ];
    expect(summary(rows)).toMatchObject({ firstSuccess: 1, secondSuccess: 0 });
    expect(activationTables(rows, range)[1].rows).toHaveLength(1);
  });
});
