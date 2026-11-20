'use client';

import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { DEFAULT_LOCALE, HTML_LANG, isRoutableLocale } from '@/i18n/config';

/**
 * <html lang> from the `lang` route segment: /de/... is German, every other page English. The root
 * layout cannot read the language itself, because reading the request would make every page
 * dynamic. The app's pages, whose language is a preference and not a segment, correct it before
 * the first paint (components/intl-boundary), hence suppressHydrationWarning.
 */
export function RootHtml({ className, children }: { className: string; children: ReactNode }) {
  const { lang } = useParams<{ lang?: string }>();
  const locale = isRoutableLocale(lang) ? lang : DEFAULT_LOCALE;
  return (
    <html lang={HTML_LANG[locale]} className={className} suppressHydrationWarning>
      {children}
    </html>
  );
}
