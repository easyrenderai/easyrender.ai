import type { ReactNode } from 'react';
import { SettingsNav } from '@/components/app-shell/settings-nav';
import { currentUser } from '@/lib/actor';

// Everything behind the profile: Account, Credits and Connectors. Signed in, their list is in the
// left drawer, and a row of links on phones, where the drawers are hidden. A visitor can still open
// Credits, inside the marketing frame, and gets no settings list because there are no other
// settings to reach.
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <>
      {user && (
        <div className="md:hidden">
          <SettingsNav />
        </div>
      )}
      {children}
    </>
  );
}
