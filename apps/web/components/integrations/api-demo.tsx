import { RENDER_CREDITS } from '@easyrender/harness';
import { ArrowRight, Code2 } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';
import { versionedPublicModel } from '@/lib/public-models';

export async function ApiDemo({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'IntegrationLanding.apiDemo' });
  const response = JSON.stringify(
    { id: 'sample_armchair', status: 'ready', hasModel: true, credits: RENDER_CREDITS },
    null,
    2,
  );
  return (
    <Card className="mb-6 gap-4 text-left">
      <CardHeader className="gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Code2 aria-hidden="true" className="size-4" />
          {t('title')}
        </p>
        <p className="text-xs text-muted-foreground">{t('illustration')}</p>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Image
              src={versionedPublicModel('/showcase/armchair.jpg')}
              alt={t('photoAlt')}
              width={88}
              height={88}
              sizes="88px"
              quality={85}
              className="rounded-lg border"
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">{t('upload')}</p>
              <p className="break-words font-mono text-xs text-muted-foreground">
                armchair.jpg <ArrowRight aria-hidden="true" className="inline size-3" /> GLB
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{t('flow')}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('cost')}</p>
        </div>
        <div className="min-w-0 rounded-lg border bg-muted/30 p-4">
          <p className="mb-3 break-all font-mono text-xs">GET /api/renders/:id</p>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
            <code>{response}</code>
          </pre>
          <p className="mt-3 text-xs text-muted-foreground">{t('response')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
