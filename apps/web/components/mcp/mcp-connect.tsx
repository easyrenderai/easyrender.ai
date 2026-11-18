'use client';

import { ArrowRight, Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useRef, useState } from 'react';
import { IntegrationLink } from '@/components/integrations/link';
import { ClientLogo } from '@/components/mcp/client-logo';
import { KEY_PLACEHOLDER, MCP_CLIENTS } from '@/components/mcp-setup';
import { AmbientObject } from '@/components/studio/ambient-object';
import { Button } from '@/components/ui/button';
import { captureBrowser } from '@/lib/analytics/browser';

// claude.ai connects with a URL and a sign-in; every other client is one of MCP_CLIENTS.
const CLAUDE_AI = 'claude-ai';
const CHOICES = [
  { id: CLAUDE_AI, label: 'Claude' },
  ...MCP_CLIENTS.map(({ id, label }) => ({ id, label })),
];

function Snippet({
  text,
  client,
  children,
}: {
  text: string;
  client: string;
  children: ReactNode;
}) {
  const t = useTranslations('McpSetup');
  const [isCopied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <div className="relative min-w-0">
      {children}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="absolute top-2 right-2"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
          } catch {
            return; // Clipboard unavailable (insecure context or denied): keep the copy label.
          }
          captureBrowser('integration_setup_copy', { channel: 'mcp', client });
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1500);
        }}
      >
        {isCopied ? <Check /> : <Copy />}
        {isCopied ? t('copied') : t('copy')}
      </Button>
    </div>
  );
}

// The answer to "how do I give my agent this?": pick the agent, get its one snippet. Nothing is
// open until a client is picked, so the page never shows six sets of instructions at once.
export function McpConnect({
  url,
  label,
  accountHref,
  accountLabel,
  keyNote,
}: {
  url: string;
  /** Names the group of client buttons. */
  label: string;
  accountHref: string;
  accountLabel: string;
  /** Shown with a snippet that carries a placeholder key: where the real key comes from. */
  keyNote: string;
}) {
  const t = useTranslations('McpSetup');
  const [choice, setChoice] = useState<string | null>(null);
  const panel = useId();
  const client = MCP_CLIENTS.find(({ id }) => id === choice);
  const code = client?.code(url, KEY_PLACEHOLDER) ?? '';

  return (
    <div className="w-full space-y-5">
      {/* The page's one flourish: the mesh behind the heading becomes the finished model once an
          agent is picked. Positioned against the hero section, not this column. */}
      <AmbientObject id="swivel-chair" isSolid={choice !== null} className="lg:[--ambient-x:97%]" />
      <fieldset className="space-y-3">
        <legend className="mx-auto text-sm text-muted-foreground">{label}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CHOICES.map(({ id, label: name }) => (
            <Button
              key={id}
              type="button"
              size="lg"
              variant={id === choice ? 'default' : 'outline'}
              aria-pressed={id === choice}
              aria-controls={panel}
              // Opaque, so the object behind the page never shows through a button.
              className={id === choice ? undefined : 'bg-background hover:bg-secondary'}
              onClick={() => {
                setChoice(id);
                captureBrowser('integration_client_selected', { channel: 'mcp', client: id });
              }}
            >
              <ClientLogo client={id} className="size-4" />
              {name}
            </Button>
          ))}
        </div>
      </fieldset>

      <div id={panel} aria-live="polite">
        {choice && (
          <div className="space-y-5 rounded-xl border bg-card p-5 text-left sm:p-6">
            {choice === CLAUDE_AI ? (
              <>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
                  {(['one', 'two', 'three'] as const).map((step) => (
                    <li key={step}>{t(`claudeAi.${step}`)}</li>
                  ))}
                </ol>
                <Snippet text={url} client={CLAUDE_AI}>
                  <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 pr-28 font-mono text-xs leading-relaxed">
                    {url}
                  </pre>
                </Snippet>
              </>
            ) : (
              client && (
                <>
                  <p className="text-sm leading-relaxed">
                    {client.where.key === 'file'
                      ? t('addTo', { file: client.where.file })
                      : t('terminal')}
                  </p>
                  <Snippet text={code} client={client.id}>
                    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 pt-12 font-mono text-xs leading-relaxed">
                      {code}
                    </pre>
                  </Snippet>
                  {client.id === 'codex' && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t('codexOauth')}
                    </p>
                  )}
                  {/* The snippet carries a placeholder key: this is where the real one comes from. */}
                  {code.includes(KEY_PLACEHOLDER) && (
                    <div className="space-y-3">
                      <p className="text-xs leading-relaxed text-muted-foreground">{keyNote}</p>
                      <Button asChild>
                        <IntegrationLink channel="mcp" action="setup" href={accountHref}>
                          {accountLabel} <ArrowRight aria-hidden="true" />
                        </IntegrationLink>
                      </Button>
                    </div>
                  )}
                </>
              )
            )}
            <div className="space-y-2 border-t pt-5">
              <h2 className="text-sm font-medium">{t('firstPromptTitle')}</h2>
              <Snippet text={t('firstPrompt')} client="first-prompt">
                <p className="rounded-lg border bg-muted/40 p-3 pt-12 text-sm leading-relaxed">
                  {t('firstPrompt')}
                </p>
              </Snippet>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('firstPromptNote')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
