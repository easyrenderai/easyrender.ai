'use client';

import type { LibraryFolderView } from '@easyrender/core';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Create or rename. `onSubmit` resolves with an error message to show, or null when it worked.
export function FolderNameDialog({
  mode,
  initialName,
  onSubmit,
  onClose,
}: {
  mode: 'create' | 'rename';
  initialName: string;
  onSubmit: (name: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const t = useTranslations('Library.folders');
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setError(await onSubmit(name));
    setIsBusy(false);
  };

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? t('new') : t('renameTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('nameLabel')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="library-folder-name">{t('nameLabel')}</Label>
            <Input
              id="library-folder-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('namePlaceholder')}
              maxLength={80}
              autoFocus
              autoComplete="off"
              aria-invalid={error !== null}
              aria-describedby={error ? 'library-folder-error' : undefined}
            />
            {error && (
              <p id="library-folder-error" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isBusy || name.trim().length === 0}>
              {mode === 'create' ? t('create') : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteFolderDialog({
  folder,
  count,
  onConfirm,
  onClose,
}: {
  folder: LibraryFolderView;
  count: number;
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
}) {
  const t = useTranslations('Library.folders');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const confirm = async () => {
    setIsBusy(true);
    setError(await onConfirm());
    setIsBusy(false);
  };

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription>{t('deleteBody', { name: folder.name, count })}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" variant="destructive" disabled={isBusy} onClick={confirm}>
            {t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Pick the folder for one item, or none to unfile it.
export function MoveDialog({
  itemName,
  folders,
  currentId,
  onPick,
  onClose,
}: {
  itemName: string;
  folders: LibraryFolderView[];
  currentId: string | null;
  onPick: (folderId: string | null) => Promise<string | null>;
  onClose: () => void;
}) {
  const t = useTranslations('Library.folders');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const pick = async (folderId: string | null) => {
    setIsBusy(true);
    setError(await onPick(folderId));
    setIsBusy(false);
  };
  const options: { id: string | null; label: string }[] = [
    { id: null, label: t('moveNone') },
    ...folders.map((folder) => ({ id: folder.id, label: folder.name })),
  ];

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('moveTitle', { name: itemName })}</DialogTitle>
          <DialogDescription>{folders.length === 0 ? t('moveEmpty') : t('move')}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-72 gap-1 overflow-y-auto">
          {options.map((option) => (
            <Button
              key={option.id ?? 'none'}
              type="button"
              variant="ghost"
              disabled={isBusy}
              aria-pressed={option.id === currentId}
              onClick={() => pick(option.id)}
              className={cn(
                'h-9 justify-between px-3 font-normal',
                option.id === currentId && 'bg-accent',
              )}
            >
              <span className="truncate">{option.label}</span>
              {option.id === currentId && <Check className="size-4" />}
            </Button>
          ))}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
