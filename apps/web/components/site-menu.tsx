'use client';

import { Menu, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The header menu below the `xl` breakpoint, where the section links and (on phones) sign-in no
 * longer fit in one row. Signed in, the credit balance is a row in this menu below `sm`. The languages live in their own dropdown (components/locale-menu). The panel is always in the HTML, only hidden, so its
 * links stay crawlable. It closes on a link click, Escape or a click outside.
 */
export function SiteMenu({
  openLabel,
  closeLabel,
  children,
}: {
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // use-effect-audit: ignore document keydown and pointerdown listeners that close the menu
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="xl:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-expanded={isOpen}
        aria-controls="site-menu"
        aria-label={isOpen ? closeLabel : openLabel}
        onClick={() => setIsOpen((value) => !value)}
      >
        {isOpen ? <X /> : <Menu />}
      </Button>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: closes the panel after a link inside it is followed. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: links handle their own keyboard activation. */}
      <div
        id="site-menu"
        className={cn(
          'absolute inset-x-0 top-full border-b bg-background shadow-sm',
          isOpen ? 'block' : 'hidden',
        )}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) setIsOpen(false);
        }}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
