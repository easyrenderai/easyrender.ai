import { config } from '@easyrender/core';
import { ArrowRight, Box, ChevronDownIcon, Code2, Repeat2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { IntegrationCosts } from '@/components/integrations/costs';
import { IntegrationLink } from '@/components/integrations/link';
import { IntegrationResult } from '@/components/integrations/result';
import { Pricing, Section } from '@/components/landing';
import { McpSkill } from '@/components/mcp/mcp-skill';
import { McpSetup } from '@/components/mcp-setup';
import { ResourceLinks } from '@/components/resource-links';
import { StudioHero } from '@/components/studio/hero';
import { StudioClosing, StudioCompatibility } from '@/components/studio/proof';
import { StudioShell } from '@/components/studio/shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';

const CLIENTS = ['Claude', 'Claude Code', 'Claude Desktop', 'Cursor', 'VS Code'];
const USE_CASES = [
  { key: 'catalog', icon: Box },
  { key: 'web', icon: Code2 },
  { key: 'workflow', icon: Repeat2 },
] as const;
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
  const accountHref = user ? '/connectors' : '/sign-up?next=%2Fconnectors';
  const mcpUrl = `${config.appUrl()}/api/mcp`;

  return (
    <StudioShell>
      <StudioHero
        ctaHref="#connect"
        copy={{
          title: t('hero.title'),
          subtitle: t('hero.subtitle'),
          cta: t('hero.cta'),
          note: t('hero.note'),
        }}
      />
      <StudioCompatibility />
      <Section title={t('intro.title')} description={t('intro.description')}>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pb-8 text-sm">
          <p className="text-muted-foreground">{t('clientsLabel')}</p>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {CLIENTS.map((client) => (
              <li key={client}>{client}</li>
            ))}
          </ul>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {USE_CASES.map(({ key, icon: Icon }) => (
            <div key={key} className="space-y-3 border-t pt-6">
              <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-xl font-medium">{t(`intro.${key}.title`)}</h3>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                {t(`intro.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <IntegrationResult locale={locale} kind="mcp" />
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

      <Section id="connect" title={t('connect.title')} description={t('connect.description')}>
        <div className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="min-w-0 space-y-5">
            <h3 className="text-xl font-medium">{t('connect.accountTitle')}</h3>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {t('connect.accountBody')}
            </p>
            <Button asChild size="lg">
              <IntegrationLink channel="mcp" action="setup" href={accountHref}>
                {t('connect.cta')} <ArrowRight aria-hidden="true" />
              </IntegrationLink>
            </Button>
            <div>
              <Button variant="outline" asChild>
                <a href="#agent-skill">{t('skill.cta')}</a>
              </Button>
            </div>
            <dl className="space-y-2 pt-3 text-sm">
              <dt className="text-muted-foreground">{t('connect.endpoint')}</dt>
              <dd className="break-all font-mono text-xs">{mcpUrl}</dd>
            </dl>
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              {t('connect.security')}
            </p>
          </div>
          <Card className="min-w-0 gap-5 rounded-xl p-5 sm:p-7">
            <h3 className="text-sm font-medium">{t('connect.guide')}</h3>
            <McpSetup url={mcpUrl} />
          </Card>
        </div>
      </Section>

      <McpSkill locale={locale} />
      <Pricing />
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
      <StudioClosing title={t('closing.title')} label={t('closing.cta')} href={accountHref} />
    </StudioShell>
  );
}
