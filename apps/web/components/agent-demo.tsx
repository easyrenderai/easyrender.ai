import { Bot, Wrench } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';

const CALLS = ['create_render', 'get_render', 'get_credits', 'render_3d'] as const;

/** An illustrative workflow, never a live progress indicator or a completed customer run. */
export async function AgentDemo({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'AgentDemo' });
  return (
    <Card className="mb-6 gap-4 text-left">
      <CardHeader className="gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Bot aria-hidden="true" className="size-4" />
          {t('window')}
        </p>
        <p className="text-xs text-muted-foreground">{t('illustration')}</p>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <p className="rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed">{t('ask')}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{t('approval')}</p>
          <p className="border-t pt-4 text-sm leading-relaxed">{t('budget')}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('budgetNote')}</p>
        </div>
        <ol className="space-y-3">
          {CALLS.map((tool) => (
            <li key={tool} className="border-b pb-3 last:border-0">
              <p className="flex items-center gap-2 font-mono text-xs">
                <Wrench aria-hidden="true" className="size-3.5 shrink-0" />
                {tool}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t(`calls.${tool}`)}
              </p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
