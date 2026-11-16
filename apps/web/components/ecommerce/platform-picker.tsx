'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PARAM = 'platform';

// The first choice on the page: which store the visitor runs. Every panel stays in the HTML
// (forceMount) so the setup of each platform is readable without JavaScript and by a crawler;
// the choice only decides which one is shown. It is kept in the URL, so a link or an ad can open
// the page on one platform.
export function PlatformPicker<Id extends string>({
  label,
  platforms,
  panels,
}: {
  label: string;
  platforms: readonly { id: Id; name: string }[];
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

  return (
    <Tabs value={value} onValueChange={choose} className="gap-0">
      <div className="mx-auto w-full max-w-2xl space-y-3 text-center">
        <p id="platform-picker-label" className="text-sm text-muted-foreground">
          {label}
        </p>
        <TabsList
          aria-labelledby="platform-picker-label"
          className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4"
        >
          {platforms.map((platform) => (
            <TabsTrigger key={platform.id} value={platform.id} className="h-10 px-3">
              {platform.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
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
    </Tabs>
  );
}
