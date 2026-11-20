import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppFrame } from '@/components/app-shell/app-frame';
import { IntlBoundary } from '@/components/intl-boundary';

// The app itself is noindex, /credits included: the public pricing page is /pricing.
export const metadata: Metadata = { robots: { index: false, follow: true } };

// The signed-in web app: its own shell, no marketing header. Credits is reachable without an account too, so a visitor
// who is not signed in gets that page inside the marketing frame instead.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <IntlBoundary>
      <AppFrame publicInset>{children}</AppFrame>
    </IntlBoundary>
  );
}
