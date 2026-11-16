import { getBalance, getBillingStatus, serviceEmailAvailable } from '@easyrender/core';
import { SUBSCRIPTION_PLANS } from '@easyrender/harness';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { BuyButton } from '@/components/buy-button';
import { EmailVerification } from '@/components/email-verification';
import { MailingPreferences } from '@/components/mailing-preferences';
import { SignOutButton } from '@/components/sign-out-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { currentUser } from '@/lib/actor';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Account');
  return { title: t('metaTitle') };
}

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/account');
  const locale = (await getLocale()) === 'es' ? 'es' : 'en';
  const [balance, billing, t, format] = await Promise.all([
    getBalance(user.id),
    getBillingStatus(user.id),
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
        copy={(locale === 'es' ? es : en).AuthService}
        locale={locale}
      />
      <MailingPreferences userId={user.id} />
    </div>
  );
}
