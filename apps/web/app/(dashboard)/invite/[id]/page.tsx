import {
  creditInviteForUser,
  publicCreditInvite,
  redeemCreditInvite,
  serviceEmailAvailable,
} from '@easyrender/core';
import { isCreditInviteId } from '@easyrender/core/credit-gift-policy';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { EmailVerification } from '@/components/email-verification';
import { SignOutButton } from '@/components/sign-out-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_LOCALE, isRoutableLocale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { localizedAuthPath } from '@/lib/app-locale';
import { authServiceCopy } from '@/lib/auth-service-copy';

export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };

async function redeem(id: string) {
  'use server';
  if (!isCreditInviteId(id)) redirect('/dashboard');
  const user = await currentUser();
  if (user) await redeemCreditInvite(id, user.id);
  redirect(`/invite/${id}`);
}

export default async function CreditInvitePage({ params }: PageProps<'/invite/[id]'>) {
  const [{ id }, user, current, t] = await Promise.all([
    params,
    currentUser(),
    getLocale(),
    getTranslations('CreditInvite'),
  ]);
  const locale = isRoutableLocale(current) ? current : DEFAULT_LOCALE;
  const path = `/invite/${id}`;
  const details = user ? await creditInviteForUser(id, user.id) : await publicCreditInvite(id);
  const state = details && 'state' in details ? details.state : null;
  const wasUsed = state === 'used';
  const title = !details
    ? t('unavailableTitle')
    : t(wasUsed ? 'redeemedTitle' : 'offer', { credits: details.amount });

  return (
    <div className="mx-auto grid w-full max-w-md gap-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {details
              ? t(
                  wasUsed
                    ? 'redeemedDescription'
                    : details.isEmailBound
                      ? 'legacyOfferDescription'
                      : 'offerDescription',
                )
              : t('unavailableDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {details && !user && (
            <>
              <Button asChild>
                <Link
                  href={`${localizedAuthPath(locale, '/sign-up')}?next=${encodeURIComponent(path)}`}
                >
                  {t('signUp')}
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link
                  href={`${localizedAuthPath(locale, '/sign-in')}?next=${encodeURIComponent(path)}`}
                >
                  {t('signIn')}
                </Link>
              </Button>
            </>
          )}
          {state === 'ready' && (
            <form action={redeem.bind(null, id)}>
              <Button type="submit">{t('redeem')}</Button>
            </form>
          )}
          {wasUsed && (
            <Button asChild>
              <Link href="/dashboard">{t('createModel')}</Link>
            </Button>
          )}
          {!details && user && <SignOutButton />}
        </CardContent>
      </Card>
      {user && state === 'unverified' && (
        <EmailVerification
          email={user.email}
          isVerified={false}
          isAvailable={serviceEmailAvailable()}
          copy={authServiceCopy[locale]}
          locale={locale}
          project={path}
        />
      )}
    </div>
  );
}
