import { config } from '@easyrender/core';
import { ChevronDownIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { IntegrationCosts } from '@/components/integrations/costs';
import { Section } from '@/components/landing';
import { McpConnect } from '@/components/mcp/mcp-connect';
import { McpSkill } from '@/components/mcp/mcp-skill';
import { ResourceLinks } from '@/components/resource-links';
import { StudioClosing } from '@/components/studio/proof';
import { StudioShell } from '@/components/studio/shell';
import { Card } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { localizedAuthPath } from '@/lib/app-locale';

const STEPS = ['photo', 'review', 'download'] as const;
const TOOLS = ['create_render', 'get_render', 'get_credits', 'render_3d'] as const;
const FAQ_KEYS = ['account', 'input', 'payment', 'output', 'scope', 'api'] as const;

export async function mcpFaqItems(locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'McpLanding.faq.items' });
  return FAQ_KEYS.map((key) => ({ question: t(`${key}.q`), answer: t(`${key}.a`) }));
}

export async function McpView({ locale }: { locale: Locale }) {
  const [t, user, items] = await Promise.all([
    getTranslations({ locale, namespace: 'McpLanding' }),
    currentUser().catch(() => null),
    mcpFaqItems(locale),
  ]);
  const accountHref = user
    ? '/connectors'
    : `${localizedAuthPath(locale, '/sign-up')}?next=%2Fconnectors`;
  const accountLabel = t(user ? 'connect.cta' : 'connect.signup');
  const mcpUrl = `${config.appUrl()}/api/mcp`;

  return (
    <StudioShell>
      {/* The page answers one question: how do I give my agent this. The answer is the first
          thing on it: pick the agent, copy its snippet. */}
      <section
        id="connect"
        aria-labelledby="mcp-hero-title"
        className="relative isolate flex min-h-[calc(100svh-3.5rem)] w-full scroll-mt-20 flex-col items-center justify-center px-4 py-14 text-center sm:px-6"
      >
        <div className="flex w-full max-w-3xl flex-col items-center gap-8">
          <div className="space-y-4">
            <h1
              id="mcp-hero-title"
              className="text-4xl font-medium tracking-tight text-balance sm:text-6xl"
            >
              {t('hero.title')}
            </h1>
            <p className="hero__lead mx-auto">{t('hero.subtitle')}</p>
          </div>
          <McpConnect
            url={mcpUrl}
            label={t('connect.guide')}
            accountHref={accountHref}
            accountLabel={accountLabel}
            keyNote={t('connect.security')}
          />
        </div>
      </section>

      <IntegrationCosts locale={locale} kind="mcp" />
      <Section
        id="how-it-works"
        title={t('workflow.title')}
        description={t('workflow.description')}
      >
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <ol className="space-y-8">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-5">
                <span className="pt-1 font-mono text-xs text-muted-foreground" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium">{t(`workflow.${step}.title`)}</h3>
                  <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                    {t(`workflow.${step}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Card className="min-w-0 gap-6 rounded-xl p-6 sm:p-8">
            <p className="text-xs text-muted-foreground">{t('workflow.exampleLabel')}</p>
            <blockquote className="text-lg leading-relaxed">{t('workflow.prompt')}</blockquote>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('workflow.exampleNote')}
            </p>
            <div className="border-t pt-5">
              <h3 className="mb-4 text-sm font-medium">{t('workflow.toolsLabel')}</h3>
              <dl className="space-y-4">
                {TOOLS.map((tool) => (
                  <div key={tool} className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-3">
                    <dt className="font-mono text-xs">{tool}</dt>
                    <dd className="text-xs leading-relaxed text-muted-foreground">
                      {t(`workflow.tools.${tool}`)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>
        </div>
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {t('workflow.limit')}
        </p>
      </Section>

      <McpSkill locale={locale} />
      <Section id="faq" title={t('faq.title')} narrow>
        <div className="sec__column">
          {items.map((item) => (
            <details key={item.question} className="group border-b last:border-b-0">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-md py-5 text-left font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <h3 className="text-base font-medium">{item.question}</h3>
                <ChevronDownIcon
                  className="size-4 shrink-0 translate-y-1 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </Section>
      <ResourceLinks locale={locale} context="mcp" />
      <StudioClosing title={t('closing.title')} label={accountLabel} href={accountHref} />
    </StudioShell>
  );
}
