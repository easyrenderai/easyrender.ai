import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, type Locale } from '@/i18n/config';
import { parseContentDate, parseFrontMatter } from '@/lib/blog/frontmatter';
import {
  type BlogAuthor,
  type FaqItem,
  faqFromBody,
  fillPrices,
  stripComments,
} from '@/lib/blog/posts';
import { isInReview, isPublished, ROUTES } from '@/lib/seo/routes';

// Comparison pages are content files, like the guides: content/compare/{locale}/{slug}.md, with
// the same front matter, the same markdown subset (tables and the FAQ accordion included) and
// the same price tokens.
//
//   ---
//   group: compare-meshy        stable id shared by every translation, for hreflang
//   title: Meshy alternative …  the <h1> and the <title>
//   description: One sentence.  the meta description
//   keyword: meshy alternative  the target query, for the record
//   publishAt: 2026-11-23     optional publication date (00:00 UTC) or full ISO instant
//   updated: 2026-11-11         the last real change
//   author: Jorge Rodríguez     optional; guides and the reviewed translations name him
//   authorType: person          optional, with author
//   cta: One sentence above the closing button.
//   ---
//
// A locale is served only when ROUTES.compare publishes it. A slug with no file is a 404.
// Hreflang lists a translation only when that file exists.

export type ComparePage = {
  locale: Locale;
  slug: string;
  group: string;
  title: string;
  description: string;
  keyword?: string;
  publishAt?: string;
  updated?: string;
  /** Set when the file names an author. English pages written before the byline omit it. */
  author?: BlogAuthor;
  cta?: string;
  body: string;
  faq: FaqItem[];
  /** Site-relative URL. */
  path: string;
};

const CONTENT_ROOT = join(process.cwd(), 'content', 'compare');

const AUTHOR_TYPES: Record<string, BlogAuthor['type']> = {
  organization: 'Organization',
  person: 'Person',
};

export const comparePath = (locale: Locale, slug: string): string =>
  `${ROUTES.compare.paths[locale]}/${slug}`;

/**
 * An href for a comparison card. The hub is one of the fixed paths, and the slug has to be the
 * file name shape we publish. Anything else stays on the hub, so a file name cannot become a
 * `javascript:` URL.
 */
export function compareHref(locale: Locale, slug: string): string {
  const hub =
    locale === 'es'
      ? '/es/comparativas'
      : locale === 'de'
        ? '/de/vergleich'
        : locale === 'fr'
          ? '/fr/comparatifs'
          : locale === 'it'
            ? '/it/confronti'
            : locale === 'pt'
              ? '/pt/comparacoes'
              : '/compare';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return hub;
  return `${hub}/${slug}`;
}

/** The comparisons hub: title and description for the page, the sitemap and llms.txt. */
export const COMPARE_INDEX: Record<Locale, { title: string; description: string }> = {
  en: {
    title: 'Compare 3D modeling methods and tools',
    description:
      'Compare 3D modeling methods and tools for product work: a modeler vs AI, 360 vs 3D, photogrammetry, Polycam, Meshy and Tripo.',
  },
  es: {
    title: 'Comparar métodos y herramientas de modelado 3D',
    description:
      'Comparativas para el trabajo de producto: modelador o IA, 360 o 3D, fotogrametría, Polycam, Meshy y Tripo.',
  },
  de: {
    title: '3D-Methoden und Werkzeuge vergleichen',
    description:
      'Vergleiche für die Produktarbeit: Modellierer oder KI, 360 oder 3D, Photogrammetrie, Meshy und Tripo.',
  },
  fr: {
    title: 'Comparer méthodes et outils de modélisation 3D',
    description:
      'Des comparatifs pour le travail produit : modeleur ou IA, 360 ou 3D, photogrammétrie, Meshy et Tripo.',
  },
  it: {
    title: 'Confrontare metodi e strumenti di modellazione 3D',
    description:
      'Confronti per il lavoro sul prodotto: modellatore o IA, 360 o 3D, fotogrammetria, Meshy e Tripo.',
  },
  pt: {
    title: 'Comparar métodos e ferramentas de modelação 3D',
    description:
      'Comparações para o trabalho de produto: modelador ou IA, 360 ou 3D, fotogrametria, Meshy e Tripo.',
  },
};

export const isComparePublished = (locale: Locale = 'en'): boolean =>
  isPublished('compare', locale);

/** True while a locale's comparisons are served for review only (noindex, listed nowhere). */
export const isCompareInReview = (locale: Locale = 'en'): boolean => isInReview('compare', locale);

/** One content file as a page, or the reason it cannot be one. */
export function parseComparePage(
  locale: Locale,
  slug: string,
  source: string,
): { page: ComparePage } | { error: string } {
  const { data, body } = parseFrontMatter(source);
  for (const field of ['group', 'title', 'description'] as const) {
    if (!data[field]) return { error: `missing ${field}` };
  }
  const publishAt = data.publishAt !== undefined ? parseContentDate(data.publishAt) : null;
  if (data.publishAt !== undefined && !publishAt) {
    return { error: `invalid publishAt "${data.publishAt}"` };
  }
  const text = fillPrices(stripComments(body));
  if (!text) return { error: 'empty body' };
  let author: BlogAuthor | undefined;
  if (data.author) {
    const authorType = AUTHOR_TYPES[(data.authorType ?? 'person').toLowerCase()];
    if (!authorType) return { error: `invalid authorType "${data.authorType}"` };
    author = {
      name: data.author,
      type: authorType,
      ...(data.authorUrl
        ? { url: data.authorUrl }
        : data.author === 'Jorge Rodríguez' && authorType === 'Person'
          ? { url: ROUTES.author.paths[locale] }
          : {}),
    };
  }
  return {
    page: {
      locale,
      slug,
      group: data.group as string,
      title: fillPrices(data.title as string),
      description: fillPrices(data.description as string),
      ...(data.keyword ? { keyword: data.keyword } : {}),
      ...(publishAt ? { publishAt } : {}),
      ...(data.updated ? { updated: data.updated } : {}),
      ...(author ? { author } : {}),
      ...(data.cta ? { cta: fillPrices(data.cta) } : {}),
      body: text,
      faq: faqFromBody(text),
      path: comparePath(locale, slug),
    },
  };
}

/** Every comparison page written for a locale, in file-name order. A malformed file is skipped. */
export function readComparePages(locale: Locale = 'en'): ComparePage[] {
  const dir = join(CONTENT_ROOT, locale);
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    files = [];
  }
  const pages: ComparePage[] = [];
  for (const file of files.sort()) {
    if (!file.endsWith('.md')) continue;
    const result = parseComparePage(
      locale,
      file.slice(0, -3),
      readFileSync(join(dir, file), 'utf8'),
    );
    if ('error' in result) {
      console.warn(`compare: skipping ${locale}/${file}: ${result.error}`);
      continue;
    }
    pages.push(result.page);
  }
  return pages;
}

const isOpen = (locale: Locale): boolean => isCompareInReview(locale) || isComparePublished(locale);

/** The page to serve at the locale's /compare/{slug}, or null (a 404) when it is not open. */
export function getComparePage(
  slug: string,
  locale: Locale = 'en',
  now: Date = new Date(),
): ComparePage | null {
  return listComparePages(locale, now).find((page) => page.slug === slug) ?? null;
}

/** Every comparison page of a locale, or an empty list when that locale is not open. */
export function listComparePages(locale: Locale = 'en', now: Date = new Date()): ComparePage[] {
  if (!isOpen(locale)) return [];
  return readComparePages(locale).filter(
    (page) => !page.publishAt || Date.parse(page.publishAt) <= now.getTime(),
  );
}

/**
 * The live URL of one comparison in each language. A locale is included only when its file
 * exists and the hub is published, so hreflang never points at a 404.
 */
export function compareLivePaths(
  group: string,
  now: Date = new Date(),
): Partial<Record<Locale, string>> {
  const paths: Partial<Record<Locale, string>> = {};
  for (const locale of LOCALES) {
    if (!isComparePublished(locale)) continue;
    const match = listComparePages(locale, now).find((page) => page.group === group);
    if (match) paths[locale] = match.path;
  }
  return paths;
}
