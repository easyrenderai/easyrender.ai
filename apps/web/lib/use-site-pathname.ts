'use client';

import { usePathname } from 'next/navigation';
import { publicPath } from '@/lib/priced-route';

/**
 * The path the visitor sees. A priced page is built under /p/{key}/..., and while it is built the
 * router reports that path; in the browser it reports the address bar. This hook gives both the
 * address, so server and browser render the same thing.
 */
export function useSitePathname(): string {
  return publicPath(usePathname());
}
