'use client';

import type { AgentChatSummary } from '@easyrender/core';
import { MessagesSquare, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// The person's chats, latest first. In the left drawer on a wide screen and in a dialog on a phone.
export function AgentChatList({
  chats,
  activeId,
  onNew,
  onDelete,
  onPick,
}: {
  chats: AgentChatSummary[];
  activeId: string | null;
  onNew: () => void;
  onDelete: (id: string) => Promise<void>;
  // Called after a chat is chosen, so a dialog can close itself.
  onPick?: () => void;
}) {
  const t = useTranslations('Agent');
  const [toDelete, setToDelete] = useState<AgentChatSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          onNew();
          onPick?.();
        }}
      >
        <Plus />
        {t('newChat')}
      </Button>
      {chats.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{t('noChats')}</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {chats.map((chat) => (
            <li key={chat.id} className="group relative">
              <Link
                href={`/agent/${chat.id}`}
                aria-current={chat.id === activeId ? 'page' : undefined}
                onClick={() => onPick?.()}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 pr-9 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  chat.id === activeId && 'bg-accent',
                )}
              >
                <MessagesSquare className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{chat.title ?? t('untitled')}</span>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                aria-label={t('deleteChat')}
                onClick={() => setToDelete(chat)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (!toDelete) return;
                setIsDeleting(true);
                await onDelete(toDelete.id);
                setIsDeleting(false);
                setToDelete(null);
              }}
            >
              {t('deleteChat')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
