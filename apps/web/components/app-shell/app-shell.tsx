'use client';

import { PanelLeft, PanelRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, Suspense, useCallback, useEffect, useState } from 'react';
import { useDefaultLayout, usePanelRef } from 'react-resizable-panels';
import { AppLocalePicker } from '@/components/app-locale-picker';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { AppBreadcrumb } from './app-breadcrumb';
import { ACCOUNT_NAV, APP_NAV, isActivePath, isAdminPath, isSettingsPath } from './nav';
import { RailItem } from './rail-item';
import { RailPreview } from './rail-preview';
import { RendersPanel } from './renders-panel';
import {
  MD_QUERY,
  PanelSlotProvider,
  useMediaQuery,
  usePanelSlotState,
  XL_QUERY,
} from './shell-context';
import { isInFlight, type ShellData } from './types';

const LAYOUT_KEY = 'er-shell';
// Drawer widths are in pixels. The page keeps at least MAIN_MIN, so the drawers cannot crowd it out.
const LEFT = { initial: 288, min: 220, max: 480 };
const RIGHT = { initial: 360, min: 280, max: 560 };
const MAIN_MIN = 360;
// Opening or closing a drawer slides it over 250ms with the studio easing. Only motion-safe users
// get the transition; with reduced motion the drawers snap as before.
const PANEL_TRANSITION =
  'motion-safe:data-[toggling]:[&>[data-panel]]:transition-[flex-grow] motion-safe:data-[toggling]:[&>[data-panel]]:duration-250 motion-safe:data-[toggling]:[&>[data-panel]]:ease-[cubic-bezier(0.2,0.7,0.2,1)]';
// While a drawer narrows, its content is clipped at the drawer's minimum width instead of
// re-wrapping on every frame. The panel's own scroll container is hidden so no scrollbar flashes.
const CLIP = { overflow: 'hidden' } as const;

// Drawer widths are remembered per browser. Storage can be missing (server render) or blocked
// (private windows), and then the drawers simply start at their default width.
const layoutStorage = {
  getItem(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Not persisted; the drawers still resize for this visit.
    }
  },
};

type RailKind = 'overview' | 'library' | 'account';
const RAIL_KINDS: Record<string, RailKind> = {
  overview: 'overview',
  library: 'library',
  account: 'account',
};

// The signed-in app: a thin rail of destinations that peek at their page on hover, then the page
// in one rounded block. Left drawer: the renders list. Right drawer: what a page offers as its
// context (a render's parts). Both drawers resize by dragging, remember their width, and collapse.
// Settings pages (Account, Credits, Connectors) are full pages with no drawers. Below `md` the
// rail becomes a bottom bar and the drawers are hidden.
export function AppShell({
  data,
  account = null,
  children,
}: {
  data: ShellData;
  // The signed-in account control, rendered by the server frame so the balance stays a server read.
  account?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations('AppShell');
  const nav = useTranslations('DashboardNav');
  const pathname = usePathname();
  const isMd = useMediaQuery(MD_QUERY);
  const isXl = useMediaQuery(XL_QUERY);
  const { setLeftNode, setRightNode, hasLeftContext, hasRightContext, slot } = usePanelSlotState();
  const isAdmin = isAdminPath(pathname);
  const isLibrary = pathname === '/library' || pathname.startsWith('/library/');
  // Overview is one focused upload, so it has no renders drawer (that list was a second scrollbar
  // beside the page; the Library has the renders). Settings and admin are full pages too.
  const isOverview = pathname === '/dashboard';
  const isFullPage = isSettingsPath(pathname) || isAdmin || isOverview;
  const hasLeft = isMd && !isFullPage;
  const hasRight = isXl && !isFullPage && hasRightContext;
  // A render page also offers its edit history, so the left drawer gets a second tab.
  const [leftTab, setLeftTab] = useState('history');

  const leftRef = usePanelRef();
  const rightRef = usePanelRef();
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const panelIds = ['main', ...(hasLeft ? ['left'] : []), ...(hasRight ? ['right'] : [])].sort();
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: LAYOUT_KEY,
    panelIds,
    storage: layoutStorage,
  });

  // The drawers only animate when a toggle opens or closes them. Dragging the handle stays 1:1 with
  // the pointer, so the flag is cleared when the animation ends or a drag starts.
  const [isToggling, setIsToggling] = useState(false);

  const toggle = useCallback((panel: typeof leftRef) => {
    const handle = panel.current;
    if (!handle) return;
    setIsToggling(true);
    if (handle.isCollapsed()) handle.expand();
    else handle.collapse();
  }, []);

  // use-effect-audit: ignore subscribes to the window keydown event for the toggle shortcut
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggle(leftRef);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, leftRef]);

  const inFlight = data.renders.filter((render) => isInFlight(render.status)).length;
  const accountNav = ACCOUNT_NAV;

  // `w-full`: settings, admin and phone pages sit in a plain flex row, not a resizable panel. Without
  // it the scroll container shrinks to the content column and its scrollbar floats mid-page.
  const page = (
    // overflow-x is clip, not auto: a chart, date field or tooltip that paints past the column
    // must not open a horizontal scroller. iOS Safari scrolls that scroller to keep the tooltip
    // in view and the page slides left under the header.
    <main className="h-full w-full min-w-0 overflow-x-clip overflow-y-auto">
      <div
        className={cn(
          'mx-auto flex min-h-full min-w-0 flex-col px-4 py-6 sm:px-6 lg:py-8',
          // Admin tables and charts need more room than the app's pages.
          isAdmin ? 'max-w-[90rem]' : 'max-w-5xl',
        )}
      >
        {children}
      </div>
    </main>
  );

  return (
    // svh, not dvh: on iPhone Safari the dynamic viewport still reaches under the bottom toolbar
    // when the document itself does not scroll, which hides the tab labels.
    <div className="flex h-svh flex-col overflow-x-clip bg-muted/40 md:flex-row">
      {/* Rail: the destinations as icons. Desktop only; phones get the bottom bar. */}
      <aside
        aria-label={t('navLabel')}
        className="relative z-30 hidden w-14 shrink-0 flex-col items-center gap-1 py-3 md:flex"
      >
        <Button variant="ghost" size="icon" className="mb-2 size-10" asChild>
          <Link href="/dashboard" aria-label={t('home')} title={t('home')}>
            <BrandMark className="size-[1.375rem]" />
          </Link>
        </Button>
        {[...APP_NAV, accountNav].map((item) => {
          const isActive = isActivePath(pathname, item.href);
          const isBottom = item.href === accountNav.href;
          return (
            <RailItem
              key={item.href}
              isActive={isActive}
              isBottom={isBottom}
              className={cn('relative', isBottom && 'mt-auto')}
              preview={
                <RailPreview
                  kind={RAIL_KINDS[item.key] ?? 'overview'}
                  label={nav(item.key)}
                  href={item.href}
                  data={data}
                />
              }
            >
              <Button
                variant="ghost"
                size="icon"
                className={cn('relative size-10', isActive && 'bg-accent')}
                asChild
              >
                <Link
                  href={item.href}
                  aria-label={nav(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon />
                  {item.key === 'library' && inFlight > 0 && (
                    <span
                      className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 text-xs leading-none font-semibold text-background tabular-nums"
                      role="img"
                      aria-label={t('preview.building')}
                    >
                      {inFlight}
                    </span>
                  )}
                </Link>
              </Button>
            </RailItem>
          );
        })}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 px-3 md:pl-1">
          {hasLeft && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => toggle(leftRef)}
              aria-label={t('toggleSidebar')}
              aria-pressed={isLeftOpen}
              title={t('toggleSidebar')}
            >
              <PanelLeft />
            </Button>
          )}
          <Link
            href="/dashboard"
            aria-label={t('home')}
            className="-ml-1 flex size-10 items-center justify-center font-semibold md:hidden"
          >
            <BrandMark className="size-[1.375rem]" />
          </Link>
          <div className="min-w-0 flex-1">
            <AppBreadcrumb />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {account}
            {!isAdmin && (
              <div className="relative">
                <Suspense>
                  <AppLocalePicker />
                </Suspense>
              </div>
            )}
            {hasRight && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => toggle(rightRef)}
                aria-label={t('toggleContext')}
                aria-pressed={isRightOpen}
                title={t('toggleContext')}
              >
                <PanelRight />
              </Button>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden border-t bg-background md:mr-2 md:mb-2 md:rounded-lg md:border">
          <PanelSlotProvider value={slot}>
            {isMd && !isFullPage ? (
              <ResizablePanelGroup
                orientation="horizontal"
                id={LAYOUT_KEY}
                defaultLayout={defaultLayout}
                onLayoutChanged={onLayoutChanged}
                data-toggling={isToggling || undefined}
                className={PANEL_TRANSITION}
                onPointerDownCapture={() => setIsToggling(false)}
                onTransitionEnd={(event) => {
                  if (event.propertyName === 'flex-grow') setIsToggling(false);
                }}
              >
                <ResizablePanel
                  id="left"
                  panelRef={leftRef}
                  defaultSize={LEFT.initial}
                  minSize={LEFT.min}
                  maxSize={LEFT.max}
                  collapsible
                  collapsedSize={0}
                  groupResizeBehavior="preserve-pixel-size"
                  style={CLIP}
                  onResize={(size) => setIsLeftOpen(size.inPixels > 0)}
                >
                  <aside
                    aria-label={t('panel.title')}
                    inert={!isLeftOpen}
                    className="h-full min-w-55 overflow-hidden"
                  >
                    {isLibrary ? (
                      // The library draws its own filters and folders here.
                      <div ref={setLeftNode} className="h-full overflow-y-auto" />
                    ) : hasLeftContext ? (
                      <Tabs value={leftTab} onValueChange={setLeftTab} className="h-full gap-0">
                        <TabsList className="m-2 grid grid-cols-2">
                          <TabsTrigger value="renders">{t('panel.title')}</TabsTrigger>
                          <TabsTrigger value="history">{t('history.title')}</TabsTrigger>
                        </TabsList>
                        <TabsContent value="renders" className="min-h-0">
                          <RendersPanel renders={data.renders} now={data.now} />
                        </TabsContent>
                        {/* Kept mounted so the page can draw its history into it. */}
                        <TabsContent
                          value="history"
                          forceMount
                          className="min-h-0 overflow-y-auto data-[state=inactive]:hidden"
                        >
                          <div ref={setLeftNode} />
                        </TabsContent>
                      </Tabs>
                    ) : (
                      <RendersPanel renders={data.renders} now={data.now} />
                    )}
                  </aside>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel id="main" minSize={MAIN_MIN}>
                  {page}
                </ResizablePanel>
                {hasRight && (
                  <>
                    <ResizableHandle />
                    <ResizablePanel
                      id="right"
                      panelRef={rightRef}
                      defaultSize={RIGHT.initial}
                      minSize={RIGHT.min}
                      maxSize={RIGHT.max}
                      collapsible
                      collapsedSize={0}
                      groupResizeBehavior="preserve-pixel-size"
                      style={CLIP}
                      onResize={(size) => setIsRightOpen(size.inPixels > 0)}
                    >
                      <aside
                        aria-label={t('context.title')}
                        inert={!isRightOpen}
                        ref={setRightNode}
                        className="h-full min-w-70 overflow-y-auto"
                      />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            ) : (
              page
            )}
          </PanelSlotProvider>
        </div>
      </div>

      {/* Bottom bar on phones. */}
      <nav
        aria-label={t('navLabel')}
        className="flex shrink-0 border-t bg-muted/40 px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {[...APP_NAV, accountNav].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
            className={cn(
              'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-center text-xs leading-tight text-muted-foreground',
              isActivePath(pathname, item.href) && 'text-foreground',
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="line-clamp-2 w-full">{nav(item.key)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
