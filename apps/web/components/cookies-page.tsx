import { getTranslations } from 'next-intl/server';
import { ConsentControls } from '@/components/analytics';
export async function CookiesPage() {
  const t = await getTranslations('Analytics');
  return (
    <article className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      <dl className="space-y-5 text-sm">
        {(
          ['anon', 'language', 'consent', 'ga', 'advertising', 'posthog', 'attribution'] as const
        ).map((key) => (
          <div key={key}>
            <dt className="font-medium">{t(`${key}Title`)}</dt>
            <dd className="mt-1 text-muted-foreground">{t(key)}</dd>
          </div>
        ))}
      </dl>
      <h2 className="text-lg font-medium">{t('change')}</h2>
      <p className="text-sm text-muted-foreground">{t('withdraw')}</p>
      <ConsentControls />
    </article>
  );
}
