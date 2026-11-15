import { ArrowRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { DATE_FORMAT } from '@/components/blog/post-card';
import { ResourceLinks } from '@/components/resource-links';
import { Button } from '@/components/ui/button';
import { Markdown, type TocEntry, tocOf } from '@/lib/blog/markdown';
import { isLiveBlogLink, readingMinutes } from '@/lib/blog/posts';
import type { ComparePage } from '@/lib/compare/pages';
import { ROUTES } from '@/lib/seo/routes';

function TocList({ entries }: { entries: TocEntry[] }) {
  return (
    <ol className="space-y-2.5 text-sm">
      {entries.map((entry) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            className="block leading-snug text-muted-foreground transition-colors hover:text-foreground"
          >
            {entry.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * One comparison page, on the guide template: the same header, reading measure, table of
 * contents, tables and FAQ accordion, and the same closing call to the free preview. It has no
 * byline, related guides or link back to the hub, because it is not a guide. Every word comes
 * from the content file or from the Blog strings it shares with the guides.
 */
export async function CompareView({ page }: { page: ComparePage }) {
  const [t, format] = await Promise.all([
    getTranslations({ locale: page.locale, namespace: 'Blog' }),
    getFormatter({ locale: page.locale }),
  ]);
  const home = ROUTES.home.paths[page.locale];
  const toc = tocOf(page.body);

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
          <li className="shrink-0">
            <Link href={ROUTES.compare.paths[page.locale]} className="hover:text-foreground">
              {t('comparisons.title')}
            </Link>
          </li>
          <li aria-hidden>/</li>
          {/* One line, so a long title cannot re-wrap and shift the page when the font loads. */}
          <li aria-current="page" className="min-w-0 truncate text-foreground">
            {page.title}
          </li>
        </ol>
      </nav>

      <article>
        <header className="mt-10 max-w-4xl sm:mt-14">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground tabular-nums">
            {t('post.readingTime', { minutes: readingMinutes(page.body) })}
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tighter text-balance sm:text-5xl lg:text-6xl">
            {page.title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl">
            {page.description}
          </p>
          {(page.author || page.updated) && (
            <p className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-5 text-sm text-muted-foreground tabular-nums">
              {page.author &&
                (page.author.url ? (
                  <Link
                    href={page.author.url}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {t('post.by', { author: page.author.name })}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">
                    {t('post.by', { author: page.author.name })}
                  </span>
                ))}
              {page.author && page.updated && <span aria-hidden>·</span>}
              {page.updated && (
                <time dateTime={page.updated}>
                  {t('post.updated', {
                    date: format.dateTime(new Date(`${page.updated}T00:00:00Z`), DATE_FORMAT),
                  })}
                </time>
              )}
            </p>
          )}
        </header>

        <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16 xl:gap-24">
          <div className="min-w-0">
            {toc.length > 0 && (
              <details className="group mb-10 rounded-xl border lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {t('post.toc')}
                  <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <nav aria-label={t('post.toc')} className="border-t px-4 py-4">
                  <TocList entries={toc} />
                </nav>
              </details>
            )}

            <div className="text-base leading-7 sm:text-lg sm:leading-8 [&>*:first-child]:mt-0 [&>:not([data-wide])]:max-w-xl">
              <Markdown
                source={page.body}
                isLive={isLiveBlogLink(page.locale)}
                locale={page.locale}
              />
            </div>

            <aside className="mt-20 max-w-xl rounded-2xl border bg-muted/40 p-6 sm:p-10">
              <p className="text-2xl font-semibold tracking-tight text-balance">
                {t('post.cta.title')}
              </p>
              {page.cta && (
                <p className="mt-3 leading-relaxed text-muted-foreground text-pretty">{page.cta}</p>
              )}
              <Button asChild size="lg" className="mt-6">
                <Link href={`${home}#try`}>
                  {t('post.cta.button')}
                  <ArrowRight />
                </Link>
              </Button>
            </aside>
          </div>

          {toc.length > 0 && (
            <aside className="hidden lg:block">
              <nav aria-label={t('post.toc')} className="sticky top-24 border-l pl-6">
                <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {t('post.toc')}
                </p>
                <TocList entries={toc} />
              </nav>
            </aside>
          )}
        </div>
      </article>
      <ResourceLinks locale={page.locale} context="article" />
    </div>
  );
}
