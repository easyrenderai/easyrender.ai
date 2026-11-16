import { Images, LayoutDashboard, Library, UserRound } from 'lucide-react';

// The app's destinations. The rail (desktop) and the bottom bar (phones) read this list, so a new
// page is added in one place. Labels live in messages under DashboardNav. Credits and connectors
// are settings, so they live behind Account, not in the rail.
export const APP_NAV = [
  { href: '/dashboard', key: 'overview', icon: LayoutDashboard },
  { href: '/library', key: 'library', icon: Library },
  { href: '/views', key: 'views', icon: Images },
] as const;

export const ACCOUNT_NAV = { href: '/account', key: 'account', icon: UserRound } as const;

// The pages behind the profile. They are full pages with no drawers, and the Account rail item
// stays active on every one of them.
export const SETTINGS_NAV = [
  { href: '/account', key: 'profile' },
  { href: '/credits', key: 'credits' },
  { href: '/connectors', key: 'connectors' },
] as const;

export const isSettingsPath = (pathname: string) =>
  SETTINGS_NAV.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

// A render's page (/r/{id}) belongs to the Library it was opened from.
export const isActivePath = (pathname: string, href: string) =>
  href === ACCOUNT_NAV.href
    ? isSettingsPath(pathname)
    : pathname === href ||
      pathname.startsWith(`${href}/`) ||
      (href === '/library' && pathname.startsWith('/r/'));
