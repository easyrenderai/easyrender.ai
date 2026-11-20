import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { IntlBoundary } from '@/components/intl-boundary';
import { SiteChrome } from '@/components/site-chrome';

export default function EnglishPricedLayout({ children }: { children: ReactNode }) {
  setRequestLocale('en');
  return (
    <IntlBoundary locale="en">
      <SiteChrome locale="en">{children}</SiteChrome>
    </IntlBoundary>
  );
}
