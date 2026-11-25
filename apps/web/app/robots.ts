import type { MetadataRoute } from 'next';
import { NOINDEX_PREFIXES } from '@/lib/seo/noindex';
import { DISALLOWED_PREFIXES } from '@/lib/seo/routes';
import { SITE_URL } from '@/lib/seo/site';

// AI crawlers and AI-use tokens we want reading the marketing pages, so assistants answer from
// what the site actually says. Named on purpose rather than left to `*`: it documents the
// decision, and a later blanket rule for `*` cannot silently shut them out.
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'Google-Extended',
] as const;

// The MCP endpoint is the one `/api/` route that AI agents are meant to call. The longer match
// wins over `Disallow: /api/`, so this opens `/api/mcp` and its discovery files, nothing else.
// The OAuth discovery documents live under `/.well-known`, which no group disallows.
export const AI_AGENT_ALLOWED_PATHS = ['/api/mcp'] as const;

// What crawlers may fetch. For search engines, staying out of the index is a meta robots job,
// not a Disallow one: a page blocked here can still be indexed from a link, and a blocked page's
// noindex is never read. So /explore, /r/ and /lp/ are crawlable for `*` and carry noindex, and
// /lp/ in particular must stay crawlable because Google's AdsBot has to reach the ad landings.
//
// AI crawlers are the other way round: several of them do not honour a meta noindex, so the
// zones that must stay out of answers (gallery, model pages, hub, ad landings, auth) are
// disallowed for them outright. A group for a named agent replaces the `*` group for that agent,
// so it repeats the app and API prefixes.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: [...DISALLOWED_PREFIXES] },
      {
        userAgent: [...AI_CRAWLERS],
        allow: ['/', ...AI_AGENT_ALLOWED_PATHS],
        disallow: [...DISALLOWED_PREFIXES, ...NOINDEX_PREFIXES],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
