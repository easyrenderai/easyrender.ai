'use client';

import type { ReactNode } from 'react';
import { useViewer } from '@/components/use-viewer';

/**
 * One of two server-rendered versions of a piece of a cached page: the visitor's, which is in the
 * HTML, and the member's, which replaces it once /api/viewer says the visitor is signed in.
 */
export function ByViewer({ visitor, member }: { visitor: ReactNode; member: ReactNode }) {
  const { data } = useViewer();
  return data?.signedIn ? member : visitor;
}
