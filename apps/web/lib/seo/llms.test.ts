import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n/config';
import { FAQ_KEYS } from '@/lib/faq';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import itMessages from '@/messages/it.json';
import pt from '@/messages/pt.json';
import { faqText, llmsFullTxt, llmsTxt } from './llms';
import { NOINDEX_PREFIXES } from './noindex';
import { DISALLOWED_PREFIXES } from './routes';
import { absoluteUrl, SITE_URL } from './site';
import { localeEntries } from './sitemap';

// llms.txt has to say what the sitemaps say and what claims.md allows, nothing more.

const urlsIn = (text: string) =>
  [...text.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1] as string);

const sectionIn = (text: string, heading: string) => {
  const start = text.indexOf(`## ${heading}\n`);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  const end = text.indexOf('\n## ', start + 1);
  return text.slice(start, end === -1 ? undefined : end);
};

const withoutForAgents = (text: string) => text.replace(sectionIn(text, 'For agents'), '');

const AGENT_URLS = [
  `${SITE_URL}/mcp`,
  `${SITE_URL}/es/mcp`,
  `${SITE_URL}/api/mcp`,
  'https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.easyrenderai/easyrender',
  `${SITE_URL}/image-to-3d-api`,
  `${SITE_URL}/es/api-imagen-a-3d`,
  `${SITE_URL}/api/openapi.json`,
  'https://github.com/easyrenderai/easyrender-image-to-3d',
  'https://www.skills.sh/easyrenderai/easyrender-image-to-3d/easyrender-image-to-3d',
  'https://clawhub.ai/jorgerl02/skills/easyrender-image-to-3d',
  'https://github.com/easyrenderai/easyrender-image-to-3d/blob/main/gemini-extension.json',
];

// Phrases claims.md forbids, in either language. Negations such as "not real-world measurements"
// are allowed, so these match the promise, not the word.
const FORBIDDEN = [
  /\bSTL\b/,
  /\bOBJ\b/,
  /\bFBX\b/,
  /3D[- ]print/i,
  /impresi[oó]n 3D/i,
  /\b(true|real)[- ]to[- ]size\b/i,
  /\bat real scale\b/i,
  /\b1:1\b/,
  /a tama[nñ]o real/i,
  /\bembed\b/i,
  /\bin (two|2) minutes\b/i,
  /3D-Druck/i,
  /impression 3D/i,
  /stampa 3D/i,
  /impress[aã]o 3D/i,
  /in Originalgr[oö](ß|ss)e/i,
  /ma[ßs]stabsgetreu/i,
  /[àa] l'[ée]chelle r[ée]elle/i,
  /in scala reale/i,
  /a grandezza naturale/i,
  /\bem tamanho real\b/i,
  /\bvocê\b/i,
];

const MESSAGES = { en, es, de, fr, it: itMessages, pt };

describe('llms.txt', () => {
  const text = llmsTxt();

  it('follows the llms.txt shape: one H1, a summary blockquote, link sections', () => {
    expect(text.startsWith('# Easy Render\n')).toBe(true);
    expect(text.match(/^# /gm)).toHaveLength(1);
    expect(text).toMatch(/^> .+/m);
    expect(text).toContain('## Pages');
  });

  it('lists exactly the indexable URLs of the sitemaps', () => {
    const sitemap = LOCALES.flatMap((locale) => localeEntries(locale)).map((entry) =>
      absoluteUrl(entry.path),
    );
    const listed = urlsIn(text.slice(text.indexOf('## Pages'))).filter(
      (url) => !url.endsWith('.txt'),
    );
    expect(listed.sort()).toEqual([...sitemap].sort());
    expect(listed).toEqual(
      expect.arrayContaining([
        SITE_URL,
        `${SITE_URL}/es`,
        `${SITE_URL}/de`,
        `${SITE_URL}/fr`,
        `${SITE_URL}/it`,
        `${SITE_URL}/pt`,
        `${SITE_URL}/pricing`,
        `${SITE_URL}/es/precios`,
      ]),
    );
  });

  it('never points at a noindex, app or API path, or at another host', () => {
    const listings = text.slice(text.indexOf('## Pages'));
    for (const url of urlsIn(listings)) {
      expect(url.startsWith(SITE_URL), url).toBe(true);
      const path = url.slice(SITE_URL.length) || '/';
      for (const prefix of [...NOINDEX_PREFIXES, ...DISALLOWED_PREFIXES]) {
        expect(path.startsWith(prefix), `${url} vs ${prefix}`).toBe(false);
      }
    }
    // What llms.txt lists under each language is exactly what that language’s sitemap lists.
    for (const locale of ['de', 'fr', 'it', 'pt'] as const) {
      const paths = urlsIn(listings)
        .map((url) => new URL(url).pathname)
        .filter((path) => path.startsWith(`/${locale}/`));
      const expected = localeEntries(locale)
        .map((entry) => entry.path)
        .filter((path) => path.startsWith(`/${locale}/`));
      expect(paths.sort()).toEqual(expected.sort());
    }
  });

  it('lists the agent entry points before the marketing pages', () => {
    const agents = sectionIn(text, 'For agents');
    expect(text.indexOf('## For agents')).toBeLessThan(text.indexOf('## Pages'));
    expect(urlsIn(agents).sort()).toEqual([...AGENT_URLS].sort());
    expect(agents).toContain('io.github.easyrenderai/easyrender');
    expect(agents).toContain('streamable HTTP');
    expect(agents).toContain('OAuth');
    expect(agents).toContain('Authorization: Bearer');
    expect(agents).toContain('401');
    expect(agents).toContain('tools/list are public without credentials');
    expect(agents).toContain('All tools/call requests require');
    expect(agents).toContain('Gemini CLI extension');
  });

  it('describes the product within claims.md', () => {
    expect(text).toContain('GLB and USDZ');
    expect(text).toMatch(/angle sheet/);
    expect(text).toMatch(/coming soon/);
    for (const pattern of FORBIDDEN) expect(text, String(pattern)).not.toMatch(pattern);
  });
});

// Every case renders the whole llms-full.txt, guides included, so it grows with each blog batch. About
// 2 s on a laptop, but the CI runner shares its cores with the other suites, where the 5 s default timed out.
const LLMS_FULL_TEST_TIMEOUT_MS = 30_000;

describe(
  'llms-full.txt',
  () => {
    const text = llmsFullTxt();

    it('carries the same agent entry points before the FAQs', () => {
      expect(sectionIn(text, 'For agents')).toBe(sectionIn(llmsTxt(), 'For agents'));
      expect(text.indexOf('## For agents')).toBeLessThan(text.indexOf('## FAQ (English)'));
    });

    it('carries every FAQ answer of every home, with prices filled in', () => {
      for (const locale of LOCALES) {
        for (const item of faqText(locale)) {
          expect(text).toContain(item.question);
          expect(text).toContain(item.answer);
          expect(item.answer, item.question).not.toMatch(/\{\w+\}/);
        }
      }
    });

    // claims.md binds what easyrender says about itself. The guides go live on their own dates and
    // discuss other formats and 3D printing as topics, so the product copy is read with `now` pinned
    // before the first guide, and the guides get their claims review in the blog pipeline.
    it('keeps the product copy within claims.md', () => {
      const productCopy = llmsFullTxt(new Date('2026-11-01T00:00:00Z'));
      for (const pattern of FORBIDDEN) expect(productCopy, String(pattern)).not.toMatch(pattern);
    });

    it('stays away from noindex paths, guides included', () => {
      for (const url of urlsIn(withoutForAgents(llmsFullTxt(new Date('2026-12-01T00:00:00Z'))))) {
        if (new URL(url).origin !== SITE_URL) continue;
        const path = new URL(url).pathname;
        for (const prefix of NOINDEX_PREFIXES) expect(path.startsWith(prefix), url).toBe(false);
      }
    });
  },
  LLMS_FULL_TEST_TIMEOUT_MS,
);

describe('llms-full.txt once every week 1 guide is out', () => {
  const text = llmsFullTxt(new Date('2026-12-01T00:00:00Z'));

  it('turns drawn diagrams into their alt text and caption, never a diagram: path', () => {
    expect(text).not.toContain('](diagram:');
    expect(text).toMatch(/\[Diagram: [^\]]{10,}\] \S/);
  });
});

describe('the home FAQ copy', () => {
  it('has every FAQ key in every language', () => {
    for (const messages of Object.values(MESSAGES)) {
      const items = messages.Landing.faq.items as Record<string, { q?: string; a?: string }>;
      for (const key of FAQ_KEYS) {
        expect(items[key]?.q, key).toBeTruthy();
        expect(items[key]?.a, key).toBeTruthy();
      }
    }
  });

  it('makes no roadmap promise about link-only sharing', () => {
    const answers = Object.values(MESSAGES)
      .map((messages) => messages.Landing.faq.items.public.a)
      .join(' ');
    expect(answers).not.toMatch(/product queue|pedida al producto|link-only|solo con enlace/i);
  });
});

it('offers one monthly plan and explicitly describes subscriber top-ups', () => {
  // Rendered once: each call walks the whole content corpus.
  const text = llmsTxt();
  expect(text).toContain('monthly plan: Pro');
  expect(text).toContain('without changing plans');
  expect(text).not.toMatch(/Creator|Scale/);
});
