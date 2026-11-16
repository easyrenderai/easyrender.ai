'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useSection } from '@/components/studio/use-section';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PARAM = 'platform';

// The first screen: the headline and the choice of store, over a hub piece drawn in points that
// part around the pointer. Every panel stays in the HTML (forceMount) so the setup of each
// platform is readable without JavaScript and by a crawler; the choice only decides which one is
// shown. It is kept in the URL, so a link or an ad can open the page on one platform.
export function PlatformPicker<Id extends string>({
  label,
  hero,
  platforms,
  panels,
}: {
  label: string;
  hero: ReactNode;
  platforms: readonly { id: Id; name: string; icon: ReactNode }[];
  panels: Record<Id, ReactNode>;
}) {
  const [value, setValue] = useState<string>(platforms[0].id);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get(PARAM);
    if (wanted && platforms.some((platform) => platform.id === wanted)) setValue(wanted);
  }, [platforms]);

  function choose(next: string) {
    setValue(next);
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM, next);
    window.history.replaceState(window.history.state, '', url);
  }

  const stage = useSection<HTMLDivElement>(
    async (root, scope) => {
      const { initPoints } = await import('@/lib/studio/sections/points');
      if (scope.alive) await initPoints(root, { scope });
    },
    'points',
    '0px',
    { idle: true },
  );

  return (
    <Tabs value={value} onValueChange={choose} className="gap-0">
      <div
        ref={stage}
        className="relative isolate flex min-h-[min(calc(100svh-3.5rem),820px)] flex-col items-center justify-center overflow-hidden px-6 py-16"
      >
        <div data-er="view" aria-hidden="true" className="absolute inset-0 -z-20 opacity-70" />
        {/* Keeps the headline readable where it crosses the densest part of the cloud. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-radial from-background/85 via-background/50 to-transparent to-75%"
        />
        <div className="mx-auto w-full max-w-3xl space-y-10 text-center">
          {hero}
          <div className="mx-auto w-full max-w-2xl space-y-3">
            <p id="platform-picker-label" className="text-sm text-muted-foreground">
              {label}
            </p>
            <TabsList
              aria-labelledby="platform-picker-label"
              className="grid h-auto w-full grid-cols-2 gap-1 border bg-card/80 p-1 backdrop-blur sm:grid-cols-4"
            >
              {platforms.map((platform) => (
                <TabsTrigger key={platform.id} value={platform.id} className="h-12 gap-2 px-3">
                  {platform.icon}
                  {platform.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        {platforms.map((platform) => (
          <TabsContent
            key={platform.id}
            value={platform.id}
            forceMount
            className="pt-10 data-[state=inactive]:hidden sm:pt-14"
          >
            {panels[platform.id]}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
