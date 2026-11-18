import { describe, expect, it } from 'vitest';
import {
  AI_HOSTS,
  adminDecision,
  bucket,
  channel,
  cohorts,
  csv,
  delta,
  formatNumber,
  funnel,
  isExcluded,
  kpiFormulas,
  midnight,
  parseEmails,
  periodRange,
} from './helpers';

describe('admin access and exclusions', () => {
  it('denies by default and normalizes only exact allowlisted emails', () => {
    expect(parseEmails(' A@EXAMPLE.COM, , a@example.com,b@example.com ')).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
    expect(adminDecision(null, '')).toBe('signin');
    expect(adminDecision({ email: 'A@example.com' }, ' a@EXAMPLE.com ')).toBe('allow');
    expect(adminDecision({ email: 'a@example.com' }, '')).toBe('notFound');
    expect(adminDecision({ email: 'x@a@example.com' }, 'a@example.com')).toBe('notFound');
    expect(
      adminDecision({ email: 'a@example.com', emailVerified: false }, 'a@example.com', true),
    ).toBe('verify');
  });
  it('excludes exact email and domain without matching lookalikes', () => {
    expect(isExcluded('A@TEAM.TEST', ['@team.test'])).toBe(true);
    expect(isExcluded('a@otherteam.test', ['@team.test'])).toBe(false);
    expect(isExcluded('a@sub.team.test', ['@team.test'])).toBe(false);
    expect(isExcluded('X@test', ['x@test'])).toBe(true);
  });
});
describe('periods and Madrid calendar', () => {
  it('uses equal previous duration and validates inputs', () => {
    const r = periodRange({ period: '7d' }, new Date('2026-11-11T12:00:00Z'));
    expect(r.start).toBe('2026-11-04T12:00:00.000Z');
    expect(r.previousStart).toBe('2026-10-28T12:00:00.000Z');
    expect(periodRange({ period: 'sql' }, new Date('2026-11-11T12:00:00Z')).period).toBe('30d');
  });
  it('handles 23 and 25 hour local days', () => {
    expect(
      +midnight('2026-03-30', 'Europe/Madrid') - +midnight('2026-03-29', 'Europe/Madrid'),
    ).toBe(23 * 3600000);
    expect(
      +midnight('2026-10-26', 'Europe/Madrid') - +midnight('2026-10-25', 'Europe/Madrid'),
    ).toBe(25 * 3600000);
    expect(bucket('2026-03-29T22:30:00Z', 'day', 'Europe/Madrid')).toBe('2026-03-30');
    expect(bucket('2026-03-29T22:30:00Z', 'week', 'Europe/Madrid')).toBe('2026-03-30');
  });
  it('custom dates include the end day in local time', () => {
    const r = periodRange(
      { period: 'custom', from: '2026-03-29', to: '2026-03-29' },
      new Date('2026-11-11T12:00:00Z'),
    );
    expect(r.start).toBe('2026-03-28T23:00:00.000Z');
    expect(r.end).toBe('2026-03-29T22:00:00.000Z');
    expect(periodRange({ period: 'custom', from: '2026-02-30', to: '2026-03-05' }).period).toBe(
      '30d',
    );
  });
});
describe('channels from tracking closed lists', () => {
  it('treats PostHog direct sentinels as direct, without overriding paid campaigns', () => {
    expect(channel({ referrer: '$direct' })).toBe('direct');
    expect(channel({ referrer: ' $direct ' })).toBe('direct');
    expect(channel({ referrer: '$direct', utm_source: 'google', utm_medium: 'cpc' })).toBe(
      'paidSearch',
    );
  });
  it('does not label account login as organic search', () => {
    expect(channel({ referrer: 'https://accounts.google.com/o/oauth2' })).toBe('referral');
    expect(
      channel({ referrer: 'https://accounts.google.com', utm_source: 'google', utm_medium: 'cpc' }),
    ).toBe('paidSearch');
    expect(channel({ referrer: 'https://www.google.es/search' })).toBe('organicSearch');
  });
  it.each(AI_HOSTS)('recognizes AI host %s', (host) =>
    expect(channel({ referrer: `https://${host}/chat` })).toBe('ai'),
  );
  it('recognizes ChatGPT UTM and separates paid and organic search', () => {
    expect(channel({ utm_source: 'chatgpt.com' })).toBe('ai');
    expect(
      channel({ utm_source: 'google', utm_medium: 'cpc', referrer: 'https://google.com' }),
    ).toBe('paidSearch');
    expect(channel({ referrer: 'https://www.google.es/search' })).toBe('organicSearch');
    expect(channel({ referrer: 'https://notgoogle.com' })).toBe('referral');
    expect(channel({})).toBe('direct');
  });
  it.each([
    ['galeria-compartida', 'sharedGallery'],
    ['directo', 'outreach'],
    ['social', 'organicSocial'],
    ['directorio', 'directories'],
    ['asistente-ia', 'ai'],
    ['comunidad', 'communities'],
    ['email', 'email'],
    ['referido', 'referrals'],
    ['sector', 'industry'],
    ['video-ia', 'aiVideo'],
  ])('maps medium %s', (utm_medium, expected) =>
    expect(channel({ utm_medium, utm_source: 'instagram' })).toBe(expected),
  );
  it.each([
    ['dir-mcp-registry', 'directories'],
    ['ref-03', 'referrals'],
    ['sec-fair', 'industry'],
    ['foro-homestaging', 'communities'],
    ['shopify-community', 'communities'],
    ['producthunt', 'communities'],
  ])('maps source %s', (utm_source, expected) => expect(channel({ utm_source })).toBe(expected));
  it.each([
    'google.com',
    'bing.com',
    'duckduckgo.com',
    'yahoo.com',
    'ecosia.org',
    'search.brave.com',
    'yandex.ru',
    'baidu.com',
  ])('recognizes search %s', (referrer) => expect(channel({ referrer })).toBe('organicSearch'));
});
describe('formulas and exports', () => {
  it('preserves unknowns and handles zero denominators', () => {
    expect(kpiFormulas(100, 20, 10, 4, 20)).toEqual({ net: 80, arpu: 8, arppu: 20, margin: 0.75 });
    expect(kpiFormulas(0, 0, 0, 0, 1).arpu).toBeNull();
    expect(delta(10, 0).percent).toBeNull();
    expect(delta(5, 10, true)).toMatchObject({ percent: -0.5, isGood: true, direction: 'down' });
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(12, 'currency', 'EUR')).toContain('EUR');
    expect(formatNumber(0.25, 'percent')).toBe('25%');
  });
  it('quotes separators newlines and spreadsheet formulas', () => {
    expect(csv(['a'], [{ a: 'x,"y"\nz' }, { a: '=cmd()' }])).toBe(
      '"a"\r\n"x,""y""\nz"\r\n"\'=cmd()"',
    );
  });
  it('builds cohort funnel dropoffs without turning unavailable visits into zero', () => {
    expect(
      funnel([
        { step: 'visit', count: null },
        { step: 'signup', count: 10 },
        { step: 'sheet', count: 5 },
      ]),
    ).toEqual([
      { step: 'visit', count: null, conversion: null, dropoff: null },
      { step: 'signup', count: 10, conversion: null, dropoff: null },
      { step: 'sheet', count: 5, conversion: 0.5, dropoff: 0.5 },
    ]);
  });
  it('cohorts blank immature weeks and count cumulative conversions', () => {
    const rows = cohorts(
      [
        {
          signup: '2026-10-05T10:00:00Z',
          sheet: '2026-10-06T10:00:00Z',
          model: '2026-10-13T10:00:00Z',
          purchase: null,
          revenue: 19,
        },
      ],
      '2026-10-20T00:00:00Z',
      'Europe/Madrid',
    );
    expect(rows.find((r) => r.step === 'sheet')).toMatchObject({ w0: 1, w1: 1, w2: null });
    expect(rows.find((r) => r.step === 'model')).toMatchObject({ w0: 0, w1: 1, w2: null });
  });
});

it('accepts a custom range ending today and rejects rolled calendar dates', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  expect(
    periodRange({ period: 'custom', from: '2026-11-01', to: '2026-11-11' }, now),
  ).toMatchObject({ period: 'custom', end: '2026-11-11T12:00:00.000Z' });
  expect(periodRange({ period: 'custom', from: '2026-02-01', to: '2026-02-30' }, now).period).toBe(
    '30d',
  );
});
