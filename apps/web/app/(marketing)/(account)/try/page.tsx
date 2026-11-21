import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PromptBar } from '@/components/prompt-bar';
import { StudioShell } from '@/components/studio/shell';
import { noindexMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Try');
  return noindexMetadata(t('metaTitle'), t('metaDescription'));
}

// The test flow behind the home's "Try it free": one photo, a free preview that starts at once,
// and a sign-up on the result page to see it. The upload itself is the PromptBar.
export default async function TryPage() {
  const t = await getTranslations('Try');
  const steps = [t('step1'), t('step2'), t('step3')];
  return (
    <StudioShell>
      <section className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-16 sm:py-24">
        <header className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t('title')}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">{t('description')}</p>
        </header>
        <PromptBar />
        <ol className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-3 sm:flex-col sm:text-center">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium tabular-nums text-foreground">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>
    </StudioShell>
  );
}
