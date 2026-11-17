import type { Locale } from '@/i18n/config';
import { getPost, listPosts } from '@/lib/blog/posts';

/** Preserve a native slug, or follow an English article's translation group. Never guess. */
export function guideAlias(locale: Locale, slug: string, now = new Date()): string | null {
  const native = getPost(locale, slug, now);
  if (native) return native.path;
  const english = getPost('en', slug, now);
  if (!english) return null;
  return listPosts(locale, now).find((post) => post.group === english.group)?.path ?? null;
}
