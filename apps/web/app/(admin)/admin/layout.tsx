import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppFrame } from '@/components/app-shell/app-frame';
import { requireAdmin } from '@/lib/admin-analytics/auth';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  icons: {
    icon: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22%3E%3Cpath d=%22M12 3 3 8v8l9 5 9-5V8Z M3 8l9 5 9-5 M12 13v8%22/%3E%3C/svg%3E',
  },
};
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  // The same shell as the signed-in app: one frame, never the marketing header. The guard above
  // has already sent anyone who is not a verified admin away, so a user is always present here.
  return <AppFrame>{children}</AppFrame>;
}
