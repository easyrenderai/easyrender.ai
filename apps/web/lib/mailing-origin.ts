import type { MailingRoute } from '@easyrender/core';
import { LOCALES } from '@/i18n/config';
import { readPosts } from '@/lib/blog/posts';
import { ROUTES } from '@/lib/seo/routes';

// Exact editorial decisions; translation frontmatter ties native slugs to the reviewed source.
const BLOG_ROUTES: Record<string, MailingRoute> = {
  '3d-models-for-ecommerce': 'ecommerce',
  'product-photography-for-ecommerce': 'product_views',
  'sell-vintage-furniture-online': 'furniture',
  'glb-file': 'formats',
  'usdz-file': 'formats',
  'how-to-make-a-3d-model': 'general',
  'how-to-make-a-3d-model-from-photos': 'method_fit',
};
export const mailingOriginMap: Record<string, MailingRoute> = { '/shopify': 'ecommerce' };
for (const key of ['home', 'mcp', 'api'] as const) {
  for (const locale of ROUTES[key].published)
    mailingOriginMap[ROUTES[key].paths[locale]] = key === 'home' ? 'general' : key;
}
for (const locale of LOCALES) {
  for (const post of readPosts(locale)) {
    const route = BLOG_ROUTES[post.group];
    if (route) mailingOriginMap[post.path] = route;
  }
}
// A source may be scheduled for future publication. Mapping does not publish or link it.
// Unknown paths remain general in core: no substring, keyword, or guessed profession routing.
