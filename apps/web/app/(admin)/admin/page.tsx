import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-analytics/auth';

export const dynamic = 'force-dynamic';

// /admin has no page of its own: analytics is the front door. The guard runs first, so a visitor
// who is not an admin still gets the 404 and never learns where the redirect would go.
export default async function AdminIndexPage() {
  await requireAdmin();
  redirect('/admin/analytics');
}
