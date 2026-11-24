'use client';

import { Clock, Images } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { ShellPanel, ShellTabs, useRevealRight } from '@/components/app-shell/shell-context';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// What a render is made from and what was done to it, as two tabs: the photo, the generated views
// and the details, then the history of its edits. Where the right drawer is open the tabs are
// icons in the top bar (it carries no text) and the content is in the drawer. Without a drawer
// both sit in the page, the tabs with their labels above the content.
export function RenderContextTabs({
  views,
  history,
  historyCount,
}: {
  views: ReactNode;
  history: ReactNode;
  historyCount: number;
}) {
  const t = useTranslations('Render.tabs');
  const [tab, setTab] = useState('views');
  const reveal = useRevealRight();
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        setTab(next);
        reveal?.();
      }}
      className="gap-4"
    >
      <ShellTabs>
        <TabsList className="w-full xl:w-auto">
          <TabsTrigger value="views" title={t('views')} className="xl:px-3">
            <Images />
            <span className="xl:sr-only">{t('views')}</span>
          </TabsTrigger>
          <TabsTrigger value="history" title={t('history')} className="xl:px-3">
            <Clock />
            <span className="xl:sr-only">{t('history')}</span>
            {historyCount > 0 && (
              <Badge variant="secondary" className="px-1.5 tabular-nums xl:hidden">
                {historyCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </ShellTabs>
      <ShellPanel>
        <div className="xl:p-4">
          <TabsContent value="views" className="space-y-4">
            {views}
          </TabsContent>
          <TabsContent value="history">{history}</TabsContent>
        </div>
      </ShellPanel>
    </Tabs>
  );
}
