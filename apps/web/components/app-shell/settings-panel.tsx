'use client';

import { Coins, Plug, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { SETTINGS_NAV } from './nav';

const ICONS = { profile: UserRound, credits: Coins, connectors: Plug } as const;

// The pages behind the profile, in the left drawer in place of the renders list. The rows are the
// renders rows: a tile, a title, one line under it, the current one highlighted.
export function SettingsPanel() {
  const t = useTranslations('AppShell');
  const nav = useTranslations('DashboardNav');
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center border-b bg-background px-4 py-2">
        <p className="text-sm font-medium text-muted-foreground">{t('settings.title')}</p>
      </div>
      <nav aria-label={t('settings.title')} className="flex flex-col gap-1 px-4 py-4">
        {SETTINGS_NAV.map((item) => {
          const Icon = ICONS[item.key];
          const isCurrent = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent ? 'page' : undefined}
              className={cn(
                '-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                isCurrent && 'bg-accent',
              )}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-lg border bg-muted text-muted-foreground">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{nav(item.key)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t(`settings.${item.key}`)}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
