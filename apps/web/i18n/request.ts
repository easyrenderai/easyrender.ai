import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, isRoutableLocale, LOCALE_HEADER } from './config';

// The proxy resolves the language from the URL for indexed pages and from the interface
// preference on app pages. The layout, server translations and client provider share it.
export default getRequestConfig(async ({ locale: override }) => {
  const fromUrl = (await headers()).get(LOCALE_HEADER);
  const locale = isRoutableLocale(override)
    ? override
    : isRoutableLocale(fromUrl)
      ? fromUrl
      : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
