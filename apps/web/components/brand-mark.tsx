import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

// The solid part is the lit side of the sphere on the site's always-dark canvas.
const SPHERE = 'M24 7A17 17 0 0 1 24 41A6.5 17 0 0 1 24 7Z';

export function BrandMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn('size-5 shrink-0', className)}
      {...props}
    >
      <g transform="rotate(-38 24 24)">
        <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="2" />
        <path d={SPHERE} fill="currentColor" />
      </g>
    </svg>
  );
}
