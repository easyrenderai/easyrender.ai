'use client';
import type { AdminRender } from '@easyrender/core/admin-analytics';
import { Box, Download, ImageOff } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ModelView = dynamic(
  () => import('@/components/model-view').then((module) => module.ModelView),
  { ssr: false },
);

export function AdminRenderCard({
  render,
}: {
  render: AdminRender & { previewUrl: string | null };
}) {
  const t = useTranslations('AdminInventory');
  const [isOpen, setOpen] = useState(false);
  const [hasImageError, setImageError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(render.previewUrl);
  const base = `/api/admin/renders/${encodeURIComponent(render.id)}/assets`;
  const statusLabel = t(render.status);
  return (
    <Card className="min-w-0 gap-0 overflow-hidden py-0">
      <div className="relative aspect-square overflow-hidden bg-muted/30">
        {previewUrl && !hasImageError ? (
          <Image
            src={previewUrl}
            unoptimized
            width={640}
            height={640}
            alt={t('previewAlt')}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-full object-contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted-foreground">
            <ImageOff aria-hidden className="size-8" />
            <span>{t(hasImageError ? 'imageError' : 'noPreview')}</span>
            {hasImageError && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewUrl(`${base}/preview?retry=${Date.now()}`);
                  setImageError(false);
                }}
              >
                {t('retry')}
              </Button>
            )}
          </div>
        )}
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant={render.status === 'failed' ? 'destructive' : 'secondary'}>
            {statusLabel}
          </Badge>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t('charged', { credits: render.credits })}
          </span>
        </div>
        <div className="space-y-1 text-sm">
          <p className="truncate font-medium">
            {render.email === '—' ? t('anonymous') : render.email}
          </p>
          <time className="text-xs tabular-nums text-muted-foreground" dateTime={render.createdAt}>
            {render.createdAt.slice(0, 16).replace('T', ' ')} UTC
          </time>
          <p className="truncate font-mono text-xs text-muted-foreground" title={render.id}>
            {render.id}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {render.hasModel && (
            <>
              <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <Box />
                {t('viewModel')}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`${base}/glb`} download>
                  <Download />
                  {t('downloadGlb')}
                </a>
              </Button>
            </>
          )}
          {render.hasSheet && (
            <Button variant="ghost" size="sm" asChild>
              <a href={`${base}/sheet`} download>
                {t('downloadSheet')}
              </a>
            </Button>
          )}
          {render.hasSource && (
            <Button variant="ghost" size="sm" asChild>
              <a href={`${base}/source`} download>
                {t('downloadSource')}
              </a>
            </Button>
          )}
        </div>
      </CardContent>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t('modelTitle')}</DialogTitle>
              <DialogDescription>{t('modelNote')}</DialogDescription>
            </DialogHeader>
            <ModelView
              src={`${base}/view`}
              name={render.id}
              downloadUrl={`${base}/glb`}
              isArEnabled={false}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
