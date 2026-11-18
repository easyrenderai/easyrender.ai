import { ENTERPRISE_BOOKING_URL, RENDER_CREDITS } from '@easyrender/harness';
import {
  ArrowDown,
  ArrowRight,
  Box,
  ChevronDownIcon,
  ClipboardPaste,
  Cloud,
  Code2,
  Copy,
  Download,
  EyeOff,
  ImageUp,
  KeyRound,
  LayoutTemplate,
  Link2,
  type LucideIcon,
  Monitor,
  Smartphone,
  Sparkles,
  Store,
  Upload,
  UserPlus,
} from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import QRCode from 'qrcode';
import type { ReactNode } from 'react';
import { CodeSnippet } from '@/components/code-snippet';
import { PrestaShopMark, ShopifyMark, WooMark } from '@/components/ecommerce/platform-logos';
import { PlatformPicker } from '@/components/ecommerce/platform-picker';
import { Section } from '@/components/landing';
import { SiteLink as Link } from '@/components/site-link';
import { StudioClosing } from '@/components/studio/proof';
import { StudioShell } from '@/components/studio/shell';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { localizedAuthPath } from '@/lib/app-locale';
import { TABLE_EXAMPLE as sample } from '@/lib/marketing-examples';
import { formatCount, formatMoney } from '@/lib/price-format';
import { isPublished, ROUTES } from '@/lib/seo/routes';
import { SITE_URL } from '@/lib/seo/site';

const PLATFORMS = ['shopify', 'woocommerce', 'prestashop', 'tiendanube', 'other'] as const;
type Platform = (typeof PLATFORMS)[number];

const STEPS = ['one', 'two', 'three', 'four'] as const;
// One icon per setup step, in the order of STEPS.
const STEP_ICONS: Record<Platform, readonly LucideIcon[]> = {
  shopify: [Download, Link2, Sparkles, LayoutTemplate],
  woocommerce: [Upload, KeyRound, Sparkles, Box],
  prestashop: [Upload, KeyRound, Sparkles, Box],
  tiendanube: [UserPlus, ImageUp, Copy, ClipboardPaste],
  other: [UserPlus, ImageUp, Copy, Code2],
};
const SHOPPER = [
  { key: 'phone', icon: Smartphone },
  { key: 'desktop', icon: Monitor },
  { key: 'quiet', icon: EyeOff },
] as const;
const FAQ_KEYS = ['photos', 'cost', 'theme', 'devices', 'accuracy', 'remove'] as const;

// The plugins are distributed from the public repository until each store lists them.
const SOURCE = 'https://github.com/easyrenderai/easyrender.ai/tree/main/plugins';
// The size of the store in the admin example; the credits beside it come from the harness.
const EXAMPLE_PRODUCTS = 120;
const CATALOGUE = 100;

export async function ecommerceFaqItems(locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'EcommerceLanding.faq.items' });
  return FAQ_KEYS.map((key) => ({ question: t(`${key}.q`), answer: t(`${key}.a`) }));
}

// The two lines a store on any other platform pastes: the same markup the plugins print.
const snippet = (label: string, caption: string, id: string) =>
  `<a href="${SITE_URL}/ar/${id}" target="_blank" rel="noopener">${label}</a>
<img src="${SITE_URL}/api/renders/${id}/qr" width="140" height="140" alt="${caption}">`;

export async function EcommerceView({ locale }: { locale: Locale }) {
  const arUrl = `${SITE_URL}/ar/${sample.id}`;
  const { currentPricing } = await import('@/lib/pricing');
  const [t, user, items, qr, pricing] = await Promise.all([
    getTranslations({ locale, namespace: 'EcommerceLanding' }),
    currentUser().catch(() => null),
    ecommerceFaqItems(locale),
    QRCode.toDataURL(arUrl, { margin: 1, width: 280, errorCorrectionLevel: 'M' }),
    currentPricing(),
  ]);
  const connectorHref = user
    ? '/connectors'
    : `${localizedAuthPath(locale, '/sign-up')}?next=%2Fconnectors`;
  const previewHref = `${ROUTES.home.paths[locale]}#try`;
  const apiLocale = isPublished('api', locale) ? locale : 'en';
  const money = (value: number) => formatMoney(locale, value, pricing.currency);
  const modelPrice = RENDER_CREDITS * pricing.creditPrice;

  const actions: Record<Platform, { primary: string; secondary: string }> = {
    shopify: { primary: ENTERPRISE_BOOKING_URL, secondary: previewHref },
    woocommerce: {
      primary: `${SOURCE}/woocommerce#install-until-it-is-listed`,
      secondary: connectorHref,
    },
    prestashop: { primary: `${SOURCE}/prestashop#install`, secondary: connectorHref },
    tiendanube: { primary: previewHref, secondary: ENTERPRISE_BOOKING_URL },
    other: { primary: previewHref, secondary: ROUTES.api.paths[apiLocale] },
  };
  const icons: Record<Platform, ReactNode> = {
    shopify: <ShopifyMark className="size-4" />,
    woocommerce: <WooMark className="size-5" />,
    prestashop: <PrestaShopMark className="size-4" />,
    tiendanube: <Cloud aria-hidden="true" className="size-4" />,
    other: <Store aria-hidden="true" className="size-4" />,
  };

  // The product page of the example store. The button and the QR code are real: they open the
  // AR page of an existing public model made from this photo.
  const store = (
    <figure className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-xs text-muted-foreground">
        <span>{t('mock.storeLabel')}</span>
        <span className="truncate font-mono">{t('mock.domain')}</span>
      </div>
      <div className="grid gap-5 bg-[var(--paper)] p-5 text-[var(--ink)] sm:grid-cols-2">
        <Image
          src={sample.photo}
          alt={t('mock.photoAlt')}
          width={1000}
          height={1000}
          sizes="(max-width: 639px) 100vw, 280px"
          quality={85}
          className="aspect-square w-full rounded-lg object-cover"
        />
        <div className="min-w-0 space-y-4">
          <div className="space-y-1">
            <p className="text-xl font-medium leading-tight tracking-tight">
              {t('mock.productName')}
            </p>
            <p className="text-sm opacity-60">{t('mock.productMeta')}</p>
          </div>
          <p
            aria-hidden="true"
            className="rounded-md border border-current/20 px-4 py-2.5 text-center text-sm opacity-60"
          >
            {t('mock.addToCart')}
          </p>
          <div className="space-y-3 rounded-lg border border-dashed border-current/40 p-3">
            <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide opacity-60">
              <Box aria-hidden="true" className="size-3.5" />
              {t('mock.added')}
            </p>
            <a
              href={arUrl}
              target="_blank"
              rel="noopener"
              className="block rounded-md bg-[var(--ink)] px-4 py-2.5 text-center text-sm font-medium text-[var(--paper)] outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2"
            >
              {t('mock.button')}
            </a>
            <div className="flex items-center gap-3">
              <Image
                src={qr}
                alt={t('mock.qrAlt')}
                width={140}
                height={140}
                unoptimized
                className="size-20 shrink-0 rounded border border-current/10 bg-white p-1"
              />
              <p className="text-xs leading-snug opacity-70">{t('mock.qrCaption')}</p>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        {t('mock.live')}
      </figcaption>
    </figure>
  );

  // What the owner clicks: the page of the plugin, or the two lines for a store without one.
  const admin = (platform: Platform) => (
    <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="space-y-1 border-b px-4 py-2.5 text-xs text-muted-foreground">
        <p>{t('mock.adminLabel')}</p>
        <p className="font-mono">{t(`platforms.${platform}.path`)}</p>
      </div>
      {platform === 'other' || platform === 'tiendanube' ? (
        <div className="p-4">
          <CodeSnippet
            code={snippet(t('mock.button'), t('mock.qrCaption'), t('snippet.placeholder'))}
            label={t('snippet.label')}
            copyLabel={t('snippet.copy')}
            copiedLabel={t('snippet.copied')}
            errorLabel={t('snippet.error')}
          />
        </div>
      ) : (
        <div className="p-5">
          <p
            aria-hidden="true"
            className="w-fit max-w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground tabular-nums"
          >
            {t('mock.generate', {
              count: formatCount(locale, EXAMPLE_PRODUCTS),
              credits: formatCount(locale, EXAMPLE_PRODUCTS * RENDER_CREDITS),
            })}
          </p>
        </div>
      )}
    </div>
  );

  const cta = (href: string, label: string, isPrimary: boolean) => (
    <Button
      asChild
      size="lg"
      variant={isPrimary ? 'default' : 'outline'}
      className="h-auto min-h-10 max-w-full py-2 text-center whitespace-normal"
    >
      {href.startsWith('/') ? (
        <Link href={href}>
          {label}
          {isPrimary && <ArrowRight aria-hidden="true" />}
        </Link>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {label}
          {isPrimary && <ArrowRight aria-hidden="true" />}
        </a>
      )}
    </Button>
  );

  const panel = (platform: Platform) => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
          {t(`platforms.${platform}.title`)}
        </h2>
        <div className="flex flex-wrap gap-3">
          {cta(actions[platform].primary, t(`platforms.${platform}.cta`), true)}
          {cta(
            actions[platform].secondary,
            user && (platform === 'woocommerce' || platform === 'prestashop')
              ? t('picker.manageKeys')
              : t(`platforms.${platform}.secondary`),
            false,
          )}
        </div>
      </div>
      <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STEPS.map((step, index) => {
          const Icon = STEP_ICONS[platform][index];
          return (
            <li key={step} className="space-y-4 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <Icon aria-hidden="true" className="size-5" />
                <span className="font-mono text-xs" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="text-sm font-medium leading-snug">
                {t(`platforms.${platform}.steps.${step}`)}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="grid items-center gap-3 lg:grid-cols-[0.8fr_auto_1.2fr]">
        {admin(platform)}
        <ArrowDown
          aria-hidden="true"
          className="mx-auto size-5 text-muted-foreground lg:-rotate-90"
        />
        {store}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t(`platforms.${platform}.note`)}
      </p>
    </div>
  );

  const costs = [
    { key: 'install', value: money(0) },
    { key: 'model', value: money(modelPrice) },
    { key: 'catalogue', value: money(CATALOGUE * modelPrice) },
  ] as const;

  return (
    <StudioShell className="[&>section]:mx-auto [&>section]:max-w-6xl [&>section]:px-6 lg:[&>section]:px-10">
      <PlatformPicker
        label={t('picker.label')}
        hero={
          <div className="space-y-5">
            <p className="eyebrow">{t('hero.eyebrow')}</p>
            <h1 className="text-balance text-4xl font-normal leading-none tracking-tight sm:text-5xl lg:text-6xl">
              {t('hero.title')}
            </h1>
            <p className="mx-auto max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('hero.subtitle')}
            </p>
          </div>
        }
        platforms={PLATFORMS.map((id) => ({
          id,
          name: t(`platforms.${id}.name`),
          icon: icons[id],
        }))}
        panels={{
          shopify: panel('shopify'),
          woocommerce: panel('woocommerce'),
          prestashop: panel('prestashop'),
          tiendanube: panel('tiendanube'),
          other: panel('other'),
        }}
      />

      <Section id="shopper" title={t('shopper.title')}>
        <div className="grid gap-4 md:grid-cols-3">
          {SHOPPER.map(({ key, icon: Icon }) => (
            <div key={key} className="space-y-3 rounded-xl border bg-card p-5">
              <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-lg font-medium">{t(`shopper.${key}.title`)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`shopper.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="cost" title={t('cost.title')}>
        <dl className="grid gap-4 md:grid-cols-3">
          {costs.map(({ key, value }) => (
            <div key={key} className="space-y-2 rounded-xl border bg-card p-5">
              <dd className="text-4xl font-medium tracking-tight tabular-nums">{value}</dd>
              <dt className="text-sm text-muted-foreground">
                {t(`cost.${key}`, {
                  credits: formatCount(locale, RENDER_CREDITS),
                  count: formatCount(locale, CATALOGUE),
                })}
              </dt>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t('cost.note')}</p>
      </Section>

      <Section id="faq" title={t('faq.title')} narrow>
        <div className="sec__column">
          {items.map((item) => (
            <details key={item.question} className="group border-b last:border-b-0">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-md py-5 text-left font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <h3 className="text-base font-medium">{item.question}</h3>
                <ChevronDownIcon
                  className="size-4 shrink-0 translate-y-1 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </Section>
      <StudioClosing title={t('closing.title')} label={t('closing.cta')} href={previewHref} />
    </StudioShell>
  );
}
