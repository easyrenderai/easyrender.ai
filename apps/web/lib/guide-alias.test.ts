import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n/config';
import { listPosts, readPosts } from '@/lib/blog/posts';
import { guideAlias } from './guide-alias';

const now = new Date('2026-11-17T10:00:00Z');
describe('localized article aliases', () => {
  it.each(LOCALES)('%s resolves native and translated English slugs', (locale) => {
    for (const post of listPosts(locale, now)) {
      expect(guideAlias(locale, post.slug, now)).toBe(post.path);
      const english = listPosts('en', now).find((item) => item.group === post.group);
      if (english) expect(guideAlias(locale, english.slug, now)).toBe(post.path);
    }
  });

  it.each(LOCALES)('%s does not invent mappings or expose scheduled articles', (locale) => {
    expect(guideAlias(locale, 'unknown-guide', now)).toBeNull();
    for (const post of readPosts(locale).filter((item) => Date.parse(item.date) > +now)) {
      expect(guideAlias(locale, post.slug, now)).toBeNull();
    }
  });
});
