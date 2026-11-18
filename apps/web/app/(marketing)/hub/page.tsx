import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Hub } from '@/components/studio/hub';
import { StudioClosing } from '@/components/studio/proof';
import { StudioShell } from '@/components/studio/shell';
import { StudioWheel } from '@/components/studio/wheel';
import type { Locale } from '@/i18n/config';
import { noindexMetadata } from '@/lib/seo/metadata';
import { ROUTES } from '@/lib/seo/routes';
import { CATEGORIES, type CategoryKey } from '@/lib/studio/catalog';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Hub');
  return noindexMetadata(t('metaTitle'), t('metaDescription'));
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Every element in the hub with its spec sheet. /hub?category=props filters, /hub#lamp opens one.
export default async function HubPage({ searchParams }: PageProps<'/hub'>) {
  const [params, t, locale] = await Promise.all([
    searchParams,
    getTranslations('Hub'),
    getLocale(),
  ]);
  const category = first(params.category);
  return (
    <StudioShell>
      <Hub
        initialCategory={
          CATEGORIES.includes(category as CategoryKey) ? (category as CategoryKey) : null
        }
        initialQuery={first(params.q) ?? ''}
      />
      <div id="ecosystem">
        <StudioWheel />
      </div>
      <StudioClosing
        title={t('cta.title')}
        label={t('cta.button')}
        href={`${ROUTES.home.paths[locale as Locale]}#try`}
      />
    </StudioShell>
  );
}
