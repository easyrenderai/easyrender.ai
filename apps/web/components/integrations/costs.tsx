import { RENDER_CREDITS } from '@easyrender/harness';
import { getTranslations } from 'next-intl/server';
import { Section } from '@/components/landing';
import type { Locale } from '@/i18n/config';
import { formatCount, formatMoney } from '@/lib/price-format';

const EXAMPLE_MODELS = 100;

export async function IntegrationCosts({ locale, kind }: { locale: Locale; kind: 'api' | 'mcp' }) {
  if (kind === 'mcp') {
    const t = await getTranslations({ locale, namespace: 'IntegrationLanding.costs' });
    return (
      <Section id="integration-cost" title={t('mcp.title')} description={t('mcp.description')}>
        <p className="mx-auto max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {t('mcp.check')}
        </p>
      </Section>
    );
  }

  const { currentPricing } = await import('@/lib/pricing');
  const [pricing, t] = await Promise.all([
    currentPricing(),
    getTranslations({ locale, namespace: 'IntegrationLanding.costs' }),
  ]);
  const money = (value: number) => formatMoney(locale, value, pricing.currency);
  const buildPrice = RENDER_CREDITS * pricing.creditPrice;
  return (
    <Section
      id="integration-cost"
      title={t(`${kind}.title`)}
      description={t(`${kind}.description`)}
    >
      <dl className="grid gap-4 md:grid-cols-3">
        {(
          [
            { key: 'preview', value: money(0) },
            { key: 'build', value: money(buildPrice) },
            { key: 'access', value: t('access.value') },
          ] as const
        ).map(({ key, value }) => (
          <div key={key} className="space-y-3 rounded-xl border bg-card p-6">
            <dt className="text-sm text-muted-foreground">{t(`${key}.label`)}</dt>
            <dd className="text-3xl font-semibold tracking-tight">{value}</dd>
            <dd className="text-sm leading-relaxed text-muted-foreground">
              {t(`${key}.body`, { credits: formatCount(locale, RENDER_CREDITS) })}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 grid gap-6 rounded-xl border p-6 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="font-medium">{t('estimate.title', { count: EXAMPLE_MODELS })}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('estimate.body', {
              credits: formatCount(locale, EXAMPLE_MODELS * RENDER_CREDITS),
              price: money(EXAMPLE_MODELS * buildPrice),
              unit: money(pricing.creditPrice),
            })}
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="font-medium">{t('start.title')}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('start.body', {
              credits: formatCount(locale, pricing.payg.min),
              price: money(pricing.payg.min * pricing.creditPrice),
            })}
          </p>
        </div>
      </div>
      <p className="mt-5 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        {t(`${kind}.check`)} {t('refund')}
      </p>
    </Section>
  );
}
