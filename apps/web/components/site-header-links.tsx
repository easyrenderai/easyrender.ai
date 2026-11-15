'use client';

import { LayoutDashboard } from 'lucide-react';
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
  dashboardLabel,
  isSignedIn,
}: {
  locale: Locale;
  connect: string;
  suffix: string;
  apiLabel: string;
  uploadLabel: string;
  dashboardLabel: string;
  isSignedIn: boolean;
}) {
  const action = headerPrimaryAction(locale, usePathname(), isSignedIn);
  const label = { api: apiLabel, upload: uploadLabel, dashboard: dashboardLabel, mcp: connect }[
    action.kind
  ];
  return (
    <Button size="sm" asChild>
      <Link href={action.href}>
        {action.kind === 'dashboard' ? <LayoutDashboard aria-hidden="true" /> : null}
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
