import { describe, expect, it } from 'vitest';
import { topupAmountCents, topupPricing } from './pricing';

describe('top-up rate selection and whole-pack rounding', () => {
  it.each(['usd', 'eur'] as const)('keeps PAYG unchanged in %s', (currency) => {
    expect(topupAmountCents(2500, topupPricing(null, 'control', currency))).toBe(2500);
    expect(topupAmountCents(2500, topupPricing(null, 'test', currency))).toBe(5000);
  });
  it.each([
    ['creator', 'control', 'usd', 950, 2375],
    ['creator', 'control', 'eur', 900, 2250],
    ['pro', 'control', 'usd', 891, 2227],
    ['pro', 'control', 'eur', 836, 2091],
    ['scale', 'control', 'usd', 828, 2069],
    ['scale', 'control', 'eur', 772, 1931],
    ['creator', 'test', 'usd', 1813, 4531],
    ['creator', 'test', 'eur', 1688, 4219],
    ['pro', 'test', 'usd', 1756, 4389],
    ['pro', 'test', 'eur', 1644, 4111],
    ['scale', 'test', 'usd', 1658, 4146],
    ['scale', 'test', 'eur', 1542, 3854],
  ] as const)('%s %s %s uses its own contract', (plan, variant, currency, small, large) => {
    for (const status of ['active', 'trialing']) {
      const rate = topupPricing({ status, plan, variant }, 'control', currency);
      expect(rate.plan).toBe(plan);
      expect(topupAmountCents(1000, rate)).toBe(small);
      expect(topupAmountCents(2500, rate)).toBe(large);
      expect(topupAmountCents(rate.creditsPerUnit, rate)).toBe(rate.priceCents);
    }
  });
  it.each(['canceled', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid', 'paused', null])(
    '%s gets PAYG even if an old plan is stored',
    (status) => {
      for (const currency of ['usd', 'eur'] as const) {
        const rate = topupPricing({ status, plan: 'pro', variant: 'test' }, 'control', currency);
        expect(rate.plan).toBeNull();
        expect(topupAmountCents(1000, rate)).toBe(1000);
      }
    },
  );
  it('does not accept unknown plans', () => {
    expect(topupPricing({ status: 'active', plan: 'forged', variant: 'control' }).plan).toBeNull();
  });
  it('rounds fractional cents only after multiplying, including half cents and bounds', () => {
    const creator = topupPricing({ status: 'active', plan: 'creator', variant: 'control' });
    expect(topupAmountCents(510, creator)).toBe(485);
    const pro = topupPricing({ status: 'active', plan: 'pro', variant: 'control' });
    expect(topupAmountCents(500, pro)).toBe(445);
    expect(topupAmountCents(100000, pro)).toBe(89091);
  });
});
