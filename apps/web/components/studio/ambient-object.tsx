'use client';

import { cn } from '@/lib/utils';
import { useSection } from './use-section';

// One catalogue object turning slowly behind a page's heading, as a mesh. `isSolid` fades it to
// its textured render. Decorative: it takes no pointer events and is hidden from assistive tech.
// Its parent must be positioned (`relative isolate`); the object sits behind the parent's content.
export function AmbientObject({
  id,
  isSolid = false,
  className,
}: {
  id: string;
  isSolid?: boolean;
  className?: string;
}) {
  const ref = useSection<HTMLDivElement>(
    async (root, scope) => {
      const { initAmbient } = await import('@/lib/studio/sections/ambient');
      if (scope.alive) await initAmbient(root, { scope, id });
    },
    id,
    '0px',
    { idle: true },
  );
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-solid={isSolid ? '' : undefined}
      className={cn('ambient', className)}
    >
      <div className="ambient__view ambient__view--wire" data-er="wire" />
      <div className="ambient__view ambient__view--beauty" data-er="beauty" />
    </div>
  );
}
