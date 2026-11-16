import { getDashboardStats, listRenders } from '@easyrender/core';
import type { ReactNode } from 'react';
import { SiteChrome } from '@/components/site-chrome';
import { currentUser } from '@/lib/actor';
import { AppShell } from './app-shell';
import type { ShellData } from './types';

const LATEST = 12;

// The frame for pages a signed-in person uses inside the app: the app shell. A visitor who is not
// signed in gets the page inside the marketing frame instead, so public links (pricing, a shared
// render) keep working. `publicInset` wraps the page for that frame when it has no layout of its own.
export async function AppFrame({
  children,
  publicInset = false,
}: {
  children: ReactNode;
  publicInset?: boolean;
}) {
  const user = await currentUser().catch(() => null);
  if (!user) {
    return (
      <SiteChrome>
        {publicInset ? (
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">{children}</div>
        ) : (
          children
        )}
      </SiteChrome>
    );
  }
  // Each read falls back on its own, so one slow or failing query never blanks the whole shell.
  const [stats, renders] = await Promise.all([
    getDashboardStats(user.id).catch(() => ({ total: 0, ready: 0, inFlight: 0, byAgent: 0 })),
    listRenders(user.id, LATEST).catch(() => []),
  ]);
  const data: ShellData = {
    email: user.email,
    name: user.name ?? '',
    stats,
    renders: renders.map((render) => ({
      id: render.id,
      name: render.name,
      prompt: render.prompt,
      status: render.status,
      createdAt: render.createdAt.toISOString(),
    })),
    now: Date.now(),
  };
  return <AppShell data={data}>{children}</AppShell>;
}
