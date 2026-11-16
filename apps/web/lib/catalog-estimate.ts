import { type displayPricing, RENDER_CREDITS } from '@easyrender/harness/pricing';

export function catalogEstimate(count: number, pricing: ReturnType<typeof displayPricing>) {
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > Math.floor(pricing.payg.max / RENDER_CREDITS)
  )
    return null;
  const usedCredits = count * RENDER_CREDITS;
  const purchasedCredits = Math.max(pricing.payg.min, usedCredits);
  return {
    usedCredits,
    purchasedCredits,
    consumption: usedCredits * pricing.creditPrice,
    purchase: purchasedCredits * pricing.creditPrice,
    remainingCredits: purchasedCredits - usedCredits,
  };
}
