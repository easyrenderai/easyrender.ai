import { ArrowRight, Download } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { AgentDemo } from '@/components/agent-demo';
import { ApiDemo } from '@/components/integrations/api-demo';
import { Section } from '@/components/landing';
import { ModelViewer } from '@/components/model-viewer';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';

/** Existing harness showcase assets, not a simulated customer run or a generated UI screenshot. */
export async function IntegrationResult({ locale, kind }: { locale: Locale; kind: 'api' | 'mcp' }) {
  const t = await getTranslations({ locale, namespace: 'IntegrationLanding.result' });
  return (
    <Section id="sample" title={t(`${kind}.title`)} description={t(`${kind}.description`)}>
      {kind === 'mcp' ? <AgentDemo locale={locale} /> : <ApiDemo locale={locale} />}
      <div className="grid gap-4 md:grid-cols-3">
        {(['photo', 'angles', 'model'] as const).map((step, index) => (
          <figure key={step} className="min-w-0 overflow-hidden rounded-xl border bg-card">
            <div className="relative aspect-square bg-muted/30">
              {step === 'model' ? (
                <ModelViewer
                  src="/showcase/armchair.glb"
                  alt={t('model.alt')}
                  interactive
                  autoRotate={false}
                />
              ) : (
                <Image
                  src={`/showcase/armchair${step === 'angles' ? '-angles' : ''}.jpg`}
                  alt={t(`${step}.alt`)}
                  fill
                  sizes="(max-width: 767px) 100vw, 33vw"
                  className="object-contain"
                />
              )}
            </div>
            <figcaption className="space-y-2 border-t p-5">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">0{index + 1}</span>
                <ArrowRight className="size-3" aria-hidden="true" />
                {t(`${step}.label`)}
              </p>
              <p className="text-sm leading-relaxed">{t(`${step}.body`)}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{t('note')}</p>
        <Button variant="outline" asChild>
          <a href="/showcase/armchair.glb" download="easyrender-sample-armchair.glb">
            <Download aria-hidden="true" /> {t('download')}
          </a>
        </Button>
      </div>
    </Section>
  );
}
