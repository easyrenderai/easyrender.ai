import { ENTERPRISE_BOOKING_URL, RENDER_CREDITS } from '@easyrender/harness';
import { ArrowRight, Box, ChevronDownIcon, EyeOff, Monitor, Smartphone } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import QRCode from 'qrcode';
import { CodeSnippet } from '@/components/code-snippet';
import { PlatformPicker } from '@/components/ecommerce/platform-picker';
import { IntegrationCosts } from '@/components/integrations/costs';
import { Section } from '@/components/landing';
import { SiteLink as Link } from '@/components/site-link';
import { StudioClosing } from '@/components/studio/proof';
import { StudioShell } from '@/components/studio/shell';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { TABLE_EXAMPLE as sample } from '@/lib/marketing-examples';
import { formatCount } from '@/lib/price-format';
import { isPublished, ROUTES } from '@/lib/seo/routes';
import { SITE_URL } from '@/lib/seo/site';

const PLATFORMS = ['shopify', 'woocommerce', 'prestashop', 'other'] as const;
type Platform = (typeof PLATFORMS)[number];

const STEPS = ['one', 'two', 'three', 'four'] as const;
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
  const [t, user, items, qr] = await Promise.all([
    getTranslations({ locale, namespace: 'EcommerceLanding' }),
    currentUser().catch(() => null),
    ecommerceFaqItems(locale),
    QRCode.toDataURL(arUrl, { margin: 1, width: 280, errorCorrectionLevel: 'M' }),
  ]);
  const accountHref = user ? '/connectors' : '/sign-up?next=%2Fconnectors';
  const apiLocale = isPublished('api', locale) ? locale : 'en';

  const actions: Record<Platform, { primary: string; secondary: string }> = {
    shopify: { primary: ENTERPRISE_BOOKING_URL, secondary: accountHref },
    woocommerce: { primary: accountHref, secondary: `${SOURCE}/woocommerce` },
    prestashop: { primary: accountHref, secondary: `${SOURCE}/prestashop` },
    other: { primary: accountHref, secondary: ROUTES.api.paths[apiLocale] },
  };

  // The product page of the example store. The button and the QR code are real: they open the
  // AR page of an existing public model made from this photo.
  const store = (platform: Platform) => (
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
      <figcaption className="space-y-1.5 border-t p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="text-foreground">{t(`platforms.${platform}.placement`)}</p>
        <p>{t('mock.live')}</p>
      </figcaption>
    </figure>
  );

  // What the owner clicks: the page of the plugin, or the two lines for a store without one.
  const admin = (platform: Platform) => (
    <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-4 py-2.5 text-xs text-muted-foreground">
        <span>{t('mock.adminLabel')}</span>
        <span className="font-mono">{t(`platforms.${platform}.path`)}</span>
      </div>
      {platform === 'other' ? (
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
        <div className="space-y-3 p-5">
          <p
            aria-hidden="true"
            className="w-fit max-w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground tabular-nums"
          >
            {t('mock.generate', {
              count: formatCount(locale, EXAMPLE_PRODUCTS),
              credits: formatCount(locale, EXAMPLE_PRODUCTS * RENDER_CREDITS),
            })}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('mock.generateNote', { count: formatCount(locale, EXAMPLE_PRODUCTS) })}
          </p>
        </div>
      )}
    </div>
  );

  const cta = (href: string, label: string, isPrimary: boolean) => (
    <Button asChild size="lg" variant={isPrimary ? 'default' : 'outline'}>
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
    <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
      <div className="min-w-0 space-y-8">
        <div className="space-y-2">
          <p className="eyebrow">{t('stepsLabel')}</p>
          <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
            {t(`platforms.${platform}.title`)}
          </h2>
        </div>
        <ol className="space-y-6">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-5">
              <span className="pt-1 font-mono text-xs text-muted-foreground" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="space-y-1.5">
                <h3 className="text-lg font-medium">
                  {t(`platforms.${platform}.steps.${step}.title`)}
                </h3>
                <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                  {t(`platforms.${platform}.steps.${step}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3">
          {cta(actions[platform].primary, t(`platforms.${platform}.cta`), true)}
          {cta(actions[platform].secondary, t(`platforms.${platform}.secondary`), false)}
        </div>
        <dl className="grid gap-4 border-t pt-6 text-sm sm:grid-cols-2">
          {(['availability', 'requirements'] as const).map((key) => (
            <div key={key} className="space-y-1">
              <dt className="text-muted-foreground">{t(`${key}Label`)}</dt>
              <dd className="leading-relaxed">{t(`platforms.${platform}.${key}`)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="min-w-0 space-y-4">
        {admin(platform)}
        {store(platform)}
      </div>
    </div>
  );

  return (
    <StudioShell>
      <section className="sec" aria-labelledby="ecommerce-title">
        <div className="mx-auto max-w-3xl space-y-5 pb-10 text-center sm:pb-12">
          <p className="eyebrow">{t('hero.eyebrow')}</p>
          <h1
            id="ecommerce-title"
            className="text-balance text-4xl font-normal leading-none tracking-tight sm:text-5xl lg:text-6xl"
          >
            {t('hero.title')}
          </h1>
          <p className="mx-auto max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('hero.subtitle')}
          </p>
        </div>
        <PlatformPicker
          label={t('picker.label')}
          platforms={PLATFORMS.map((id) => ({ id, name: t(`platforms.${id}.name`) }))}
          panels={{
            shopify: panel('shopify'),
            woocommerce: panel('woocommerce'),
            prestashop: panel('prestashop'),
            other: panel('other'),
          }}
        />
      </section>

      <Section id="shopper" title={t('shopper.title')} description={t('shopper.description')}>
        <div className="grid gap-8 md:grid-cols-3">
          {SHOPPER.map(({ key, icon: Icon }) => (
            <div key={key} className="space-y-3 border-t pt-6">
              <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-xl font-medium">{t(`shopper.${key}.title`)}</h3>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                {t(`shopper.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <IntegrationCosts locale={locale} kind="ecommerce" />

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
      <StudioClosing title={t('closing.title')} label={t('closing.cta')} href={accountHref} />
    </StudioShell>
  );
}
