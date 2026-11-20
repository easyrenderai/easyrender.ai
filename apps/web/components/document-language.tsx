'use client';

import { useCallback } from 'react';

/**
 * Sets <html lang> for a page whose language is not in its URL (the app, sign in). The root layout
 * writes it from the URL alone, so a visit that arrives by a client-side navigation from a
 * marketing page needs this, and the inline script in IntlBoundary covers a first load. A ref
 * callback, not an effect: it runs on mount and its cleanup gives the page back its old language
 * when the visitor moves on.
 */
export function DocumentLanguage({ lang }: { lang: string }) {
  const attach = useCallback(
    (node: HTMLSpanElement | null) => {
      if (!node) return;
      const root = node.ownerDocument.documentElement;
      const previous = root.lang;
      root.lang = lang;
      return () => {
        root.lang = previous;
      };
    },
    [lang],
  );
  return <span hidden ref={attach} />;
}
