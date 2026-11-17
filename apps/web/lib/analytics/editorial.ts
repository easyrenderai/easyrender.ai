export type ArticleCta = {
  article_group: string;
  article_locale: string;
  article_path: string;
  cta_position: 'mobile' | 'sidebar' | 'closing';
  cta_destination: string;
};

type Emit = (event: string, properties: ArticleCta) => boolean;
const TTL = 30 * 60 * 1000;

/** Memory only, like the existing cookieless PostHog policy. Never rewrites acquisition UTMs. */
export function createEditorialMetrics(emit: Emit, now = Date.now) {
  const visible = new Map<string, ArticleCta>();
  const seen = new Set<string>();
  let touch: { cta: ArticleCta; expiresAt: number } | null = null;
  const key = (cta: ArticleCta) => `${cta.article_path}:${cta.cta_position}`;
  function exposure(cta: ArticleCta) {
    const id = key(cta);
    if (!seen.has(id) && emit('article_cta_viewed', cta)) seen.add(id);
  }
  return {
    visibility(cta: ArticleCta, isVisible: boolean) {
      if (isVisible) {
        visible.set(key(cta), cta);
        exposure(cta);
      } else visible.delete(key(cta));
    },
    flush() {
      for (const cta of visible.values()) exposure(cta);
    },
    click(cta: ArticleCta) {
      exposure(cta);
      if (emit('article_cta_clicked', cta)) touch = { cta, expiresAt: now() + TTL };
    },
    context(): Partial<ArticleCta> {
      if (touch && now() >= touch.expiresAt) touch = null;
      return touch?.cta ?? {};
    },
    clear() {
      touch = null;
    },
  };
}
