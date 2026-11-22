'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SETTINGS_NAV } from './nav';

// The pages behind the profile, as one row of links. Phones only: from `md` up the left drawer
// lists them.
export function SettingsNav() {
  const nav = useTranslations('DashboardNav');
  const pathname = usePathname();
  const current = SETTINGS_NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return (
    <Tabs value={current?.href ?? SETTINGS_NAV[0].href} className="mb-6">
      <TabsList aria-label={nav('account')} className="max-w-full justify-start overflow-x-auto">
        {SETTINGS_NAV.map((item) => (
          <TabsTrigger key={item.href} value={item.href} className="shrink-0 flex-none" asChild>
            <Link href={item.href}>{nav(item.key)}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
