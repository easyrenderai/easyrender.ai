import { displayPricing, RENDER_CREDITS } from '@easyrender/harness/pricing';
import { expect, it } from 'vitest';
import { catalogEstimate } from './catalog-estimate';

it('separates one model consumption from the minimum credit purchase', () => {
  const pricing = displayPricing('control', 'eur');
  expect(catalogEstimate(1, pricing)).toEqual({
    usedCredits: RENDER_CREDITS,
    purchasedCredits: pricing.payg.min,
    consumption: RENDER_CREDITS * pricing.creditPrice,
    purchase: pricing.payg.min * pricing.creditPrice,
    remainingCredits: pricing.payg.min - RENDER_CREDITS,
  });
});
it('uses the visitor price variant for a catalog above the minimum', () => {
  const pricing = displayPricing('test', 'usd');
  const result = catalogEstimate(100, pricing);
  expect(result?.purchase).toBe(100 * RENDER_CREDITS * pricing.creditPrice);
  expect(result?.remainingCredits).toBe(0);
});
it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 100000])(
  'rejects unsupported counts (%s)',
  (count) => {
    expect(catalogEstimate(count, displayPricing())).toBeNull();
  },
);
