'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// What a render is made from and what was done to it, as two tabs: the photo, the generated views
// and the details, then the history of its edits. It is drawn in the right drawer of the app shell,
// and under the page where there is no drawer.
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
  return (
    <Tabs defaultValue="views" className="gap-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="views">{t('views')}</TabsTrigger>
        <TabsTrigger value="history">
          {t('history')}
          {historyCount > 0 && (
            <Badge variant="secondary" className="px-1.5 tabular-nums">
              {historyCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="views" className="space-y-4">
        {views}
      </TabsContent>
      <TabsContent value="history">{history}</TabsContent>
    </Tabs>
  );
}
