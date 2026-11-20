import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IntlBoundary } from '@/components/intl-boundary';
import { SiteChrome } from '@/components/site-chrome';
import { StudioLens } from '@/components/studio/lens';
import { StudioShell } from '@/components/studio/shell';

// Sign in and sign up: noindex, follow. Inherited by every page in the group.
export const metadata: Metadata = { robots: { index: false, follow: true } };

// Sign in and sign up: the form on one side, the engine's readings of a model on the other.
// The stage lives in the layout, so it keeps running when the visitor switches between the two.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <IntlBoundary>
      <SiteChrome>
        <StudioShell>
          <div className="auth">
            <div className="auth__form">{children}</div>
            <StudioLens />
          </div>
        </StudioShell>
      </SiteChrome>
    </IntlBoundary>
  );
}
