import { adminDecision } from '@easyrender/core/admin-analytics/helpers';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { AdminVerification } from '@/components/admin-verification';
import { adminReturnPath } from '@/lib/admin-analytics/navigation';
import { adminSession } from '@/lib/admin-analytics/session';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
    locale?: string | string[];
  }>;
};

export default async function AdminVerificationPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = adminReturnPath(params.next);
  const session = await adminSession(await headers());
  const decision = adminDecision(session?.user ?? null, process.env.ADMIN_EMAILS ?? '', true);
  if (!session || decision === 'signin') redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (decision === 'notFound') notFound();
  if (decision === 'allow') redirect(next);
  const locale = (params.locale ?? (await getLocale())) === 'es' ? 'es' : 'en';
  return (
    <AdminVerification
      email={session.user.email}
      next={next}
      locale={locale}
      isGoogleAvailable={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
      hasOAuthError={Boolean(params.error)}
      copy={(locale === 'es' ? es : en).AuthService.adminAccess}
    />
  );
}
