// Search engines, AI crawlers, link unfurlers and generic HTTP clients. A bot asking for / gets
// the English home with its full hreflang block, which is how it finds the other five.
const BOT_PATTERN =
  /bot\b|bot\/|crawl|spider|slurp|googlebot|google-inspectiontool|googleother|google-extended|storebot|adsbot|mediapartners|apis-google|feedfetcher|bingbot|bingpreview|msnbot|duckduckbot|duckassist|yandex|baiduspider|sogou|exabot|petalbot|applebot|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-user|claude-searchbot|claude-web|anthropic-ai|perplexitybot|perplexity-user|bytespider|ccbot|cohere-ai|diffbot|amazonbot|meta-externalagent|meta-externalfetcher|facebookexternalhit|facebookbot|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|pinterest|redditbot|embedly|semrush|ahrefs|mj12bot|dotbot|seznambot|ia_archiver|archive\.org|headlesschrome|playwright|puppeteer|selenium|phantomjs|lighthouse|pagespeed|chrome-lighthouse|curl\/|wget\/|python-requests|python-urllib|httpx|aiohttp|go-http-client|okhttp|java\/|node-fetch|undici|axios|libwww|scrapy|preview/i;

/** True for any crawler or non-browser client, and for a request with no user agent at all. */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return true;
  return BOT_PATTERN.test(userAgent);
}

/** Shared browser/bootstrap guard; a normal Linux desktop is not automation. */
export function isBrowserBot(): boolean {
  return (
    typeof navigator === 'undefined' || navigator.webdriver === true || isBot(navigator.userAgent)
  );
}

/** The same detector runs before the Google loader, outside the application bundle. */
export const BOT_CHECK_SCRIPT = `function erIsBrowserBot(){return typeof navigator==='undefined'||navigator.webdriver===true||!navigator.userAgent?.trim()||${BOT_PATTERN}.test(navigator.userAgent)}`;
