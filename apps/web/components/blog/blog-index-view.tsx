import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { listPosts } from '@/lib/blog/posts';
import { listComparePages } from '@/lib/compare/pages';
import { isPublished, ROUTES } from '@/lib/seo/routes';
import { FeaturedPostCard, PostCard } from './post-card';

/**
 * The guides hub of one language, laid out like an editorial front page: a headline, the newest
 * guide as a large card, and the others in a grid. With one guide it is the headline and that
 * card; with none it says so. Guides carry no category in their files, so there is no filter.
 */
export async function BlogIndexView({ locale }: { locale: Locale }) {
  const t = await getTranslations('Blog');
  const [latest, ...rest] = listPosts(locale);
  const comparisons = isPublished('compare', locale) ? listComparePages(locale) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6 sm:pt-14 sm:pb-28">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href={ROUTES.home.paths[locale]} className="hover:text-foreground">
              {t('breadcrumb.home')}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-foreground">
            {t('index.title')}
          </li>
        </ol>
      </nav>

      <header className="mt-10 max-w-4xl space-y-5 sm:mt-14">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {t('index.title')}
        </p>
        <h1 className="text-4xl font-semibold tracking-tighter text-balance sm:text-5xl lg:text-6xl">
          {t('index.headline')}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl">
          {t('index.description')}
        </p>
      </header>

      {latest ? (
        <div className="mt-12 border-t pt-10 sm:mt-16 sm:pt-12">
          <FeaturedPostCard post={latest} label={t('index.latest')} />
        </div>
      ) : (
        <p className="mt-12 rounded-2xl border border-dashed p-8 text-muted-foreground text-pretty sm:mt-16 sm:p-12">
          {t('index.empty')}
        </p>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="more-guides" className="mt-20 border-t pt-10 sm:mt-24">
          <h2
            id="more-guides"
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            {t('index.more')}
          </h2>
          <ul className="mt-8 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <li key={post.slug} className="flex">
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {comparisons.length > 0 && (
        <section aria-labelledby="comparisons" className="mt-20 border-t pt-10 sm:mt-24">
          <h2
            id="comparisons"
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            {t('comparisons.title')}
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground text-pretty">
            {t('comparisons.description')}
          </p>
          <ul className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {comparisons.map((page) => (
              <li key={page.slug}>
                <Link href={page.path} className="group block">
                  <h3 className="font-medium tracking-tight text-balance group-hover:underline">
                    {page.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {page.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
