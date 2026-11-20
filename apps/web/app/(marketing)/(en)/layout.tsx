import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { IntlBoundary } from '@/components/intl-boundary';
import { SiteChrome } from '@/components/site-chrome';

// The English marketing pages that quote no money: built once, served from the edge cache. English
// has no language segment, so this layout is what names it.
// Rebuilt at most hourly: a guide's publication date passing must show without a deploy.
export const revalidate = 3600;

export default function EnglishMarketingLayout({ children }: { children: ReactNode }) {
  setRequestLocale('en');
  return (
    <IntlBoundary locale="en">
      <SiteChrome locale="en">{children}</SiteChrome>
    </IntlBoundary>
  );
}
