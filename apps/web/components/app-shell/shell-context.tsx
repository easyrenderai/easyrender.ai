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
  // The elements a page's content is drawn into: the two drawers, and the top bar's tab slot.
  nodes: Record<PanelSide | 'tabs', HTMLElement | null>;
  // Pages announce themselves so the shell knows whether a drawer has anything to show.
  register: (side: PanelSide) => () => void;
  // Opens the right drawer if it was closed, so a tab in the top bar never changes hidden content.
  reveal?: () => void;
};

const PanelSlotContext = createContext<PanelSlot | null>(null);

// Held by the shell: where each drawer's page content is drawn, and whether any page offers some.
export function usePanelSlotState() {
  const [leftNode, setLeftNode] = useState<HTMLElement | null>(null);
  const [rightNode, setRightNode] = useState<HTMLElement | null>(null);
  const [tabsNode, setTabsNode] = useState<HTMLElement | null>(null);
  const [counts, setCounts] = useState<Record<PanelSide, number>>({ left: 0, right: 0 });
  const register = useCallback((side: PanelSide) => {
    setCounts((current) => ({ ...current, [side]: current[side] + 1 }));
    return () => setCounts((current) => ({ ...current, [side]: current[side] - 1 }));
  }, []);
  return {
    setLeftNode,
    setRightNode,
    setTabsNode,
    hasRightContext: counts.right > 0,
    slot: {
      nodes: { left: leftNode, right: rightNode, tabs: tabsNode },
      register,
    } satisfies PanelSlot,
  };
}

export const PanelSlotProvider = PanelSlotContext.Provider;

// What a page offers for a drawer: the right one for what a render is made of and what was done to
// it (photo, views, details, history), the left one for a page's own list (library filters, chats). Inside the app shell, on a screen wide enough to show that drawer,
// it is drawn in the drawer. Anywhere else (a narrow screen, the marketing frame) it stays where
// it is written, in the page (unless `isInline` is false).
export function ShellPanel({
  side = 'right',
  isInline = true,
  children,
}: {
  side?: PanelSide;
  // False for content that only belongs in the drawer: where there is no drawer it is not drawn.
  isInline?: boolean;
  children: ReactNode;
}) {
  const slot = useContext(PanelSlotContext);
  const isWide = useMediaQuery(side === 'left' ? MD_QUERY : XL_QUERY);
  const register = slot?.register;
  // use-effect-audit: ignore reports this panel's mount and unmount to the shell, which has no event to hang it on
  useEffect(() => (register ? register(side) : undefined), [register, side]);
  const node = slot?.nodes[side];
  if (node && isWide) return createPortal(children, node);
  if (!isInline) return null;
  return (
    <div className={slot ? (side === 'left' ? 'md:hidden' : 'xl:hidden') : undefined}>
      {children}
    </div>
  );
}

// The tabs of a page's right drawer, drawn in the top bar where the drawer is open beside the page
// (icons only, the bar has no text). Anywhere else, a screen too narrow for the drawer or the
// marketing frame, they stay where they are written, above the content they switch.
export function ShellTabs({ children }: { children: ReactNode }) {
  const slot = useContext(PanelSlotContext);
  const isWide = useMediaQuery(XL_QUERY);
  const node = slot?.nodes.tabs;
  if (node && isWide) return createPortal(children, node);
  return children;
}

// Opens the right drawer when it is closed. A no-op outside the app shell.
export function useRevealRight() {
  return useContext(PanelSlotContext)?.reveal;
}
