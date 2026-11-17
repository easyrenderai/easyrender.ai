'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { captureBrowser } from '@/lib/analytics/browser';

type Client = {
  id: string;
  label: string;
  where: { key: 'terminal' } | { key: 'file'; file: string };
  code: (url: string, key: string) => string;
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

export const MCP_CLIENTS: Client[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    where: { key: 'terminal' },
    code: (url, key) =>
      `claude mcp add --transport http easyrender ${url} \\\n  --header "Authorization: Bearer ${key}"`,
  },
  {
    id: 'codex',
    label: 'Codex',
    where: { key: 'terminal' },
    code: (url) => `codex mcp add easyrender --url ${url}\ncodex mcp login easyrender`,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    where: { key: 'file', file: '~/.cursor/mcp.json' },
    code: (url, key) =>
      json({ mcpServers: { easyrender: { url, headers: { Authorization: `Bearer ${key}` } } } }),
  },
  {
    id: 'vscode',
    label: 'VS Code',
    where: { key: 'file', file: '.vscode/mcp.json' },
    code: (url, key) =>
      json({
        servers: {
          easyrender: { type: 'http', url, headers: { Authorization: `Bearer ${key}` } },
        },
      }),
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    where: { key: 'file', file: 'claude_desktop_config.json' },
    code: (url, key) =>
      json({
        mcpServers: {
          easyrender: {
            command: 'npx',
            // biome-ignore lint/suspicious/noTemplateCurlyInString: mcp-remote expands ${AUTH} from env
            args: ['-y', 'mcp-remote', url, '--header', 'Authorization:${AUTH}'],
            env: { AUTH: `Bearer ${key}` },
          },
        },
      }),
  },
];

export const KEY_PLACEHOLDER = 'er_your_key';

function CopyButton({ text, client }: { text: string; client: string }) {
  const t = useTranslations('McpSetup');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      className="absolute top-2 right-2"
      aria-label={copied ? t('copied') : t('copy')}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          return; // Clipboard unavailable (insecure context or denied): keep the copy icon.
        }
        captureBrowser('integration_setup_copy', { channel: 'mcp', client });
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

// The config snippet for each MCP client, filled with the user's key when we have one.
export function McpSetup({ url, apiKey }: { url: string; apiKey?: string | null }) {
  const t = useTranslations('McpSetup');
  const key = apiKey ?? KEY_PLACEHOLDER;
  return (
    <div className="space-y-4 min-w-0">
      <p className="text-sm text-muted-foreground">{t('wallet')}</p>
      <Tabs defaultValue="claude-ai" className="w-full gap-3">
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="claude-ai">claude.ai</TabsTrigger>
          {MCP_CLIENTS.map((client) => (
            <TabsTrigger key={client.id} value={client.id}>
              {client.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="claude-ai" className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            {(['one', 'two', 'three'] as const).map((step) => (
              <li key={step}>{t(`claudeAi.${step}`)}</li>
            ))}
          </ol>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 pr-12 font-mono text-xs leading-relaxed">
              {url}
            </pre>
            <CopyButton text={url} client="claude-ai" />
          </div>
          <p className="text-xs text-muted-foreground">{t('claudeAi.note')}</p>
        </TabsContent>
        {MCP_CLIENTS.map((client) => {
          const code = client.code(url, key);
          return (
            <TabsContent key={client.id} value={client.id} className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {client.where.key === 'file'
                  ? t('addTo', { file: client.where.file })
                  : t('terminal')}
              </p>
              {client.id === 'codex' && (
                <p className="text-xs text-muted-foreground">{t('codexOauth')}</p>
              )}
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 pr-12 font-mono text-xs leading-relaxed">
                  {code}
                </pre>
                <CopyButton text={code} client={client.id} />
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('firstPromptTitle')}</h3>
        <div className="relative rounded-lg border bg-muted/40 p-3 pr-12">
          <p className="text-sm">{t('firstPrompt')}</p>
          <CopyButton text={t('firstPrompt')} client="first-prompt" />
        </div>
        <p className="text-xs text-muted-foreground">{t('firstPromptNote')}</p>
      </div>
    </div>
  );
}
