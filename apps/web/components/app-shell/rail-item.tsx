'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 60;

// One rail destination with its quick peek. The peek is a hover card: it opens after a short
// hover (or keyboard focus), and it closes on pointer leave, on click and on navigation. It never
// opens for the page you are already on, so the rail icon of the active page stays quiet.
export function RailItem({
  isActive,
  isBottom,
  preview,
  children,
  className,
}: {
  isActive: boolean;
  isBottom?: boolean;
  preview: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  // A click focuses the link, which would reopen the peek. Hold it shut until the pointer leaves.
  const [isDismissed, setIsDismissed] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close on every navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <HoverCard
      open={isOpen && !isActive && !isDismissed}
      onOpenChange={setIsOpen}
      openDelay={OPEN_DELAY_MS}
      closeDelay={CLOSE_DELAY_MS}
    >
      <HoverCardTrigger asChild>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: these handlers only observe events that bubble up from the link inside */}
        <div
          className={className}
          onClickCapture={() => {
            setIsDismissed(true);
            setIsOpen(false);
          }}
          onPointerLeave={() => setIsDismissed(false)}
          onBlur={() => setIsDismissed(false)}
        >
          {children}
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align={isBottom ? 'end' : 'start'}
        sideOffset={6}
        className={cn('w-72 rounded-xl bg-card p-3.5 text-card-foreground shadow-lg')}
      >
        {preview}
      </HoverCardContent>
    </HoverCard>
  );
}
