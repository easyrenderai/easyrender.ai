import { afterEach, expect, it, vi } from 'vitest';
import {
  currencyForVisitor,
  isPricingContextKey,
  PRICING_CONTEXT_KEYS,
  parsePricingContextKey,
  pricingContextKey,
  visitorPricingContext,
} from './pricing-context';

afterEach(() => vi.unstubAllEnvs());

it('round-trips every key and refuses anything else', () => {
  for (const key of PRICING_CONTEXT_KEYS) {
    const context = parsePricingContextKey(key);
    expect(context).not.toBeNull();
    if (context) expect(pricingContextKey(context)).toBe(key);
  }
  for (const bad of ['', 'gbp.control', 'usd.TEST', 'usd', 'usd.control.x', '__proto__']) {
    expect(isPricingContextKey(bad), bad).toBe(false);
    expect(parsePricingContextKey(bad), bad).toBeNull();
  }
});

it('prices euro-area countries in EUR and everyone else in USD', () => {
  expect(currencyForVisitor('DE')).toBe('eur');
  expect(currencyForVisitor('fr')).toBe('eur');
  expect(currencyForVisitor('US')).toBe('usd');
  expect(currencyForVisitor(null)).toBe('usd');
  vi.stubEnv('EUR_CHECKOUT_DISABLED', '1');
  expect(currencyForVisitor('DE')).toBe('usd');
});

it('puts a visitor on control without the experiment, whatever the id', async () => {
  expect(await visitorPricingContext({ country: 'ES', anonId: 'a1' })).toBe('eur.control');
  expect(await visitorPricingContext({ country: 'GB', anonId: null })).toBe('usd.control');
});

it('lets a remembered key win over the country, and ignores a malformed one', async () => {
  expect(await visitorPricingContext({ country: 'US', anonId: null, remembered: 'eur.test' })).toBe(
    'eur.test',
  );
  expect(await visitorPricingContext({ country: 'US', anonId: null, remembered: 'nope' })).toBe(
    'usd.control',
  );
});
