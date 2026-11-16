'use client';

import type { ViewSetView } from '@easyrender/core';
import { ImagePlus, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { prepare } from '@/lib/prepare-image';

// Mirrors MAX_NOTE_LENGTH in the harness, which a client component cannot import (it pulls in sharp).
const NOTE_MAX_LENGTH = 500;

export function ProductViewsStudio({
  sets,
  balance,
  credits,
}: {
  sets: ViewSetView[];
  balance: number;
  credits: number;
}) {
  const t = useTranslations('ProductViews');
  const format = useFormatter();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAfford = balance >= credits;

  async function create() {
    if (!file) return;
    setIsBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('image', await prepare(file, t('errors.unreadable')), 'photo.jpg');
      form.append('name', file.name.replace(/\.[^.]+$/, ''));
      if (note.trim()) form.append('prompt', note.trim());
      const response = await fetch('/api/product-views', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        router.push(`/views/${data.id}`);
        return;
      }
      setError(data.error ?? t('errors.create'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.create'));
    }
    setIsBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-4 sm:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <Input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label={t('choose')}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            className="h-auto w-full flex-col gap-2 border-dashed py-8"
            onClick={() => input.current?.click()}
          >
            <ImagePlus className="size-6" />
            <span className="text-sm font-medium">{file ? file.name : t('choose')}</span>
            <span className="text-xs font-normal text-muted-foreground">{t('chooseHint')}</span>
          </Button>
          <div className="space-y-2">
            <Label htmlFor="views-note">{t('noteLabel')}</Label>
            <Textarea
              id="views-note"
              rows={2}
              value={note}
              maxLength={NOTE_MAX_LENGTH}
              placeholder={t('notePlaceholder')}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {canAfford ? (
            <Button size="lg" className="w-full" onClick={create} disabled={!file || isBusy}>
              {isBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {t('create', { credits: format.number(credits) })}
            </Button>
          ) : (
            <Button size="lg" className="w-full" asChild>
              <Link href="/credits?next=/views">{t('buyCredits')}</Link>
            </Button>
          )}
          <p className="text-xs text-muted-foreground">{t('aiNote')}</p>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">{t('recents')}</h2>
        {sets.length === 0 ? (
          <p className="rounded-lg border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            {t('empty')}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {sets.map((set) => {
              const cover = set.views.find((view) => view.view === 'front');
              return (
                <li key={set.id}>
                  <Link
                    href={`/views/${set.id}`}
                    className="block overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/40"
                  >
                    <div className="flex aspect-square items-center justify-center bg-white">
                      {cover?.hasImage ? (
                        // biome-ignore lint/performance/noImgElement: finished view served by our own API
                        <img
                          src={`/api/product-views/${set.id}/views/front?v=${cover.version}`}
                          alt={set.name ?? t('untitled')}
                          className="size-full object-contain"
                        />
                      ) : set.status === 'failed' ? (
                        <span className="px-2 text-center text-xs text-muted-foreground">
                          {t('status.failed')}
                        </span>
                      ) : (
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-0.5 p-2">
                      <p className="truncate text-sm font-medium">{set.name || t('untitled')}</p>
                      <p className="text-xs text-muted-foreground">
                        {set.status === 'ready'
                          ? t('viewsReady', { count: set.viewCount })
                          : set.status === 'failed'
                            ? t('status.failed')
                            : t('progress', { ready: set.readyCount, total: set.viewCount })}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
