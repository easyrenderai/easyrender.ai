import type { ReactNode } from 'react';
import { SettingsNav } from '@/components/app-shell/settings-nav';
import { currentUser } from '@/lib/actor';

// Everything behind the profile: Account, Credits and Connectors. Signed in, they are full pages
// with a row of links between them. A visitor can still open Credits, inside the marketing frame,
// and gets no settings row because there are no other settings to reach.
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <>
      {user && <SettingsNav />}
      {children}
    </>
  );
}
