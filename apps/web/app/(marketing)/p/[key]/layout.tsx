import { PRICING_CONTEXT_KEYS } from '@easyrender/core/pricing-context';
import { setPricingContext } from '@/lib/pricing';

// The pages that quote money, built once per pricing key (currency and arm). Nobody requests this
// path: proxy.ts rewrites /pricing to /p/eur.control/pricing for a visitor in the euro area on the
// control arm, and sends a direct request for /p/... back to the public address. A key outside the
// list is a 404, never a page.
export const dynamicParams = false;

// Rebuilt at most hourly: a guide's publication date passing must show without a deploy.
export const revalidate = 3600;

export function generateStaticParams() {
  return PRICING_CONTEXT_KEYS.map((key) => ({ key }));
}

export default async function PricedLayout({ children, params }: LayoutProps<'/p/[key]'>) {
  setPricingContext((await params).key);
  return children;
}
