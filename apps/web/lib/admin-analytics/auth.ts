import 'server-only';
import { adminDecision } from '@easyrender/core/admin-analytics/helpers';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { adminVerificationPath } from './navigation';
import { adminSession } from './session';

export async function requireAdmin() {
  const h = await headers();
  const session = await adminSession(h);
  // Email/password sign-up does not verify addresses, so anyone could register an allowlisted
  // address that has no account yet. Only verified emails get in; recovery does not grant admin access.
  const decision = adminDecision(session?.user ?? null, process.env.ADMIN_EMAILS ?? '', true);
  if (decision === 'signin') {
    const path = h.get('x-admin-return') ?? '/admin/analytics';
    redirect(
      `/sign-in?next=${encodeURIComponent(path.startsWith('/admin/') ? path : '/admin/analytics')}`,
    );
  }
  if (decision === 'verify') redirect(adminVerificationPath(h.get('x-admin-return')));
  if (decision !== 'allow') notFound();
  return session?.user;
}
