'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';

export const MD_QUERY = '(min-width: 768px)';
export const XL_QUERY = '(min-width: 1280px)';

// A media query read without a layout flash on later renders. The server cannot know the screen,
// so the first render is `false` (the narrow layout) and the browser value follows at once.
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export type PanelSide = 'left' | 'right';

type PanelSlot = {
  // The elements inside the drawers that a page's content is drawn into.
  nodes: Record<PanelSide, HTMLElement | null>;
  // Pages announce themselves so the shell knows whether a drawer has anything to show.
  register: (side: PanelSide) => () => void;
};

const PanelSlotContext = createContext<PanelSlot | null>(null);

// Held by the shell: where each drawer's page content is drawn, and whether any page offers some.
export function usePanelSlotState() {
  const [leftNode, setLeftNode] = useState<HTMLElement | null>(null);
  const [rightNode, setRightNode] = useState<HTMLElement | null>(null);
  const [counts, setCounts] = useState<Record<PanelSide, number>>({ left: 0, right: 0 });
  const register = useCallback((side: PanelSide) => {
    setCounts((current) => ({ ...current, [side]: current[side] + 1 }));
    return () => setCounts((current) => ({ ...current, [side]: current[side] - 1 }));
  }, []);
  return {
    setLeftNode,
    setRightNode,
    hasLeftContext: counts.left > 0,
    hasRightContext: counts.right > 0,
    slot: { nodes: { left: leftNode, right: rightNode }, register } satisfies PanelSlot,
  };
}

export const PanelSlotProvider = PanelSlotContext.Provider;

// What a page offers for a drawer: the right one for the parts a render is made of, the left one
// for the history of its edits. Inside the app shell, on a screen wide enough to show that drawer,
// it is drawn in the drawer. Anywhere else (a narrow screen, the marketing frame) it stays where
// it is written, in the page.
export function ShellPanel({
  side = 'right',
  children,
}: {
  side?: PanelSide;
  children: ReactNode;
}) {
  const slot = useContext(PanelSlotContext);
  const isWide = useMediaQuery(side === 'left' ? MD_QUERY : XL_QUERY);
  const register = slot?.register;
  useEffect(() => (register ? register(side) : undefined), [register, side]);
  const node = slot?.nodes[side];
  if (node && isWide) return createPortal(children, node);
  return (
    <div className={slot ? (side === 'left' ? 'md:hidden' : 'xl:hidden') : undefined}>
      {children}
    </div>
  );
}
