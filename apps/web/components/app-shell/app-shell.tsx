'use client';

import { PanelLeft, PanelRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useDefaultLayout, usePanelRef } from 'react-resizable-panels';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { AppBreadcrumb } from './app-breadcrumb';
import { ACCOUNT_NAV, APP_NAV, isActivePath, isSettingsPath } from './nav';
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
export function AppShell({ data, children }: { data: ShellData; children: ReactNode }) {
  const t = useTranslations('AppShell');
  const nav = useTranslations('DashboardNav');
  const pathname = usePathname();
  const isMd = useMediaQuery(MD_QUERY);
  const isXl = useMediaQuery(XL_QUERY);
  const { setLeftNode, setRightNode, hasLeftContext, hasRightContext, slot } = usePanelSlotState();
  const isSettings = isSettingsPath(pathname);
  const hasLeft = isMd && !isSettings;
  const hasRight = isXl && !isSettings && hasRightContext;
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

  const toggle = useCallback((panel: typeof leftRef) => {
    const handle = panel.current;
    if (!handle) return;
    if (handle.isCollapsed()) handle.expand();
    else handle.collapse();
  }, []);

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
  const account = ACCOUNT_NAV;

  const page = (
    <main className="h-full min-w-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:py-8">
        {children}
      </div>
    </main>
  );

  return (
    <div className="flex h-dvh flex-col bg-muted/40 md:flex-row">
      {/* Rail: the destinations as icons. Desktop only; phones get the bottom bar. */}
      <aside
        aria-label={t('navLabel')}
        className="relative z-30 hidden w-14 shrink-0 flex-col items-center gap-1 py-3 md:flex"
      >
        <Button variant="ghost" size="icon" className="mb-2 size-10" asChild>
          <Link href="/" aria-label={t('home')} title={t('home')}>
            <BrandMark className="size-[1.375rem]" />
          </Link>
        </Button>
        {[...APP_NAV, account].map((item) => {
          const isActive = isActivePath(pathname, item.href);
          const isBottom = item.href === account.href;
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
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold md:hidden">
            <BrandMark className="size-[1.375rem]" />
          </Link>
          <AppBreadcrumb />
          {hasRight && (
            <div className="ml-auto flex items-center gap-1">
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
            </div>
          )}
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden border-t bg-background md:mr-2 md:mb-2 md:rounded-lg md:border">
          <PanelSlotProvider value={slot}>
            {isMd && !isSettings ? (
              <ResizablePanelGroup
                orientation="horizontal"
                id={LAYOUT_KEY}
                defaultLayout={defaultLayout}
                onLayoutChanged={onLayoutChanged}
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
                  onResize={(size) => setIsLeftOpen(size.inPixels > 0)}
                >
                  <aside
                    aria-label={t('panel.title')}
                    inert={!isLeftOpen}
                    className="h-full overflow-hidden"
                  >
                    {hasLeftContext ? (
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
                      onResize={(size) => setIsRightOpen(size.inPixels > 0)}
                    >
                      <aside
                        aria-label={t('context.title')}
                        inert={!isRightOpen}
                        ref={setRightNode}
                        className="h-full overflow-y-auto"
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
        className="flex shrink-0 justify-around border-t bg-muted/40 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {[...APP_NAV, account].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
            className={cn(
              'flex min-w-14 flex-col items-center gap-0.5 rounded-md px-2 py-1 text-xs text-muted-foreground',
              isActivePath(pathname, item.href) && 'text-foreground',
            )}
          >
            <item.icon className="size-4" />
            {nav(item.key)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
