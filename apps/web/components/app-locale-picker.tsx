'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LocaleMenu } from '@/components/locale-menu';
import { DEFAULT_LOCALE, HTML_LANG, isLocale, LOCALE_NAMES, ROUTABLE_LOCALES } from '@/i18n/config';

export function AppLocalePicker() {
  const pathname = usePathname();
  const params = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('LocaleSwitcher');
  return (
    <LocaleMenu
      current={isLocale(locale) ? locale : DEFAULT_LOCALE}
      label={t('label')}
      options={ROUTABLE_LOCALES.map((option) => {
        const target = new URLSearchParams(params.toString());
        target.set('locale', option);
        return {
          locale: option,
          path: `${pathname}?${target}`,
          hrefLang: HTML_LANG[option],
          name: LOCALE_NAMES[option],
        };
      })}
    />
  );
}
