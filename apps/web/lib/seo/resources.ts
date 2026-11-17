import type { Locale } from '@/i18n/config';
import { listPosts } from '@/lib/blog/posts';
import { listComparePages } from '@/lib/compare/pages';
import { isPublished, ROUTES } from './routes';

export type ResourceContext = 'home' | 'mcp' | 'api' | 'article';

/** Editorial destinations are published and selected by topic, never by scheduled file order. */
export function resourceLinks(locale: Locale, context: ResourceContext, now = new Date()) {
  const groups =
    context === 'home'
      ? ['how-to-make-a-3d-model-from-photos', '3d-models-for-ecommerce']
      : ['glb-file', '3d-models-for-ecommerce'];
  const posts = listPosts(locale, now);
  const guides = groups.flatMap((group) => {
    const post = posts.find((item) => item.group === group);
    return post ? [{ href: post.path, title: post.title }] : [];
  });
  const routes =
    context === 'mcp'
      ? (['api', 'compare', 'pricing'] as const)
      : context === 'api'
        ? (['mcp', 'compare', 'pricing'] as const)
        : context === 'article'
          ? (['compare', 'pricing', 'mcp', 'api'] as const)
          : (['compare'] as const);
  return {
    comparisons:
      context === 'article'
        ? []
        : listComparePages(locale)
            .filter((page) => ['compare-meshy', 'compare-tripo'].includes(page.group))
            .map((page) => ({ href: page.path, title: page.title })),
    guides: context === 'article' ? [] : guides,
    routes: routes
      .filter((key) => isPublished(key, locale))
      .map((key) => ({
        href: ROUTES[key].paths[locale],
        key: key === 'compare' ? ('comparisons' as const) : key,
      })),
  };
}
