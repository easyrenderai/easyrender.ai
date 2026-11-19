'use client';

import { Check, ChevronDown, Globe } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { LocaleLink } from '@/components/locale-link';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export type LocaleOption = { locale: Locale; path: string; hrefLang: string; name: string };

/**
 * The language dropdown in the header. The list is always in the HTML, only hidden while closed,
 * so every language stays a crawlable <a href hreflang>. A menu button: Enter, Space or the arrow
 * keys open it, the arrows, Home and End move through it, Escape, Tab or a click outside close it.
 */
export function LocaleMenu({
  current,
  options,
  label,
}: {
  current: Locale;
  options: LocaleOption[];
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const items = () => Array.from(listRef.current?.querySelectorAll('a') ?? []);
  const focusItem = (index: number) => {
    const all = items();
    all[(index + all.length) % all.length]?.focus();
  };
  const open = (focus: 'current' | 'first' | 'last') => {
    setIsOpen(true);
    // The list is display:none until the next paint, so focus after it shows.
    requestAnimationFrame(() => {
      const all = items();
      if (focus === 'last') focusItem(all.length - 1);
      else if (focus === 'first') focusItem(0);
      else
        focusItem(
          Math.max(
            0,
            options.findIndex((option) => option.locale === current),
          ),
        );
    });
  };
  const close = (returnFocus: boolean) => {
    setIsOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  // use-effect-audit: ignore document pointerdown listener that closes the menu on an outside click
  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [isOpen]);

  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open(event.key === 'ArrowUp' ? 'last' : 'current');
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      close(true);
    }
  };
  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items().indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === 'ArrowDown') focusItem(index + 1);
    else if (event.key === 'ArrowUp') focusItem(index - 1);
    else if (event.key === 'Home') focusItem(0);
    else if (event.key === 'End') focusItem(items().length - 1);
    else if (event.key === 'Escape') close(true);
    else if (event.key === 'Tab') {
      setIsOpen(false);
      return;
    } else return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div ref={rootRef} className="sm:relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={`${label}: ${options.find((option) => option.locale === current)?.name ?? current}`}
        className="gap-1 px-2 text-muted-foreground has-[>svg]:px-2"
        onClick={() => (isOpen ? close(false) : open('current'))}
        onKeyDown={onButtonKey}
      >
        <Globe aria-hidden />
        <span className="font-medium">{current.toUpperCase()}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-3 transition-transform motion-reduce:transition-none max-sm:hidden',
            isOpen && 'rotate-180',
          )}
        />
      </Button>
      <div
        ref={listRef}
        id={listId}
        role="menu"
        aria-label={label}
        className={cn(
          'absolute right-4 top-full z-50 mt-1 sm:right-0 min-w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          isOpen ? 'block' : 'hidden',
        )}
        onKeyDown={onListKey}
      >
        {/* Below sm the list hangs from the header row's right edge (site-header's relative row),
            not from the button, which a long CTA pushes too far left for it at 320px. */}
        {options.map((option) => {
          const isCurrent = option.locale === current;
          return (
            <LocaleLink
              key={option.locale}
              role="menuitem"
              tabIndex={-1}
              locale={option.locale}
              href={option.path}
              hrefLang={option.hrefLang}
              lang={option.hrefLang}
              aria-current={isCurrent ? 'true' : undefined}
              className={cn(
                'flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
                isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
              onClick={() => setIsOpen(false)}
            >
              {option.name}
              {isCurrent ? <Check aria-hidden className="size-4" /> : null}
            </LocaleLink>
          );
        })}
      </div>
    </div>
  );
}
