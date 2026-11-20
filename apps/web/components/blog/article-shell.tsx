import '@/components/blog/editorial.css';
import { ArrowRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ArticlePromo } from '@/components/blog/article-promo';
import { ArticleTracking } from '@/components/blog/article-tracking';
import { ResourceLinks } from '@/components/resource-links';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { Markdown, type TocEntry, tocOf } from '@/lib/blog/markdown';
import { isLiveBlogLink, readingMinutes } from '@/lib/blog/posts';
import { landingIntent } from '@/lib/landing-intent';

export type BlogTranslator = Awaited<ReturnType<typeof getTranslations<'Blog'>>>;

function TocList({ entries }: { entries: TocEntry[] }) {
  return (
    <ol className="space-y-2.5 text-sm">
      {entries.map((entry) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            className="block py-1 leading-snug text-muted-foreground transition-colors hover:text-foreground"
          >
            {entry.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * The template under every guide and every comparison: breadcrumb, header, reading measure with the
 * table of contents beside it on wide screens, the closing call to the free preview, and a footer
 * slot. A page passes what differs (breadcrumb, byline, a block before the body, what follows the
 * article) and the words come from the content file and the Blog strings, so both read the same.
 */
export async function ArticleShell({
  locale,
  group,
  path,
  title,
  description,
  body,
  cta,
  t,
  breadcrumb,
  lead,
  byline,
  beforeBody,
  modelHint,
  footer,
}: {
  locale: Locale;
  group: string;
  path: string;
  title: string;
  description: string;
  body: string;
  /** Closing copy written for this page; the landing intent supplies one when it has none. */
  cta?: string;
  t: BlogTranslator;
  breadcrumb: ReactNode;
  /** Above the header, inside the article (the guide's price reference). */
  lead?: ReactNode;
  /** The line under the description: author and dates. */
  byline?: ReactNode;
  /** Between the contents/promo on a phone and the body. */
  beforeBody?: ReactNode;
  modelHint?: string;
  /** After the resource links, outside the article. */
  footer?: ReactNode;
}) {
  const intent = landingIntent(group, locale);
  const nextT = await getTranslations({ locale, namespace: 'LandingIntent' });
  const isInspection = intent.action === 'inspect';
  const ctaBody = isInspection ? nextT(`${intent.key}.body`) : (cta ?? nextT(`${intent.key}.body`));
  const promoCopy = {
    title: isInspection ? nextT(`${intent.key}.title`) : t('post.promo.title'),
    solution: isInspection ? ctaBody : t('post.promo.solution'),
    visual: t('post.promo.visual'),
    play: t('post.promo.play'),
    pause: t('post.promo.pause'),
    button: nextT(intent.action),
    disclosure: isInspection ? nextT('sampleDisclosure') : t('post.promo.disclosure'),
  };
  const toc = tocOf(body);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-20 sm:px-6 sm:pt-14 sm:pb-28">
      {breadcrumb}

      <article data-editorial-root>
        <ArticleTracking group={group} locale={locale} path={path} />
        {lead}
        <header className="mt-10 max-w-4xl sm:mt-14">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground tabular-nums">
            {t('post.readingTime', { minutes: readingMinutes(body) })}
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tighter text-balance sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl">
            {description}
          </p>
          {byline}
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
              <ArticlePromo position="mobile" locale={locale} href={intent.href} copy={promoCopy} />
            </div>

            {beforeBody}

            <div className="editorial-body text-base sm:text-lg">
              <Markdown
                source={body}
                isLive={isLiveBlogLink(locale)}
                locale={locale}
                modelHint={modelHint}
              />
            </div>

            <aside className="mt-20 max-w-xl rounded-2xl border bg-muted/40 p-6 sm:p-10">
              <p className="text-2xl font-semibold tracking-tight text-balance">
                {nextT(`${intent.key}.title`)}
              </p>
              <p className="mt-3 leading-relaxed text-muted-foreground text-pretty">{ctaBody}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href={intent.href} data-article-cta="closing">
                    {nextT(intent.action)}
                    <ArrowRight />
                  </Link>
                </Button>
                {isInspection && (
                  <Button asChild variant="outline" size="lg">
                    <Link href={intent.uploadHref} data-article-cta="closing">
                      {nextT('upload')}
                    </Link>
                  </Button>
                )}
              </div>
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
                <ArticlePromo locale={locale} href={intent.href} copy={promoCopy} />
              </div>
            </aside>
          )}
        </div>
      </article>
      <ResourceLinks locale={locale} context="article" />
      {footer}
    </div>
  );
}
