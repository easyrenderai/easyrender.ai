'use client';

import NextLink from 'next/link';
import { useLocale } from 'next-intl';
import type { ComponentProps } from 'react';
import { needsDocumentNavigation } from '@/lib/locale-navigation';
import { useSitePathname } from '@/lib/use-site-pathname';

/** Reload locale-dependent layouts when leaving a language or entering the redirecting home. */
export function SiteLink({ href, ...props }: ComponentProps<'a'> & { href: string }) {
  const locale = useLocale();
  const pathname = useSitePathname();
  return needsDocumentNavigation(href, locale, pathname) ? (
    <a href={href} {...props} />
  ) : (
    <NextLink href={href} {...props} />
  );
}
