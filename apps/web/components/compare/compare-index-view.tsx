import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { COMPARE_INDEX, compareHref, listComparePages } from '@/lib/compare/pages';
import { ROUTES } from '@/lib/seo/routes';

/**
 * The comparisons hub of one language: a short intro and the pages, each with its title
 * and description. A locale with no pages is not routed here.
 */
export async function CompareIndexView({ locale }: { locale: Locale }) {
  const t = await getTranslations('Blog');
  const pages = listComparePages(locale);
  const copy = COMPARE_INDEX[locale];
  const home = ROUTES.home.paths[locale];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6 sm:pt-14 sm:pb-28">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex items-center gap-2">
          <li className="shrink-0">
            <Link href={home} className="hover:text-foreground">
              {t('breadcrumb.home')}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-foreground">
            {t('comparisons.title')}
          </li>
        </ol>
      </nav>

      <header className="mt-10 max-w-4xl sm:mt-14">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {t('comparisons.title')}
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tighter text-balance sm:text-5xl lg:text-6xl">
          {copy.title}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl">
          {copy.description}
        </p>
      </header>

      {(['tools', 'methods'] as const).map((group) => (
        <section
          key={group}
          className="mt-12 max-w-3xl sm:mt-16"
          aria-labelledby={`compare-${group}`}
        >
          <h2 id={`compare-${group}`} className="text-2xl font-medium tracking-tight">
            {t(`comparisons.groups.${group}`)}
          </h2>
          <ul className="mt-5 divide-y border-t">
            {pages
              .filter(
                (page) =>
                  ['compare-meshy', 'compare-tripo', 'compare-polycam'].includes(page.group) ===
                  (group === 'tools'),
              )
              .map((page) => (
                <li key={page.slug} className="py-8">
                  <h3 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
                    <Link href={compareHref(page.locale, page.slug)} className="hover:underline">
                      {page.title}
                    </Link>
                  </h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground text-pretty">
                    {page.description}
                  </p>
                  <p className="mt-4">
                    <Link
                      href={compareHref(page.locale, page.slug)}
                      className="text-sm font-medium hover:underline"
                    >
                      {t('comparisons.read')}
                    </Link>
                  </p>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
