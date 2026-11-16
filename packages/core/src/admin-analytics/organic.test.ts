import { describe, expect, it } from 'vitest';
import { organicLandingTable } from './organic';

const date = (day: number) => new Date(`2026-11-${String(day).padStart(2, '0')}T00:00:00Z`);
const users = [
  { id: 'new', createdAt: date(2) },
  { id: 'old', createdAt: date(1) },
  { id: 'paid', createdAt: date(2) },
];
const attribution = users.map((u) => ({
  id: u.id,
  landing_path: '/learn/glb-file',
  referrer: 'https://www.google.com/',
  utm_source: u.id === 'paid' ? 'google' : null,
  utm_medium: u.id === 'paid' ? 'cpc' : null,
}));
const range = { start: date(2).toISOString(), end: date(10).toISOString() };
const render = (id: string, completedAt: Date | null, userId = 'new') => ({
  id,
  userId,
  createdAt: date(3),
  completedAt,
  previewCompletedAt: date(3),
  sheetKey: 'sheet',
  status: 'ready',
  glbKey: 'glb',
});
describe('organic signup cohorts by landing page', () => {
  it('counts the same new organic accounts, distinct successes and actual paid orders', () => {
    const rows = organicLandingTable(
      users,
      attribution,
      [
        render('a', date(4)),
        render('a', date(4)),
        render('b', date(5)),
        render('old', date(4), 'old'),
      ],
      [
        { id: 'p1', userId: 'new', at: date(4).toISOString(), gross: 10 },
        { id: 'p1', userId: 'new', at: date(4).toISOString(), gross: 10 },
        { id: 'p2', userId: 'new', at: date(5).toISOString(), gross: 15 },
        { id: 'p3', userId: 'old', at: date(4).toISOString(), gross: 500 },
      ],
      range,
    ).rows;
    expect(rows).toEqual([
      {
        name: '/learn/glb-file',
        signups: 1,
        previewAccounts: 1,
        firstSuccess: 1,
        secondSuccess: 1,
        cohortPayers: 1,
        repeatPayers: 1,
        legacyAccounts: 0,
      },
    ]);
  });
  it('does not invent completion dates or count outcomes outside the window', () => {
    const rows = organicLandingTable(
      users,
      attribution,
      [render('a', null), render('b', date(11))],
      [{ id: 'free', userId: 'new', at: date(4).toISOString(), gross: 0 }],
      range,
    ).rows;
    expect(rows[0]).toMatchObject({
      firstSuccess: 0,
      secondSuccess: 0,
      legacyAccounts: 1,
      cohortPayers: 0,
    });
  });
});

it('does not treat an undated or later preview as a completed preview in an organic cohort', () => {
  const rows = organicLandingTable(
    users,
    attribution,
    [
      { ...render('legacy', null), previewCompletedAt: null },
      { ...render('future', null), previewCompletedAt: date(11) },
    ],
    [],
    range,
  ).rows;
  expect(rows[0].previewAccounts).toBe(0);
});
