'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { AppLocalePicker } from '@/components/app-locale-picker';
import { LocaleMenu } from '@/components/locale-menu';
import { HTML_LANG, LOCALE_NAMES, type Locale } from '@/i18n/config';
import { isAppLocalePath } from '@/lib/app-locale';
import {
  type Equivalent,
  homeEquivalents,
  pickerFrom,
  registryEquivalents,
} from '@/lib/seo/registry-equivalents';
import { useSitePathname } from '@/lib/use-site-pathname';
import { cn } from '@/lib/utils';

/**
 * Links to the same page in the other languages, which is what hreflang promises, behind a
 * compact dropdown (components/locale-menu). Every option is a plain <a href hreflang> in the HTML
 * even while the list is closed, with no redirect by Accept-Language. A page in one language only
 * lists the homes of the others, so the picker is in every header, signed in or not. A click also
 * stores the choice for the marketing root (components/locale-link).
 *
 * The header is built once for every page of a language, so the page it sits on is read from the
 * address. A page in the route registry is answered right here, in the server HTML too. A guide or
 * a comparison lives in a content file: the picker lists the homes until /api/locale-options
 * answers with that page's own translations.
 */
export function LocaleSwitcher({ className }: { className?: string } = {}) {
  const locale = useLocale() as Locale;
  const t = useTranslations('LocaleSwitcher');
  const pathname = useSitePathname();
  const isApp = isAppLocalePath(pathname);
  const registered = isApp ? null : registryEquivalents(pathname);
  const remote = useQuery({
    queryKey: ['locale-options', pathname],
    queryFn: async ({ signal }): Promise<Equivalent[]> => {
      const response = await fetch(`/api/locale-options?path=${encodeURIComponent(pathname)}`, {
        signal,
      });
      if (!response.ok) throw new Error('locale options unavailable');
      return (await response.json()) as Equivalent[];
    },
    enabled: !isApp && registered === null,
    staleTime: 10 * 60_000,
  });

  if (isApp) {
    return (
      <nav aria-label={t('label')} className={cn('flex items-center', className)}>
        <Suspense>
          <AppLocalePicker />
        </Suspense>
      </nav>
    );
  }
  const options = registered ? pickerFrom(registered) : (remote.data ?? homeEquivalents());
  if (options.length < 2) return null;

  return (
    <nav aria-label={t('label')} className={cn('flex items-center', className)}>
      <LocaleMenu
        current={locale}
        label={t('label')}
        options={options.map(({ locale: option, path }) => ({
          locale: option,
          path,
          hrefLang: HTML_LANG[option],
          name: LOCALE_NAMES[option],
        }))}
      />
    </nav>
  );
}
