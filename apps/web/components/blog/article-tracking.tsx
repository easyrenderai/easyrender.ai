'use client';

import { useEffect, useRef } from 'react';
import { articleMetrics } from '@/lib/analytics/browser';
import type { ArticleCta } from '@/lib/analytics/editorial';

/** Observe the actual buttons, so CSS-hidden mobile/desktop copies do not inflate impressions. */
export function ArticleTracking({
  group,
  locale,
  path,
}: {
  group: string;
  locale: string;
  path: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // use-effect-audit: ignore observes the rendered article links with an IntersectionObserver and click listeners
  useEffect(() => {
    const root = ref.current?.closest('[data-editorial-root]');
    if (!root) return;
    const links = new Map<Element, ArticleCta>();
    for (const link of root.querySelectorAll<HTMLAnchorElement>('a[data-article-cta]')) {
      const position = link.dataset.articleCta;
      if (position !== 'mobile' && position !== 'sidebar' && position !== 'closing') continue;
      const destination = new URL(link.href);
      links.set(link, {
        article_group: group,
        article_locale: locale,
        article_path: path,
        cta_position: position,
        cta_destination: destination.pathname + destination.hash,
      });
    }
    const inView = new Set<Element>();
    const update = () => {
      for (const [link, cta] of links) {
        articleMetrics.visibility(cta, inView.has(link) && document.visibilityState === 'visible');
      }
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.5)
                  inView.add(entry.target);
                else inView.delete(entry.target);
              }
              update();
            },
            { threshold: [0, 0.5] },
          );
    for (const link of links.keys()) observer?.observe(link);
    const click = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      if (event instanceof MouseEvent && event.button > 1) return;
      const link = event.target.closest('a[data-article-cta]');
      const cta = link && links.get(link);
      if (cta) articleMetrics.click(cta);
    };
    root.addEventListener('click', click);
    root.addEventListener('auxclick', click);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer?.disconnect();
      root.removeEventListener('click', click);
      root.removeEventListener('auxclick', click);
      document.removeEventListener('visibilitychange', update);
      for (const cta of links.values()) articleMetrics.visibility(cta, false);
    };
  }, [group, locale, path]);
  return <span ref={ref} hidden />;
}
