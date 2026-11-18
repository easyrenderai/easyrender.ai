import { isRoutableLocale, type Locale, type RoutableLocale } from '@/i18n/config';
import { isPublished, ROUTES } from '@/lib/seo/routes';

// The first-visit language redirect of the marketing home, and nothing else (Jorge, 10-nov-2026).
//
// Only the exact root `/` is ever redirected, only for a GET or HEAD from a person, and only to a
// home that is live. Every other URL, /es, /de and the app included, is served as asked. The page
// at each URL stays in the language of the URL: this changes the URL, never the copy, so
// i18n/request.ts still reads the language from the path alone.
//
// The cookie remembers a choice: set by the language picker on click, or by this redirect when it
// picks a language from the country. Staying in English sets nothing, so a visitor with no
// country, or from a country we do not map, is re-checked on the next visit and still gets
// English. The app remembers its interface language separately in proxy.ts.

export { HOME_LOCALE_COOKIE, HOME_LOCALE_MAX_AGE, HOME_VARY } from './home-locale-constants';

/** The country header Vercel sets at the edge. Absent locally and on other hosts. */
export const COUNTRY_HEADER = 'x-vercel-ip-country';

// Multilingual countries are mapped by decision, not detected: CH goes to German and BE to French.
// Brazil and Latin America stay in English: pt is Portugal only, es is Spain only.
const COUNTRY_LOCALE: Record<string, Locale> = {
  DE: 'de',
  AT: 'de',
  CH: 'de',
  LI: 'de',
  FR: 'fr',
  BE: 'fr',
  LU: 'fr',
  MC: 'fr',
  IT: 'it',
  SM: 'it',
  VA: 'it',
  PT: 'pt',
  ES: 'es',
};

/** The home language for an ISO 3166 country code, or null for English. */
export function localeForCountry(country: string | null | undefined): Locale | null {
  if (!country) return null;
  return COUNTRY_LOCALE[country.trim().toUpperCase()] ?? null;
}

// Search engines, AI crawlers, link unfurlers and generic HTTP clients. A bot asking for / gets
// the English home with its full hreflang block, which is how it finds the other five.
const BOT_PATTERN =
  /bot\b|bot\/|crawl|spider|slurp|googlebot|google-inspectiontool|googleother|google-extended|storebot|adsbot|mediapartners|apis-google|feedfetcher|bingbot|bingpreview|msnbot|duckduckbot|duckassist|yandex|baiduspider|sogou|exabot|petalbot|applebot|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-user|claude-searchbot|claude-web|anthropic-ai|perplexitybot|perplexity-user|bytespider|ccbot|cohere-ai|diffbot|amazonbot|meta-externalagent|meta-externalfetcher|facebookexternalhit|facebookbot|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|pinterest|redditbot|embedly|semrush|ahrefs|mj12bot|dotbot|seznambot|ia_archiver|archive\.org|headlesschrome|lighthouse|pagespeed|chrome-lighthouse|curl\/|wget\/|python-requests|python-urllib|httpx|aiohttp|go-http-client|okhttp|java\/|node-fetch|undici|axios|libwww|scrapy|preview/i;

/** True for any crawler or non-browser client, and for a request with no user agent at all. */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return true;
  return BOT_PATTERN.test(userAgent);
}

/** A home that answers 200 today: routable and published, never English (that is `/` itself). */
function liveHome(locale: unknown): Exclude<RoutableLocale, 'en'> | null {
  if (!isRoutableLocale(locale) || locale === 'en') return null;
  return isPublished('home', locale) ? locale : null;
}

/** The home path of a language, e.g. /de. */
export const homePath = (locale: Locale): string => ROUTES.home.paths[locale];

/** True when `path` is one of the non-English marketing pages, /de or /de/..., for example. */
function isLocalePath(path: string): boolean {
  const first = path.split('/')[1];
  return isRoutableLocale(first) && first !== 'en';
}

export type HomeRequest = {
  method: string;
  pathname: string;
  host: string | null;
  country: string | null;
  userAgent: string | null;
  cookie: string | null;
  referer: string | null;
  /** True for a browser prefetch (Purpose / Sec-Purpose), fired before any click. */
  isRouterRequest: boolean;
};

export type HomeDecision =
  /** Not the root, not a person, or not a GET: leave the request alone. */
  | { kind: 'skip' }
  /** The root, served in English. `cookie` is set when the visitor just chose English. */
  | { kind: 'stay'; cookie?: 'en' }
  /** The root, redirected to a live home. `cookie` is set when the country chose it. */
  | { kind: 'redirect'; locale: Locale; cookie?: Locale };

/**
 * Decides what the root does for one request. Pure, so every rule is unit tested; proxy.ts only
 * turns the answer into a response.
 */
export function decideHome(request: HomeRequest): HomeDecision {
  if (request.pathname !== '/') return { kind: 'skip' };
  if (request.method !== 'GET' && request.method !== 'HEAD') return { kind: 'skip' };
  // A prefetch is fired before the click that may change the cookie, and its answer would be
  // kept: only the real navigation decides.
  if (request.isRouterRequest) return { kind: 'skip' };
  if (isBot(request.userAgent)) return { kind: 'skip' };

  // Coming to / from one of our own localised pages (/de, /es/guias/...) means someone picked English on a page whose
  // picker could not write the cookie (JavaScript off). Checked before the cookie, which still
  // names the language they are leaving, so / stops sending them back.
  if (request.referer && request.host) {
    try {
      const from = new URL(request.referer);
      if (from.host === request.host && isLocalePath(from.pathname)) {
        return { kind: 'stay', cookie: 'en' };
      }
    } catch {
      // A malformed Referer is ignored.
    }
  }

  // A choice already made wins over the country, in both directions.
  if (request.cookie) {
    const remembered = liveHome(request.cookie);
    if (remembered) return { kind: 'redirect', locale: remembered };
    if (request.cookie === 'en') return { kind: 'stay' };
    // An unknown or retired value falls through and is decided again.
  }

  const fromCountry = liveHome(localeForCountry(request.country));
  if (fromCountry) return { kind: 'redirect', locale: fromCountry, cookie: fromCountry };
  return { kind: 'stay' };
}
