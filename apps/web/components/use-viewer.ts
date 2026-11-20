'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import type { ViewerResponse } from '@/lib/viewer';

async function fetchViewer(locale: string, signal: AbortSignal): Promise<ViewerResponse> {
  const response = await fetch(`/api/viewer?locale=${encodeURIComponent(locale)}`, {
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error('viewer unavailable');
  const viewer = (await response.json()) as ViewerResponse;
  // The browser analytics read the pricing arm and the experiment subject from the page element.
  const root = document.documentElement;
  root.dataset.pricingVariant = viewer.pricing.variant;
  if (viewer.pricing.subject) root.dataset.pricingSubject = viewer.pricing.subject;
  else delete root.dataset.pricingSubject;
  return viewer;
}

/**
 * Who is looking at this marketing page. The page is static, so the answer arrives after it: a
 * visitor sees the signed-out header until it does, and every call in one page shares one request.
 * `data` stays undefined when the request fails, which reads as a visitor.
 */
export function useViewer({ isEnabled = true }: { isEnabled?: boolean } = {}) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['viewer', locale],
    queryFn: ({ signal }) => fetchViewer(locale, signal),
    staleTime: 30_000,
    enabled: isEnabled,
  });
}
