import type { ReactNode } from 'react';
import { AppFrame } from '@/components/app-shell/app-frame';
import { IntlBoundary } from '@/components/intl-boundary';

// A render's page lives at /r/{id} for everyone. Its owner sees it inside the app shell, next to
// the Library it came from; a visitor with a shared link, or a showcase example, sees it in the
// marketing frame. The path is the same either way.
export default function RenderLayout({ children }: { children: ReactNode }) {
  return (
    <IntlBoundary>
      <AppFrame>{children}</AppFrame>
    </IntlBoundary>
  );
}
