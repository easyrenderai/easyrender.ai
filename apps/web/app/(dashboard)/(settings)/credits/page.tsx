import {
  checkoutReturnPath,
  confirmedPurchase,
  getBalance,
  getBillingStatus,
} from '@easyrender/core';
import {
  ENTERPRISE_BOOKING_URL,
  type PlanId,
  PUBLIC_PLAN_IDS,
  RENDER_CREDITS,
  rendersFor,
} from '@easyrender/harness';
import { Check, CircleCheck, Clock3, Info } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { BuyButton } from '@/components/buy-button';
import { PaygPicker } from '@/components/payg-picker';
import { PricingExposure } from '@/components/pricing-exposure';
import { PurchaseConversion } from '@/components/purchase-conversion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { intlLocale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { localizedAuthPath } from '@/lib/app-locale';
import { currentTopupPricing, viewerPricing } from '@/lib/pricing';
import { ROUTES } from '@/lib/seo/routes';
import { absoluteUrl } from '@/lib/seo/site';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Where credits and plans are bought. The public, indexed pricing page is /pricing (and
// /es/precios); this one stays out of the index and names that page as its canonical.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Credits');
  return {
    title: t('metaTitle'),
    alternates: { canonical: absoluteUrl(ROUTES.pricing.paths.en) },
    robots: { index: false, follow: true },
  };
}

function PlanCard({
  id,
  title,
  description,
  price,
  note,
  badge,
  featured,
  features,
  footer,
}: {
  id?: string;
  title: string;
  description: string;
  price: string;
  note?: string;
  badge?: string;
  featured?: boolean;
  features: string[];
  footer: ReactNode;
}) {
  return (
    <Card
      id={id}
      className={cn(
        'scroll-mt-24 target:ring-2 target:ring-primary',
        featured && 'border-primary shadow-md',
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {badge && <Badge>{badge}</Badge>}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <p>
          <span className="text-4xl font-semibold tracking-tight">{price}</span>
          {note && <span className="ml-2 text-sm text-muted-foreground">{note}</span>}
        </p>
        <ul className="space-y-2 text-sm">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-muted-foreground" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="block">{footer}</CardFooter>
    </Card>
  );
}

export default async function CreditsPage({ searchParams }: PageProps<'/credits'>) {
  const [pricing, topup] = await Promise.all([viewerPricing(), currentTopupPricing()]);
  const { plans: SUBSCRIPTION_PLANS } = pricing;
  const { status, next, session_id: session } = await searchParams;
  const user = await currentUser();
  const [t, locale] = await Promise.all([getTranslations('Credits'), getLocale()]);
  const number = (value: number, options?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(intlLocale(locale), options).format(value);
  const sessionId =
    user &&
    status === 'success' &&
    typeof session === 'string' &&
    /^cs_[A-Za-z0-9_-]{1,240}$/.test(session)
      ? session
      : null;
  const confirmed =
    user && sessionId ? await confirmedPurchase(user.id, sessionId).catch(() => null) : null;
  const [balance, billing] = user
    ? await Promise.all([getBalance(user.id), getBillingStatus(user.id)])
    : [0, { plan: null, canManage: false }];
  const checkoutNotice = confirmed
    ? t('checkoutConfirmed', { credits: number(confirmed.issued_credits) })
    : status === 'success'
      ? t(sessionId ? 'checkoutPending' : 'checkoutUnconfirmed')
      : status === 'canceled'
        ? t('checkoutCanceled')
        : null;
  const usd = (cents: number) =>
    number(cents / 100, {
      style: 'currency',
      currency: pricing.currency.toUpperCase(),
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    });
  const credits = (value: number) => number(value);
  const back = checkoutReturnPath(next);
  const signUp = (plan: string) => {
    const destination = `/credits?plan=${plan}${back ? `&next=${encodeURIComponent(back)}` : ''}#${plan}`;
    return (
      <Button className="w-full" asChild>
        <Link
          href={`${localizedAuthPath(locale, '/sign-up')}?next=${encodeURIComponent(destination)}`}
        >
          {t('signUpToBuy')}
        </Link>
      </Button>
    );
  };

  const planFooter = (id: PlanId): ReactNode => {
    if (!user) return signUp(id);
    if (!billing.plan) {
      return (
        <BuyButton
          label={t('subscribe', { plan: SUBSCRIPTION_PLANS[id].label })}
          body={{ plan: id, next: back }}
          pricingVariant={pricing.variant}
        />
      );
    }
    // Already subscribed: the billing portal is where a plan is changed or cancelled.
    if (billing.canManage) {
      return (
        <BuyButton
          label={t(billing.plan === id ? 'manageSubscription' : 'changePlan')}
          endpoint="/api/billing/portal"
          variant="outline"
        />
      );
    }
    return (
      <Button className="w-full" variant="outline" disabled>
        {t('onPro', { plan: SUBSCRIPTION_PLANS[billing.plan].label })}
      </Button>
    );
  };

  return (
    <div className="space-y-8">
      {sessionId && (
        <PurchaseConversion key={sessionId} sessionId={sessionId} initial={confirmed} />
      )}
      <PricingExposure
        variant={pricing.variant}
        currency={pricing.currency}
        subject={pricing.subject}
      />
      <div className="space-y-3">
        {/* Signed in, the breadcrumb names the page. The pricing page keeps its heading for visitors and search. */}
        {!user && (
          <>
            <Badge variant="outline">{t('eyebrow')}</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('description', {
                credits: RENDER_CREDITS,
                price: usd(RENDER_CREDITS * pricing.creditPrice * 100),
              })}
            </p>
          </>
        )}
        {user && (
          <p className="text-sm">
            {billing.plan
              ? t('balancePro', {
                  credits: credits(balance),
                  plan: SUBSCRIPTION_PLANS[billing.plan].label,
                })
              : t('balance', { credits: credits(balance) })}
          </p>
        )}
        {billing.plan && billing.canManage && (
          <BuyButton
            label={t('manageSubscription')}
            endpoint="/api/billing/portal"
            variant="outline"
          />
        )}
        {checkoutNotice && (
          <Alert>
            {confirmed ? <CircleCheck /> : sessionId ? <Clock3 /> : <Info />}
            <AlertDescription>{checkoutNotice}</AlertDescription>
          </Alert>
        )}
        {back && (
          <Button variant="outline" size="sm" asChild>
            <Link href={back}>
              {t(back.startsWith('/views') ? 'backToPhotos' : 'backToProject')}
            </Link>
          </Button>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <PlanCard
          id="payg"
          title={t(topup.plan ? 'topUp.title' : 'payg.title')}
          description={t(topup.plan ? 'topUp.description' : 'payg.description', {
            price: usd(pricing.payg.min * pricing.creditPrice * 100),
            plan: topup.plan ? SUBSCRIPTION_PLANS[topup.plan].label : '',
          })}
          price={number(topup.priceCents / topup.creditsPerUnit / 100, {
            style: 'currency',
            currency: topup.currency.toUpperCase(),
            minimumFractionDigits: 2,
            maximumFractionDigits: topup.plan ? 5 : 2,
          })}
          note={t('payg.note')}
          features={[t('payg.features.downloads'), t('payg.features.api'), t('topUp.noExpiry')]}
          footer={
            user ? (
              <PaygPicker
                next={back}
                pricingVariant={pricing.variant}
                currency={topup.currency}
                rate={topup}
              />
            ) : (
              signUp('payg')
            )
          }
        />
        {PUBLIC_PLAN_IDS.map((id) => {
          const plan = SUBSCRIPTION_PLANS[id];
          return (
            <PlanCard
              key={id}
              id={id}
              title={plan.label}
              description={t('pro.description', {
                credits: credits(plan.monthlyCredits),
                count: rendersFor(plan.monthlyCredits),
              })}
              price={usd(plan.priceCents)}
              note={t('pro.note')}
              badge={id === 'pro' ? t('bestValue') : undefined}
              featured={id === 'pro'}
              features={[
                t('pro.features.credits', { credits: credits(plan.monthlyCredits) }),
                t('pro.features.rollover'),
                t('pro.features.topUp'),
                t('pro.features.cancel'),
              ]}
              footer={planFooter(id)}
            />
          );
        })}
        <PlanCard
          title={t('enterprise.title')}
          description={t('enterprise.description')}
          price={t('enterprise.price')}
          features={[
            t('enterprise.features.volume'),
            t('enterprise.features.invoice'),
            t('enterprise.features.support'),
            t('enterprise.features.onboarding'),
          ]}
          footer={
            <Button className="w-full" variant="outline" asChild>
              <a href={ENTERPRISE_BOOKING_URL} target="_blank" rel="noopener noreferrer">
                {t('enterprise.cta')}
              </a>
            </Button>
          }
        />
      </div>
    </div>
  );
}
