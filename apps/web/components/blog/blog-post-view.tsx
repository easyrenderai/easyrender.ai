import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArticleShell } from '@/components/blog/article-shell';
import { type BlogPost, modifiedDate, relatedPosts } from '@/lib/blog/posts';
import { ROUTES } from '@/lib/seo/routes';
import { DATE_FORMAT, PostCard } from './post-card';

/**
 * One guide, the same template in every language: the words come from the content file. The shell
 * holds the template it shares with the comparisons; this adds the byline, the price reference, the
 * related guides and the way back to the hub.
 */
export async function BlogPostView({ post }: { post: BlogPost }) {
  const [t, format] = await Promise.all([getTranslations('Blog'), getFormatter()]);
  const hub = ROUTES.blog.paths[post.locale];
  const related = relatedPosts(post);
  const modified = modifiedDate(post);

  return (
    <ArticleShell
      locale={post.locale}
      group={post.group}
      path={post.path}
      title={post.title}
      description={post.description}
      body={post.body}
      cta={post.cta}
      t={t}
      modelHint={t('post.modelHint')}
      breadcrumb={
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
      }
      lead={
        /\$|USD/.test(post.body) && (
          <p className="mt-6 text-sm text-muted-foreground">
            <Link href={ROUTES.pricing.paths[post.locale]} className="underline underline-offset-4">
              {t('post.priceReference')}
            </Link>
          </p>
        )
      }
      byline={
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
      }
      footer={
        <>
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
        </>
      }
    />
  );
}
