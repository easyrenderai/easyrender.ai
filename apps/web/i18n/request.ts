import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, isRoutableLocale, LOCALE_HEADER } from './config';

// A marketing page names its own language (IntlBoundary calls setRequestLocale), which is the only
// way a page can be built once and cached. Every other page, the app and sign in, gets it from
// proxy.ts, which resolves the language from the URL or from the interface preference.
export default getRequestConfig(async ({ locale: override, requestLocale }) => {
  const chosen = isRoutableLocale(override) ? override : await requestLocale;
  const fromUrl = isRoutableLocale(chosen) ? chosen : (await headers()).get(LOCALE_HEADER);
  const locale = isRoutableLocale(fromUrl) ? fromUrl : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
