'use client';

import type { AgentChatSummary } from '@easyrender/core';
import { MessagesSquare, Sparkles, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ShellPanel } from '@/components/app-shell/shell-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { agentErrorCode, readEvents, type StoredMessage, toRows } from '@/lib/agent-model';
import { AgentChatList } from './agent-chat-list';
import { AgentComposer } from './agent-composer';
import { AgentRow, type Approval, ApprovalCard, LiveRow, type LiveTool } from './agent-thread';

export type InitialChat = { id: string; messages: StoredMessage[]; approvals: Approval[] };

type Live = { text: string; tools: LiveTool[] };

const SUGGESTIONS = ['credits', 'library'] as const;

// The Agent page: a chat over Easy Render's own tools. Every turn is stored and charged on the
// server; this component sends the person's words, draws the stream and asks for approvals.
export function AgentWorkspace({
  initialChats,
  initialChat,
  isAvailable,
}: {
  initialChats: AgentChatSummary[];
  initialChat: InitialChat | null;
  isAvailable: boolean;
}) {
  const t = useTranslations('Agent');
  const router = useRouter();
  const [chats, setChats] = useState(initialChats);
  const [chatId, setChatId] = useState(initialChat?.id ?? null);
  const [messages, setMessages] = useState<StoredMessage[]>(initialChat?.messages ?? []);
  const [approvals, setApprovals] = useState<Approval[]>(initialChat?.approvals ?? []);
  const [live, setLive] = useState<Live | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const isRunning = live !== null;

  async function reload(id: string) {
    try {
      const response = await fetch(`/api/agent/chats/${id}`, { cache: 'no-store' });
      if (!response.ok) return;
      const chat = (await response.json()) as {
        title: string | null;
        updatedAt: string;
        messages: StoredMessage[];
        approvals: Approval[];
      };
      setMessages(chat.messages);
      setApprovals(chat.approvals);
      setChats((current) => [
        { id, title: chat.title, updatedAt: chat.updatedAt },
        ...current.filter((item) => item.id !== id),
      ]);
    } catch {
      // The stored chat is read again on the next turn or reload.
    }
  }

  async function runTurn(id: string, path: 'messages' | 'approvals', body: unknown) {
    setErrorCode(null);
    setApprovals([]);
    setLive({ text: '', tools: [] });
    try {
      const response = await fetch(`/api/agent/chats/${id}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { code?: string } | null;
        setErrorCode(data?.code ?? 'internal');
        return;
      }
      await readEvents(response, (event) => {
        if (event.type === 'text') {
          setLive((current) => current && { ...current, text: current.text + event.delta });
        } else if (event.type === 'tool') {
          setLive(
            (current) =>
              current && {
                ...current,
                tools: [
                  ...current.tools.filter((tool) => tool.id !== event.id),
                  { id: event.id, name: event.name, status: event.status },
                ],
              },
          );
        } else if (event.type === 'error') {
          setErrorCode(event.code);
        }
      });
    } catch {
      setErrorCode('internal');
    } finally {
      await reload(id);
      setLive(null);
    }
  }

  async function send(text: string, uploadId?: string) {
    let id = chatId;
    if (!id) {
      try {
        const response = await fetch('/api/agent/chats', { method: 'POST' });
        if (!response.ok) throw new Error('create');
        id = ((await response.json()) as AgentChatSummary).id;
      } catch {
        setErrorCode('internal');
        return;
      }
      setChatId(id);
      // The address follows the chat without a navigation, so the turn that is starting keeps running.
      window.history.replaceState(null, '', `/agent/${id}`);
    }
    setMessages((current) => [
      ...current,
      {
        id: `pending-${current.length}`,
        role: 'user',
        credits: 0,
        content: [
          ...(uploadId ? [{ type: 'text', text: `Photo attached, upload_id: ${uploadId}` }] : []),
          ...(text ? [{ type: 'text', text }] : []),
        ],
      },
    ]);
    await runTurn(id, 'messages', { text, uploadId });
  }

  async function decide(approval: Approval, decision: 'approve' | 'decline') {
    if (chatId) await runTurn(chatId, 'approvals', { toolUseId: approval.toolUseId, decision });
  }

  async function remove(id: string) {
    const response = await fetch(`/api/agent/chats/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    setChats((current) => current.filter((chat) => chat.id !== id));
    if (id === chatId) router.push('/agent');
  }

  const rows = toRows(messages);
  const list = (
    <AgentChatList
      chats={chats}
      activeId={chatId}
      onNew={() => router.push('/agent')}
      onDelete={remove}
      onPick={() => setIsListOpen(false)}
    />
  );

  if (!isAvailable) {
    return (
      <Alert className="mx-auto max-w-xl">
        <TriangleAlert />
        <AlertTitle>{t('unavailableTitle')}</AlertTitle>
        <AlertDescription>
          <p>{t('unavailableBody')}</p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/library">{t('toLibrary')}</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4">
      <ShellPanel side="left" isInline={false}>
        {list}
      </ShellPanel>
      <div className="flex md:hidden">
        <Dialog open={isListOpen} onOpenChange={setIsListOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <MessagesSquare />
              {t('chats')}
            </Button>
          </DialogTrigger>
          <DialogContent className="h-[70svh] max-w-sm p-0">
            <DialogTitle className="sr-only">{t('chats')}</DialogTitle>
            {list}
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex flex-1 flex-col gap-5">
        {rows.length === 0 && !isRunning ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full border bg-card">
              <Sparkles className="size-5" />
            </span>
            <div className="flex max-w-md flex-col gap-1.5">
              <h2 className="text-lg font-semibold">{t('emptyTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('emptyBody')}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((key) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  onClick={() => void send(t(`suggestions.${key}`))}
                >
                  {t(`suggestions.${key}`)}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-5">
            {rows.map((row) => (
              <AgentRow key={row.id} row={row} />
            ))}
            {live && <LiveRow text={live.text} tools={live.tools} />}
            {!live &&
              approvals.map((approval) => (
                <ApprovalCard
                  key={approval.toolUseId}
                  approval={approval}
                  isBusy={isRunning}
                  onDecide={(decision) => void decide(approval, decision)}
                />
              ))}
            {/* Scrolls the newest line into view each time the conversation changes. */}
            <div
              className="scroll-mb-40"
              ref={(node) => {
                node?.scrollIntoView({ block: 'end' });
              }}
            />
          </div>
        )}
        {errorCode && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>{t(`errors.${agentErrorCode(errorCode)}.title`)}</AlertTitle>
            <AlertDescription>
              <p>{t(`errors.${agentErrorCode(errorCode)}.body`)}</p>
              {errorCode === 'insufficient_credits' && (
                <Button size="sm" className="mt-3" asChild>
                  <Link href="/credits">{t('addCredits')}</Link>
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
      <div className="sticky bottom-0 -mx-1 bg-background px-1 pb-1">
        <AgentComposer
          isBusy={isRunning}
          onSend={(text, uploadId) => void send(text, uploadId)}
          onUploadError={() => setErrorCode('upload_failed')}
        />
        <p className="px-2 pt-1.5 text-center text-xs text-muted-foreground">{t('composerNote')}</p>
      </div>
    </div>
  );
}
