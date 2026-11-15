import { BookOpen, ExternalLink } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { CodeSnippet } from '@/components/code-snippet';
import { Section } from '@/components/landing';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';

const SKILL_URL =
  'https://github.com/easyrenderai/easyrender.ai/tree/main/skills/easyrender-image-to-3d';
const INSTALL_COMMAND = 'npx skills add easyrenderai/easyrender.ai --skill easyrender-image-to-3d';

export async function McpSkill({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'McpLanding.skill' });
  return (
    <Section id="agent-skill" title={t('title')} description={t('description')}>
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <BookOpen className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted-foreground">{t('body')}</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            {(['install', 'connect', 'ask'] as const).map((step) => (
              <li key={step}>{t(`steps.${step}`)}</li>
            ))}
          </ol>
          <Button variant="outline" asChild>
            <a href={SKILL_URL}>
              {t('source')} <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        </div>
        <div className="min-w-0 space-y-5">
          <CodeSnippet
            code={INSTALL_COMMAND}
            label={t('commandLabel')}
            copyLabel={t('copy')}
            copiedLabel={t('copied')}
            errorLabel={t('copyError')}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">{t('requirement')}</p>
          <div className="space-y-2 border-t pt-5">
            <h3 className="text-sm font-medium">{t('exampleLabel')}</h3>
            <blockquote className="text-sm leading-relaxed">{t('example')}</blockquote>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('cost')}</p>
        </div>
      </div>
    </Section>
  );
}
