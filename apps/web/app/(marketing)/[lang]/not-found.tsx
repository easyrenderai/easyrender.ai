import { getLocale, getTranslations } from 'next-intl/server';
import { SiteLink as Link } from '@/components/site-link';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { ROUTES } from '@/lib/seo/routes';

// A missing page inside a language branch, in that language: the layout around it already carries
// the header, the footer and the translations.
export default async function LocaleNotFound() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations({ locale, namespace: 'NotFound' });
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
      <Button asChild>
        <Link href={ROUTES.home.paths[locale]}>{t('home')}</Link>
      </Button>
    </div>
  );
}
