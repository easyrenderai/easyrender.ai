import type { ReactNode } from 'react';
import { SettingsPanel } from '@/components/app-shell/settings-panel';
import { currentUser } from '@/lib/actor';

// Everything behind the profile: Account, Credits and Connectors. Signed in, their list is in the
// left drawer, and the same list sits at the top of the page on phones, where the drawers are
// hidden. A visitor can still open Credits, inside the marketing frame, and gets no settings list
// because there are no other settings to reach.
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <>
      {user && (
        <div className="mb-6 overflow-hidden rounded-lg border md:hidden">
          <SettingsPanel />
        </div>
      )}
      {children}
    </>
  );
}
