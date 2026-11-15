import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { listPosts } from '@/lib/blog/posts';
import { ROUTES } from '@/lib/seo/routes';

export async function AuthorView({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'Author' });
  const posts = listPosts(locale).filter((post) => post.author.name === 'Jorge Rodríguez');
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Jorge Rodríguez</h1>
      <p className="text-lg leading-relaxed text-muted-foreground">{t('bio')}</p>
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">{t('methodTitle')}</h2>
        <p className="leading-relaxed text-muted-foreground">{t('method')}</p>
        <p className="leading-relaxed text-muted-foreground">{t('disclosure')}</p>
        <Link className="underline underline-offset-4" href={ROUTES.compare.paths[locale]}>
          {t('comparisons')}
        </Link>
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">{t('guides')}</h2>
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.path}>
              <Link className="underline underline-offset-4" href={post.path}>
                {post.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
