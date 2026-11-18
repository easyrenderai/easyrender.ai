import { describe, expect, it } from 'vitest';
import {
  CREDIT_USD,
  currencyForCountry,
  displayPricing,
  isValidPaygCredits,
  PLAN_IDS,
  paygPriceCents,
  pricingFor,
  RENDER_CREDITS,
  rendersFor,
  unitAmountCents,
} from './pricing';

describe('pricing experiment catalogue', () => {
  it('preserves control and the purchasing power of every existing credit', () => {
    expect(RENDER_CREDITS).toBe(32);
    expect(CREDIT_USD).toBe(0.01);
    expect(pricingFor().creditUsd).toBe(0.01);
    expect(paygPriceCents(500)).toBe(500);
    expect(PLAN_IDS.map((id) => pricingFor().plans[id].priceCents)).toEqual([1900, 4900, 14900]);
    expect(PLAN_IDS.map((id) => pricingFor().plans[id].monthlyCredits)).toEqual([
      2000, 5500, 18000,
    ]);
    expect(rendersFor(640)).toBe(20);
  });
  it('charges $0.64 per model and at least $10 for newly bought test credits', () => {
    expect(paygPriceCents(RENDER_CREDITS, 'test')).toBe(64);
    expect(paygPriceCents(pricingFor('test').payg.min, 'test')).toBe(1000);
    expect(isValidPaygCredits(499, 'test')).toBe(false);
    expect(isValidPaygCredits(500, 'test')).toBe(true);
    expect(isValidPaygCredits(100_000, 'test')).toBe(true);
    expect(isValidPaygCredits(100_001, 'test')).toBe(false);
    expect(PLAN_IDS.map((id) => pricingFor('test').plans[id].priceCents)).toEqual([
      2900, 7900, 19900,
    ]);
    expect(PLAN_IDS.map((id) => pricingFor('test').plans[id].monthlyCredits)).toEqual([
      1600, 4500, 12000,
    ]);
    const rates = PLAN_IDS.map((id) => {
      const plan = pricingFor('test').plans[id];
      return (plan.priceCents / 100 / plan.monthlyCredits) * RENDER_CREDITS;
    });
    expect(rates[0]).toBeCloseTo(0.58);
    expect(rates[1]).toBeCloseTo(0.56178);
    expect(rates[2]).toBeCloseTo(0.530665);
  });
});

describe('EUR pricing', () => {
  it('charges euro-area countries in EUR and everyone else in USD', () => {
    for (const country of ['ES', 'de', 'FR', 'IE', 'BG'])
      expect(currencyForCountry(country)).toBe('eur');
    for (const country of ['US', 'GB', 'CH', 'MX', '', null, undefined])
      expect(currencyForCountry(country)).toBe('usd');
  });
  it('keeps the EUR amounts the Stripe prices carry', () => {
    expect(unitAmountCents('payg', 'control', 'eur')).toBe(1);
    expect(unitAmountCents('payg', 'test', 'eur')).toBe(2);
    expect(PLAN_IDS.map((plan) => unitAmountCents(plan, 'control', 'eur'))).toEqual([
      1800, 4600, 13_900,
    ]);
    expect(PLAN_IDS.map((plan) => unitAmountCents(plan, 'test', 'eur'))).toEqual([
      2700, 7400, 18_500,
    ]);
  });
  it('leaves the USD amounts unchanged', () => {
    expect(PLAN_IDS.map((plan) => unitAmountCents(plan, 'control'))).toEqual([1900, 4900, 14_900]);
    expect(PLAN_IDS.map((plan) => unitAmountCents(plan, 'test'))).toEqual([2900, 7900, 19_900]);
    expect(unitAmountCents('payg', 'test')).toBe(2);
  });
  it('shows each visitor the amounts they are charged', () => {
    const eur = displayPricing('test', 'eur');
    expect(eur).toMatchObject({ currency: 'eur', creditPrice: 0.02 });
    expect(PLAN_IDS.map((plan) => eur.plans[plan].priceCents)).toEqual([2700, 7400, 18_500]);
    const usd = displayPricing('control', 'usd');
    expect(usd.creditPrice).toBe(0.01);
    expect(PLAN_IDS.map((plan) => usd.plans[plan].priceCents)).toEqual([1900, 4900, 14_900]);
    expect(usd.plans.pro.monthlyCredits).toBe(5500);
    expect(eur.plans.pro.monthlyCredits).toBe(4500);
  });
});
