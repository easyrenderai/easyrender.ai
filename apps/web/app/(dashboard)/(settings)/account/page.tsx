import {
  getBalance,
  getBillingStatus,
  referralSummary,
  serviceEmailAvailable,
} from '@easyrender/core';
import {
  REFERRAL_MAX_REWARDS,
  REFERRAL_REFERRED_CREDITS,
  REFERRAL_REFERRER_CREDITS,
  SUBSCRIPTION_PLANS,
} from '@easyrender/harness';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { BuyButton } from '@/components/buy-button';
import { EmailVerification } from '@/components/email-verification';
import { MailingPreferences } from '@/components/mailing-preferences';
import { ReferralLink } from '@/components/referral-card';
import { SignOutButton } from '@/components/sign-out-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_LOCALE, isRoutableLocale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { authProjectPath, localizedSignInPath } from '@/lib/app-locale';
import { authServiceCopy } from '@/lib/auth-service-copy';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Account');
  return { title: t('metaTitle') };
}

export default async function AccountPage({ searchParams }: PageProps<'/account'>) {
  const user = await currentUser();
  const current = await getLocale();
  const locale = isRoutableLocale(current) ? current : DEFAULT_LOCALE;
  const project = authProjectPath((await searchParams).next);
  if (!user) redirect(localizedSignInPath(locale, project ?? '/account'));
  if (project) redirect(`${project}?locale=${locale}`);
  const [balance, billing, referral, t, format] = await Promise.all([
    getBalance(user.id),
    getBillingStatus(user.id),
    referralSummary(user.id),
    getTranslations('Account'),
    getFormatter(),
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{user.name || t('yourAccount')}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {t.rich('balance', {
              credits: format.number(balance),
              strong: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
            {billing.plan && ` · ${SUBSCRIPTION_PLANS[billing.plan].label}`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/credits">{t('buyCredits')}</Link>
            </Button>
            {billing.canManage && (
              <div>
                <BuyButton label={t('billing')} endpoint="/api/billing/portal" variant="outline" />
              </div>
            )}
            <SignOutButton />
          </div>
        </CardContent>
      </Card>
      <EmailVerification
        email={user.email}
        isVerified={user.emailVerified}
        isAvailable={serviceEmailAvailable()}
        copy={authServiceCopy[locale]}
        locale={locale}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('referral.title')}</CardTitle>
          <CardDescription>
            {t('referral.description', {
              reward: format.number(REFERRAL_REFERRER_CREDITS),
              welcome: format.number(REFERRAL_REFERRED_CREDITS),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {referral.link ? (
            <>
              <ReferralLink
                link={referral.link}
                label={t('referral.linkLabel')}
                copyLabel={t('referral.copy')}
                copiedLabel={t('referral.copied')}
                errorLabel={t('referral.copyError')}
              />
              <p className="text-sm text-muted-foreground tabular-nums">
                {t('referral.stats', {
                  rewarded: referral.rewarded,
                  pending: referral.pending,
                  credits: format.number(referral.creditsEarned),
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('referral.limit', { max: REFERRAL_MAX_REWARDS })}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('referral.verifyFirst')}</p>
          )}
        </CardContent>
      </Card>
      <MailingPreferences userId={user.id} />
    </div>
  );
}
