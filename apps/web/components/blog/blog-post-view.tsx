import '@/components/blog/editorial.css';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArticlePromo } from '@/components/blog/article-promo';
import { ResourceLinks } from '@/components/resource-links';
import { Button } from '@/components/ui/button';
import { Markdown, type TocEntry, tocOf } from '@/lib/blog/markdown';
import {
  type BlogPost,
  isLiveBlogLink,
  modifiedDate,
  readingMinutes,
  relatedPosts,
} from '@/lib/blog/posts';
import { landingIntent } from '@/lib/landing-intent';
import { ROUTES } from '@/lib/seo/routes';
import { DATE_FORMAT, PostCard } from './post-card';

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
 * One guide, the same template in every language: the words come from the content file. The body
 * runs at a reading measure (about 70 characters, pictures and tables run wider) with the table of contents beside it on wide
 * screens, then the call to the free preview and the guides to read next.
 */
export async function BlogPostView({ post }: { post: BlogPost }) {
  const [t, format] = await Promise.all([getTranslations('Blog'), getFormatter()]);
  const hub = ROUTES.blog.paths[post.locale];
  const intent = landingIntent(post.group, post.locale);
  const nextT = await getTranslations({ locale: post.locale, namespace: 'LandingIntent' });
  const toc = tocOf(post.body);
  const related = relatedPosts(post);
  const modified = modifiedDate(post);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-20 sm:px-6 sm:pt-14 sm:pb-28">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href={ROUTES.home.paths[post.locale]} className="hover:text-foreground">
              {t('breadcrumb.home')}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={hub} className="hover:text-foreground">
              {t('index.title')}
            </Link>
          </li>
        </ol>
      </nav>

      <article>
        {/\$|USD/.test(post.body) && (
          <p className="mt-6 text-sm text-muted-foreground">
            <Link href={ROUTES.pricing.paths[post.locale]} className="underline underline-offset-4">
              {t('post.priceReference')}
            </Link>
          </p>
        )}
        <header className="mt-10 max-w-4xl sm:mt-14">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground tabular-nums">
            {t('post.readingTime', { minutes: readingMinutes(post.body) })}
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tighter text-balance sm:text-5xl lg:text-6xl">
            {post.title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl">
            {post.description}
          </p>
          <p className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-5 text-sm text-muted-foreground tabular-nums">
            {post.author.url ? (
              <Link
                href={post.author.url}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {t('post.by', { author: post.author.name })}
              </Link>
            ) : (
              <span className="font-medium text-foreground">
                {t('post.by', { author: post.author.name })}
              </span>
            )}
            <span aria-hidden>·</span>
            <time dateTime={post.date}>
              {t('post.published', { date: format.dateTime(new Date(post.date), DATE_FORMAT) })}
            </time>
            {modified !== post.date && (
              <>
                <span aria-hidden>·</span>
                <time dateTime={modified}>
                  {t('post.updated', { date: format.dateTime(new Date(modified), DATE_FORMAT) })}
                </time>
              </>
            )}
          </p>
        </header>

        <div className="mt-14 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-14 xl:gap-20">
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

            <div className="mb-10 max-w-sm lg:hidden">
              <ArticlePromo
                locale={post.locale}
                href={intent.href}
                copy={{
                  title: t('post.promo.title'),
                  solution: t('post.promo.solution'),
                  visual: t('post.promo.visual'),
                  play: t('post.promo.play'),
                  pause: t('post.promo.pause'),
                  button: nextT(intent.action),
                  disclosure: t('post.promo.disclosure'),
                }}
              />
            </div>

            <div className="editorial-body text-base sm:text-lg">
              <Markdown
                source={post.body}
                isLive={isLiveBlogLink(post.locale)}
                locale={post.locale}
                modelHint={t('post.modelHint')}
              />
            </div>

            <aside className="mt-20 max-w-xl rounded-2xl border bg-muted/40 p-6 sm:p-10">
              <p className="text-2xl font-semibold tracking-tight text-balance">
                {nextT(`${intent.key}.title`)}
              </p>
              {post.cta && (
                <p className="mt-3 leading-relaxed text-muted-foreground text-pretty">{post.cta}</p>
              )}
              <Button asChild size="lg" className="mt-6">
                <Link href={intent.href}>
                  {nextT(intent.action)}
                  <ArrowRight />
                </Link>
              </Button>
            </aside>
          </div>

          {toc.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-24 max-h-[calc(100dvh-7rem)] space-y-5 overflow-y-auto pb-4">
                <nav
                  aria-label={t('post.toc')}
                  className="max-h-[min(26dvh,14rem)] overflow-y-auto border-l pl-5 pr-2"
                >
                  <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    {t('post.toc')}
                  </p>
                  <TocList entries={toc} />
                </nav>
                <ArticlePromo
                  locale={post.locale}
                  href={intent.href}
                  copy={{
                    title: t('post.promo.title'),
                    solution: t('post.promo.solution'),
                    visual: t('post.promo.visual'),
                    play: t('post.promo.play'),
                    pause: t('post.promo.pause'),
                    button: nextT(intent.action),
                    disclosure: t('post.promo.disclosure'),
                  }}
                />
              </div>
            </aside>
          )}
        </div>
      </article>
      <ResourceLinks locale={post.locale} context="article" />

      {related.length > 0 && (
        <section aria-labelledby="related-guides" className="mt-24 border-t pt-10">
          <h2
            id="related-guides"
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            {t('post.related')}
          </h2>
          <ul className="mt-8 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((other) => (
              <li key={other.slug} className="flex">
                <PostCard post={other} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href={hub}
        className="mt-16 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {t('post.backToIndex')}
      </Link>
    </div>
  );
}
