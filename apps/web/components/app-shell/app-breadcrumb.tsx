'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ACCOUNT_NAV, APP_NAV, isActivePath, SETTINGS_NAV } from './nav';

// The page name lives here, so the pages themselves carry no title or description. Nested pages
// add a crumb each: the module first, then the page.
export function AppBreadcrumb() {
  const t = useTranslations('AppShell');
  const nav = useTranslations('DashboardNav');
  const pathname = usePathname();
  const module = [...APP_NAV, ACCOUNT_NAV].find((item) => isActivePath(pathname, item.href));
  const crumbs: { href: string; label: string }[] = [
    { href: module?.href ?? '/dashboard', label: nav(module?.key ?? 'overview') },
  ];
  // A render's page is one level inside the Library.
  if (pathname.startsWith('/r/')) crumbs.push({ href: pathname, label: t('model') });
  // Credits and Connectors sit one level inside Account.
  const setting = SETTINGS_NAV.find(
    (item) => item.href !== ACCOUNT_NAV.href && pathname === item.href,
  );
  if (setting) crumbs.push({ href: setting.href, label: nav(setting.key) });
  return (
    <nav aria-label={t('breadcrumb')} className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && <span className="text-muted-foreground">/</span>}
              {isLast ? (
                <span aria-current="page" className="truncate font-medium">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="truncate text-muted-foreground">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
