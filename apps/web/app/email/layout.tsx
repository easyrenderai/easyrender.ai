import type { ReactNode } from 'react';
import { IntlBoundary } from '@/components/intl-boundary';

// The language of the visitor's request, for the translations and <html lang>: the root layout
// above every route cannot read it.
export default function Layout({ children }: { children: ReactNode }) {
  return <IntlBoundary>{children}</IntlBoundary>;
}
