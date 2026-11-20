import type { PricingContextKey } from '@easyrender/core/pricing-context';
import type { PricingVariant, topupPricing } from '@easyrender/harness/pricing';
import type { AccountMenuCopy } from '@/components/account-menu';

// What a marketing page cannot know while it is built once for everyone: whether the visitor is
// signed in, their balance, and the pricing arm and subscriber quote that are theirs. The page is
// served from the edge cache; the browser asks /api/viewer for this and fills it in.

export type ViewerResponse = {
  signedIn: boolean;
  /** The header pill and menu, already translated. Null for a visitor or when the balance read failed. */
  account: AccountMenuCopy | null;
  pricing: {
    key: PricingContextKey;
    variant: PricingVariant;
    /** The experiment join key, never an identity. Null outside the experiment. */
    subject: string | null;
  };
  /** A subscriber's top-up rate. Null for everyone else. */
  topup: ReturnType<typeof topupPricing> | null;
};
