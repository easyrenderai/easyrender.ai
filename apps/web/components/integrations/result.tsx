import { ArrowRight, Download } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { AgentDemo } from '@/components/agent-demo';
import { BlogModel } from '@/components/blog/blog-model';
import { ApiDemo } from '@/components/integrations/api-demo';
import { IntegrationLink } from '@/components/integrations/link';
import { Section } from '@/components/landing';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { SHOWCASE } from '@/lib/showcase';

function armchairSample() {
  const entry = SHOWCASE.find((item) => item.slug === 'armchair');
  const angles = entry?.angles;
  if (!entry || angles == null) {
    throw new Error('The armchair showcase is missing its angle sheet');
  }
  return { model: entry.model, photo: entry.photo, angles };
}

const sample = armchairSample();

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
                <BlogModel
                  src={sample.model}
                  alt={t('model.alt')}
                  poster={{ src: '/blog/models/armchair.webp', width: 960, height: 960 }}
                  orbit="30deg 75deg auto"
                  hint={t('model.hint')}
                />
              ) : (
                <Image
                  src={step === 'angles' ? sample.angles : sample.photo}
                  alt={t(`${step}.alt`)}
                  fill
                  sizes="(max-width: 767px) 100vw, 33vw"
                  quality={85}
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
      <details className="mt-5 rounded-xl border p-5 text-sm">
        <summary className="cursor-pointer font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t('evidence.title')}
        </summary>
        <div className="mt-4 grid gap-4 text-muted-foreground md:grid-cols-2">
          <p>{t('evidence.provenance')}</p>
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">{t('evidence.measurementTitle')}</h3>
            <p>{t('evidence.measurement')}</p>
          </div>
        </div>
      </details>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{t('note')}</p>
        <Button variant="outline" asChild>
          <IntegrationLink
            channel={kind}
            action="sample_download"
            href={sample.model}
            download="easyrender-sample-armchair.glb"
          >
            <Download aria-hidden="true" /> {t('download')}
          </IntegrationLink>
        </Button>
      </div>
    </Section>
  );
}
