import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArticleShell } from '@/components/blog/article-shell';
import { DATE_FORMAT } from '@/components/blog/post-card';
import { ComparisonChoices } from '@/components/compare/comparison-choices';
import type { ComparePage } from '@/lib/compare/pages';
import { ROUTES } from '@/lib/seo/routes';

/**
 * One comparison page, on the guide template: the same header, reading measure, table of
 * contents, tables and FAQ accordion, and the same closing call to the free preview. It has no
 * related guides or link back to the hub, because it is not a guide. Every word comes
 * from the content file or from the Blog strings it shares with the guides.
 */
export async function CompareView({ page }: { page: ComparePage }) {
  const [t, format] = await Promise.all([
    getTranslations({ locale: page.locale, namespace: 'Blog' }),
    getFormatter({ locale: page.locale }),
  ]);
  const home = ROUTES.home.paths[page.locale];

  return (
    <ArticleShell
      locale={page.locale}
      group={page.group}
      path={page.path}
      title={page.title}
      description={page.description}
      body={page.body}
      cta={page.cta}
      t={t}
      breadcrumb={
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
      }
      byline={
        (page.author || page.updated) && (
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
        )
      }
      beforeBody={
        ['compare-meshy', 'compare-tripo'].includes(page.group) && (
          <ComparisonChoices
            copy={{
              title: t('comparisons.choices.title'),
              photo: {
                need: t('comparisons.choices.photo.need'),
                tools: t('comparisons.choices.photo.tools'),
                check: t('comparisons.choices.photo.check'),
              },
              views: {
                need: t('comparisons.choices.views.need'),
                tools: t('comparisons.choices.views.tools'),
                check: t('comparisons.choices.views.check'),
              },
              animation: {
                need: t('comparisons.choices.animation.need'),
                tools: t('comparisons.choices.animation.tools'),
                check: t('comparisons.choices.animation.check'),
              },
            }}
          />
        )
      }
    />
  );
}
