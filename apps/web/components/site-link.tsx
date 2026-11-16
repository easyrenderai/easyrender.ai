'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { ComponentProps } from 'react';
import { needsDocumentNavigation } from '@/lib/locale-navigation';

/** Reload locale-dependent layouts when leaving a language or entering the redirecting home. */
export function SiteLink({ href, ...props }: ComponentProps<'a'> & { href: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  return needsDocumentNavigation(href, locale, pathname) ? (
    <a href={href} {...props} />
  ) : (
    <NextLink href={href} {...props} />
  );
}
