import type { ReactNode } from 'react';
import { IntlBoundary } from '@/components/intl-boundary';
import { SiteChrome } from '@/components/site-chrome';

// The pages inside the marketing frame that belong to a person or a request: the consent screen,
// the Shopify app, the hub, the explorer, a shared AR view. They read the session or the query, so
// they are rendered per request, in the language the app remembers for the visitor.
export default function AccountMarketingLayout({ children }: { children: ReactNode }) {
  return (
    <IntlBoundary>
      <SiteChrome>{children}</SiteChrome>
    </IntlBoundary>
  );
}
