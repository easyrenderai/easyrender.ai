import {
  CREDIT_USD,
  PAYG,
  PUBLIC_PLAN_IDS,
  RENDER_CREDITS,
  SUBSCRIPTION_PLANS,
} from '@easyrender/harness';
import type { Locale } from '@/i18n/config';
import { type BlogPost, isLiveBlogLink, listPosts } from '@/lib/blog/posts';
import { COMPARE_INDEX, listComparePages } from '@/lib/compare/pages';
import { FAQ_KEYS } from '@/lib/faq';
import { formatUsd } from '@/lib/price-format';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import it from '@/messages/it.json';
import pt from '@/messages/pt.json';
import { ROUTES } from './routes';
import { absoluteUrl, SITE_NAME } from './site';
import { localeEntries, sitemapLocales } from './sitemap';

// /llms.txt and /llms-full.txt (https://llmstxt.org): the site described for AI assistants, in
// plain markdown. Their marketing listings come from the sitemaps, so they list exactly the
// indexable URLs: never the gallery, model pages, hub, ad landings, auth or the app, and a guide
// appears on the day it is published, with no deploy. Agent entry points are listed separately.
//
// Every product statement here follows decisiones/claims.md: one photo, a free angle sheet, a 3D
// model as GLB and USDZ, AR coming soon. No real-world size or scale, no other formats, no
// timings, no own figures. Prices come from the harness, like the pricing page.

type FaqMessages = { Landing: { faq: { items: Record<string, { q: string; a: string }> } } };

const MESSAGES: Record<Locale, FaqMessages> = { en, es, de, fr, it, pt };

const usd = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const PAGE_LABELS: Record<string, { title: string; note: string }> = {
  '/': {
    title: 'easyrender home (English)',
    note: 'What the product does, how the free preview works, pricing summary and FAQ.',
  },
  [ROUTES.home.paths.es]: {
    title: 'easyrender en español',
    note: 'La misma página en español: de una imagen a 3D con una sola foto.',
  },
  [ROUTES.home.paths.de]: {
    title: 'easyrender auf Deutsch',
    note: 'Dieselbe Seite auf Deutsch: aus einem Bild ein 3D-Modell.',
  },
  [ROUTES.home.paths.fr]: {
    title: 'easyrender en français',
    note: 'La même page en français : une image en 3D à partir d’une seule photo.',
  },
  [ROUTES.home.paths.it]: {
    title: 'easyrender in italiano',
    note: 'La stessa pagina in italiano: da immagine a 3D con una sola foto.',
  },
  [ROUTES.home.paths.pt]: {
    title: 'easyrender em português (Portugal)',
    note: 'A mesma página em português de Portugal: de uma imagem para 3D com uma só fotografia.',
  },
  ...Object.fromEntries(
    (['de', 'fr', 'it', 'pt'] as const).map((locale) => [
      ROUTES.pricing.paths[locale],
      {
        title: { de, fr, it, pt }[locale].Pricing.breadcrumb,
        note: { de, fr, it, pt }[locale].Pricing.title,
      },
    ]),
  ),
  [ROUTES.pricing.paths.en]: {
    title: 'Pricing',
    note: 'Pay as you go credits and the monthly plans, as currently charged.',
  },
  [ROUTES.pricing.paths.es]: {
    title: 'Precios',
    note: 'Créditos de pago por uso y planes mensuales, tal como se cobran hoy.',
  },
  [ROUTES.api.paths.en]: { title: en.ApiLanding.meta.title, note: en.ApiLanding.meta.description },
  [ROUTES.api.paths.es]: { title: es.ApiLanding.meta.title, note: es.ApiLanding.meta.description },
  [ROUTES.mcp.paths.en]: { title: en.McpLanding.meta.title, note: en.McpLanding.meta.description },
  [ROUTES.mcp.paths.es]: { title: es.McpLanding.meta.title, note: es.McpLanding.meta.description },
  [ROUTES.models.paths.en]: {
    title: 'Models',
    note: 'The three models behind every render, their settings and what each step costs in credits.',
  },
  [ROUTES.models.paths.es]: {
    title: 'Modelos',
    note: 'Los tres modelos detrás de cada render, sus ajustes y el coste de cada paso en créditos.',
  },
  [ROUTES.evals.paths.en]: {
    title: 'Evals',
    note: 'How renders are checked and the results of each published eval run.',
  },
  [ROUTES.evals.paths.es]: {
    title: 'Evaluaciones',
    note: 'Cómo se revisan los renders y los resultados de cada ejecución publicada.',
  },
  [ROUTES.blog.paths.en]: { title: 'Guides', note: 'Guides on photos, 3D files and formats.' },
  [ROUTES.blog.paths.es]: { title: 'Guías', note: 'Guías en español.' },
  [ROUTES.blog.paths.de]: {
    title: 'Ratgeber',
    note: 'Ratgeber zu Fotos, 3D-Dateien und Formaten.',
  },
  [ROUTES.blog.paths.fr]: {
    title: 'Guides',
    note: 'Guides sur les photos, les fichiers 3D et les formats.',
  },
  [ROUTES.blog.paths.it]: { title: 'Guide', note: 'Guide su foto, file 3D e formati.' },
  [ROUTES.blog.paths.pt]: {
    title: 'Guias',
    note: 'Guias sobre fotografias, ficheiros 3D e formatos.',
  },
  [ROUTES.compare.paths.en]: {
    title: COMPARE_INDEX.en.title,
    note: COMPARE_INDEX.en.description,
  },
  [ROUTES.compare.paths.es]: {
    title: COMPARE_INDEX.es.title,
    note: COMPARE_INDEX.es.description,
  },
  [ROUTES.compare.paths.de]: {
    title: COMPARE_INDEX.de.title,
    note: COMPARE_INDEX.de.description,
  },
  [ROUTES.compare.paths.fr]: {
    title: COMPARE_INDEX.fr.title,
    note: COMPARE_INDEX.fr.description,
  },
  [ROUTES.compare.paths.it]: {
    title: COMPARE_INDEX.it.title,
    note: COMPARE_INDEX.it.description,
  },
  [ROUTES.compare.paths.pt]: {
    title: COMPARE_INDEX.pt.title,
    note: COMPARE_INDEX.pt.description,
  },
};

function summary(): string[] {
  const modelPrice = usd(RENDER_CREDITS * CREDIT_USD);
  const plans = PUBLIC_PLAN_IDS.map((id) => {
    const plan = SUBSCRIPTION_PLANS[id];
    return `${plan.label} ${usd(plan.priceCents / 100)} for ${plan.monthlyCredits.toLocaleString('en-US')} credits`;
  }).join(', ');
  return [
    `# ${SITE_NAME}`,
    '',
    '> easyrender turns one photo of an object into a 3D model. You upload a photo of a piece of furniture, a decor object or a building exterior, check a free angle sheet that shows the object from every side, and spend credits only if you want the finished 3D model, which downloads as GLB and USDZ.',
    '',
    'Key facts:',
    '',
    '- Input: one photo of a single object (furniture, decor, building exterior).',
    '- Free step: an angle sheet that draws the object from every side, so you can check the shape before paying.',
    `- Paid step: a finished, textured 3D model for ${RENDER_CREDITS} credits (${modelPrice}). Credits cost ${usd(CREDIT_USD)} each, from ${PAYG.min.toLocaleString('en-US')} credits; monthly plan: ${plans}. Enterprise offers custom volume pricing by contacting the team. Monthly subscribers can top up at the displayed pay-as-you-go rate from Credits without changing plans. Credits never expire. If a 3D build fails, its credits are refunded.`,
    '- Downloads: GLB and USDZ.',
    '- Augmented reality (see the model in your room from a phone) is coming soon.',
    '- Limits: one object at a time, not whole interior rooms. The model keeps shape and materials, not real-world measurements or scale.',
    '- Web-created models appear in the public gallery by default. New API and MCP renders are private unless explicitly shared.',
    '- For agents: easyrender is also an MCP server, so Claude, Cursor, VS Code and other MCP clients can create models with an API key.',
    '',
  ];
}

function forAgentsSection(): string[] {
  return [
    '## For agents',
    '',
    `- [MCP server (English)](${absoluteUrl(ROUTES.mcp.paths.en)}): setup and tools.`,
    `- [MCP server (Spanish)](${absoluteUrl(ROUTES.mcp.paths.es)}): setup and tools in Spanish.`,
    `- [Remote MCP endpoint](${absoluteUrl('/api/mcp')}): streamable HTTP; authenticate with OAuth or an API key in Authorization: Bearer. Without credentials, it returns 401.`,
    '- [Official MCP Registry entry](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.easyrenderai/easyrender): io.github.easyrenderai/easyrender.',
    `- [REST API (English)](${absoluteUrl(ROUTES.api.paths.en)}): image-to-3D API overview.`,
    `- [REST API (Spanish)](${absoluteUrl(ROUTES.api.paths.es)}): image-to-3D API overview in Spanish.`,
    '- [Agent skill on GitHub](https://github.com/easyrenderai/easyrender-image-to-3d): installation and usage.',
    '- [Agent skill on skills.sh](https://www.skills.sh/easyrenderai/easyrender-image-to-3d/easyrender-image-to-3d): skill listing.',
    '- [Agent skill on ClawHub](https://clawhub.ai/jorgerl02/skills/easyrender-image-to-3d): skill listing.',
    '- [Gemini CLI extension](https://github.com/easyrenderai/easyrender-image-to-3d/blob/main/gemini-extension.json): the same skill repo includes gemini-extension.json.',
    '',
  ];
}

type Link = { url: string; title: string; note: string };

function indexableLinks(now: Date): { pages: Link[]; guides: Link[] } {
  const pages: Link[] = [];
  const guides: Link[] = [];
  for (const locale of sitemapLocales(now)) {
    const posts = new Map<string, BlogPost>(
      listPosts(locale, now).map((post) => [post.path, post]),
    );
    const compares = new Map(listComparePages(locale).map((page) => [page.path, page]));
    for (const entry of localeEntries(locale, now)) {
      const post = posts.get(entry.path);
      if (post) {
        guides.push({ url: absoluteUrl(post.path), title: post.title, note: post.description });
        continue;
      }
      const compare = compares.get(entry.path);
      if (compare) {
        pages.push({
          url: absoluteUrl(compare.path),
          title: compare.title,
          note: compare.description,
        });
        continue;
      }
      const label = PAGE_LABELS[entry.path];
      // A registry page without a label is still listed, so a new page can never go missing.
      pages.push({
        url: absoluteUrl(entry.path),
        title: label?.title ?? entry.path,
        note: label?.note ?? '',
      });
    }
  }
  return { pages, guides };
}

const linkLine = ({ url, title, note }: Link) => `- [${title}](${url})${note ? `: ${note}` : ''}`;

/** /llms.txt: the summary, agent entry points and indexable pages. */
export function llmsTxt(now: Date = new Date()): string {
  const { pages, guides } = indexableLinks(now);
  return [
    ...summary(),
    ...forAgentsSection(),
    '## Pages',
    '',
    ...pages.map(linkLine),
    '',
    ...(guides.length ? ['## Guides', '', ...guides.map(linkLine), ''] : []),
    '## Optional',
    '',
    `- [Full text for assistants](${absoluteUrl('/llms-full.txt')}): the home FAQ in every published language, and every published guide in full.`,
    '',
  ].join('\n');
}

/** The home FAQ of a locale as plain question and answer pairs, with prices from the harness. */
export function faqText(locale: Locale): { question: string; answer: string }[] {
  const items = MESSAGES[locale].Landing.faq.items;
  // The same format the page prints (pt formats as pt-PT, see lib/price-format.ts).
  const format = (value: number) => formatUsd(locale, value);
  const vars: Record<string, string> = {
    credits: String(RENDER_CREDITS),
    price: format(RENDER_CREDITS * CREDIT_USD),
    unit: format(CREDIT_USD),
  };
  return FAQ_KEYS.map((key) => ({
    question: items[key].q,
    answer: items[key].a.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match),
  }));
}

/** /llms-full.txt: llms.txt plus the FAQ of each live home and the full text of every guide. */
export function llmsFullTxt(now: Date = new Date()): string {
  const lines = [...summary(), ...forAgentsSection()];
  const faqTitles: Record<Locale, string> = {
    en: 'FAQ (English)',
    es: 'Preguntas frecuentes (español)',
    de: 'Häufige Fragen (Deutsch)',
    fr: 'Questions fréquentes (français)',
    it: 'Domande frequenti (italiano)',
    pt: 'Perguntas frequentes (português de Portugal)',
  };
  for (const locale of sitemapLocales(now)) {
    const faq = faqText(locale);
    if (!faq.length) continue;
    lines.push(`## ${faqTitles[locale]}`, '');
    lines.push(`Source: ${absoluteUrl(ROUTES.home.paths[locale])}`, '');
    for (const item of faq) lines.push(`### ${item.question}`, '', item.answer, '');
  }
  for (const locale of sitemapLocales(now)) {
    for (const post of listPosts(locale, now)) {
      // A link to a guide that is not out yet becomes its text; the rest become absolute URLs,
      // so they still work outside the site.
      const isLive = isLiveBlogLink(locale, now);
      // A drawn diagram has no file to link to, so it becomes its alt text and caption.
      const body = post.body
        .replace(
          /^!\[([^\]]+)\]\(diagram:[^)\s]+(?:\s+"([^"]*)")?\)$/gm,
          (_, alt: string, caption?: string) =>
            caption ? `[Diagram: ${alt}] ${caption}` : `[Diagram: ${alt}]`,
        )
        .replace(/(?<!!)\[([^\]]+)\]\((\/[^)\s]*)\)/g, (match, label: string, href: string) =>
          isLive(href) ? match : label,
        )
        .replace(/\]\(\//g, `](${absoluteUrl('/')}/`);
      lines.push(`## ${post.title}`, '', `Source: ${absoluteUrl(post.path)}`, '', body, '');
    }
  }
  return lines.join('\n');
}

const HEADERS = {
  'content-type': 'text/plain; charset=utf-8',
  // Same cadence as the sitemaps: a guide scheduled for today appears without a deploy.
  'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600',
};

export const textResponse = (body: string): Response => new Response(body, { headers: HEADERS });
