'use client';

import { type ComponentProps, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * The state both header menus (account, language) share: open or closed, the three refs, the list
 * id, the focus helpers over the list's links, and the click outside that closes it.
 */
export function useMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

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

  // use-effect-audit: ignore document pointerdown listener that closes the menu on an outside click
  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [isOpen]);

  return { isOpen, setIsOpen, rootRef, buttonRef, listRef, listId, items, focusItem, close };
}

/** The button that opens a header menu: a small ghost button wired to the menu's list. */
export function MenuTrigger({
  menu,
  ...props
}: { menu: Pick<ReturnType<typeof useMenu>, 'buttonRef' | 'isOpen' | 'listId'> } & Omit<
  ComponentProps<typeof Button>,
  'ref' | 'variant' | 'size'
>) {
  return (
    <Button
      ref={menu.buttonRef}
      variant="ghost"
      size="sm"
      aria-haspopup="menu"
      aria-expanded={menu.isOpen}
      aria-controls={menu.listId}
      {...props}
    />
  );
}
