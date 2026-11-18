'use client';

import { ChevronDown, Coins, UserRound } from 'lucide-react';
import Link from 'next/link';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Labels are already translated. The menu stays a client component for open and close, and the
// header does not pull the Header catalogue into the browser bundle.
export type AccountMenuCopy = {
  /** Full pluralized balance, for example "120 credits". Null when the read failed. */
  balanceLabel: string | null;
  /** Locale-formatted number only, for the compact pill. Null when the read failed. */
  balanceNumber: string | null;
  accountLabel: string;
  /** Static credits link used when the balance itself could not be read. */
  creditsLinkLabel: string;
  menuLabel: string;
};

export type AccountMenuPlacement = 'marketing' | 'app';

// Marketing hides the control below sm (the phone row has no room) and spells the balance out
// from md. The app shell always shows it: a number and icon below sm, the full balance from sm.
const PILL = {
  marketing: { compact: 'inline-flex items-center gap-1 md:hidden', full: 'hidden md:inline' },
  app: { compact: 'inline-flex items-center gap-1 sm:hidden', full: 'hidden sm:inline' },
} as const;

function MenuLink({
  href,
  label,
  onChoose,
  children,
}: {
  href: string;
  label: string;
  onChoose: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      tabIndex={-1}
      aria-label={label}
      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm whitespace-nowrap outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={onChoose}
    >
      {children}
    </Link>
  );
}

// The signed-in account control: a pill with the balance, and a menu whose first line links to
// Credits. A failed balance read leaves the pill out and keeps the Credits link, with no error.
export function AccountMenu({
  copy,
  placement,
}: {
  copy: AccountMenuCopy;
  placement: AccountMenuPlacement;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const hasBalance = copy.balanceLabel !== null && copy.balanceNumber !== null;
  const creditsLabel = copy.balanceLabel ?? copy.creditsLinkLabel;
  const pill = PILL[placement];

  const items = () => Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
  const focusItem = (index: number) => {
    const all = items();
    if (all.length === 0) return;
    all[(index + all.length) % all.length]?.focus();
  };
  const close = (returnFocus: boolean) => {
    setIsOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      const focus = event.key === 'ArrowUp' ? -1 : 0;
      requestAnimationFrame(() => focusItem(focus));
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
    else if (event.key === 'End') focusItem(-1);
    else if (event.key === 'Escape') close(true);
    else if (event.key === 'Tab') {
      setIsOpen(false);
      return;
    } else return;
    event.preventDefault();
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

  return (
    <div
      ref={rootRef}
      data-slot="account-menu"
      data-placement={placement}
      className={cn('relative', placement === 'marketing' && 'max-sm:hidden')}
    >
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={hasBalance ? `${copy.accountLabel}, ${copy.balanceLabel}` : copy.accountLabel}
        className="gap-1.5 px-2 has-[>svg]:px-2"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={onButtonKey}
      >
        <UserRound aria-hidden />
        {hasBalance ? (
          <Badge
            variant="secondary"
            aria-hidden
            className="rounded-full px-1.5 font-mono font-medium text-secondary-foreground tabular-nums"
          >
            <span className={pill.compact}>
              <Coins aria-hidden className="size-3" />
              {copy.balanceNumber}
            </span>
            <span className={pill.full}>{copy.balanceLabel}</span>
          </Badge>
        ) : null}
        <ChevronDown
          aria-hidden
          className={cn('size-3 opacity-70', placement === 'app' && 'max-sm:hidden')}
        />
      </Button>
      <div
        ref={listRef}
        id={listId}
        role="menu"
        aria-label={copy.menuLabel}
        className={cn(
          'absolute top-full right-0 z-50 mt-1 min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          isOpen ? 'block' : 'hidden',
        )}
        onKeyDown={onListKey}
      >
        <MenuLink href="/credits" label={creditsLabel} onChoose={() => setIsOpen(false)}>
          <Coins aria-hidden className="size-4" />
          <span className="font-mono tabular-nums">{creditsLabel}</span>
        </MenuLink>
        <MenuLink href="/account" label={copy.accountLabel} onChoose={() => setIsOpen(false)}>
          <UserRound aria-hidden className="size-4" />
          {copy.accountLabel}
        </MenuLink>
      </div>
    </div>
  );
}

// The phone header menu (below sm) carries the balance, because the account pill is not in that row.
export function AccountCreditsLink({ label, className }: { label: string; className?: string }) {
  return (
    <Button
      variant="ghost"
      className={cn('justify-start', className)}
      data-slot="header-credits"
      asChild
    >
      <Link href="/credits" aria-label={label}>
        <Coins aria-hidden />
        <span className="font-mono tabular-nums">{label}</span>
      </Link>
    </Button>
  );
}
