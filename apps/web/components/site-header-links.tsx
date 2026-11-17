'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { SiteLink as Link } from '@/components/site-link';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { headerPrimaryAction, headerSectionHref } from '@/lib/site-navigation';

// Layouts persist across client navigation. Resolve section links from the live pathname.
export function HeaderNavItem({
  locale,
  href,
  hash,
  isMobile = false,
  children,
}: {
  locale: Locale;
  href: string;
  hash?: string;
  isMobile?: boolean;
  children: ReactNode;
}) {
  const path = usePathname();
  return (
    <Button
      variant="ghost"
      size={isMobile ? 'default' : 'sm'}
      className={isMobile ? 'justify-start' : undefined}
      asChild
    >
      <Link
        href={hash ? headerSectionHref(locale, path, hash) : href}
        className="text-muted-foreground"
      >
        {children}
      </Link>
    </Button>
  );
}

export function HeaderConnect({
  locale,
  connect,
  suffix,
  apiLabel,
  uploadLabel,
  isSignedIn,
}: {
  locale: Locale;
  connect: string;
  suffix: string;
  apiLabel: string;
  uploadLabel: string;
  isSignedIn: boolean;
}) {
  const action = headerPrimaryAction(locale, usePathname(), isSignedIn);
  // The session entry already links to the dashboard in both header layouts.
  if (action.kind === 'dashboard') return null;
  const label = { api: apiLabel, upload: uploadLabel, mcp: connect }[action.kind];
  return (
    <Button size="sm" className={isSignedIn ? 'max-sm:hidden' : undefined} asChild>
      <Link href={action.href}>
        <span>
          {label}
          {action.kind === 'mcp' && suffix ? (
            <span className="hidden sm:inline"> {suffix}</span>
          ) : null}
        </span>
      </Link>
    </Button>
  );
}
