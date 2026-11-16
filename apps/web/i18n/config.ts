// The six languages of the site tree. English lives at the root and is x-default; the other five
// sit under /{locale} with native slugs (see lib/seo/routes.ts).
export const LOCALES = ['en', 'es', 'de', 'fr', 'it', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

// A locale is routable once its UI strings exist in messages/{locale}.json, reviewed by a native
// speaker. Anything else 404s: a URL without approved text is never served, never linked and
// never listed in a sitemap. Adding messages/de.json and 'de' here is all it takes to open /de.
// Routable is not published: each page still opens per locale in lib/seo/routes.ts, so de, fr,
// it and pt serve their home, pricing and cookie information; other pages stay unpublished.
export const ROUTABLE_LOCALES = [
  'en',
  'es',
  'de',
  'fr',
  'it',
  'pt',
] as const satisfies readonly Locale[];
export type RoutableLocale = (typeof ROUTABLE_LOCALES)[number];

// The hreflang values each locale answers for. pt is Portugal only: never pt-BR.
export const HREFLANG: Record<Locale, readonly string[]> = {
  en: ['en'],
  es: ['es', 'es-ES'],
  de: ['de', 'de-DE', 'de-AT', 'de-CH'],
  fr: ['fr', 'fr-FR'],
  it: ['it', 'it-IT'],
  pt: ['pt', 'pt-PT'],
};

// The <html lang> value, which is the plain language tag, not the list above.
export const HTML_LANG: Record<Locale, string> = {
  en: 'en',
  es: 'es',
  de: 'de',
  fr: 'fr',
  it: 'it',
  pt: 'pt-PT',
};

// The tag Intl formats numbers and prices with. A bare 'pt' is Brazilian to Intl ("US$ 0,20"),
// and the site speaks Portugal's Portuguese only, so pt formats as pt-PT ("0,20 US$").
export const INTL_LOCALE: Record<Locale, string> = {
  en: 'en',
  es: 'es',
  de: 'de',
  fr: 'fr',
  it: 'it',
  pt: 'pt-PT',
};

/** The Intl tag for a site locale; anything that is not one of ours passes through untouched. */
export const intlLocale = (locale: string): string =>
  isLocale(locale) ? INTL_LOCALE[locale] : locale;

// Open Graph wants a territory, so it gets the primary one.
export const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  es: 'es_ES',
  de: 'de_DE',
  fr: 'fr_FR',
  it: 'it_IT',
  pt: 'pt_PT',
};

// Endonyms: a language picker reads better in each language's own words.
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  pt: 'Português',
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

export const isRoutableLocale = (value: unknown): value is RoutableLocale =>
  typeof value === 'string' && (ROUTABLE_LOCALES as readonly string[]).includes(value);

// Set by proxy.ts from the URL, so the root layout and i18n/request.ts agree on the language
// without a cookie and without sniffing Accept-Language. The path travels the same way, which
// lets the language picker render on the server with no client JavaScript.
export const LOCALE_HEADER = 'x-easyrender-locale';
export const PATH_HEADER = 'x-easyrender-path';
