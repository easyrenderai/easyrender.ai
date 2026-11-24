'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// The sheet loads when it comes near the screen. Pass `isEager` where it is the first thing a
// page shows (a preview waiting for review), so it does not wait for the scroll.
export function AngleSheet({ src, isEager = false }: { src: string; isEager?: boolean }) {
  return <AngleSheetImage key={src} src={src} isEager={isEager} />;
}

function AngleSheetImage({ src, isEager }: { src: string; isEager: boolean }) {
  const t = useTranslations('Render');
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted/40"
      aria-busy={status === 'loading'}
    >
      {/* biome-ignore lint/performance/noImgElement: authenticated, watermarked API image */}
      <img
        ref={(image) => {
          if (image?.complete) setStatus(image.naturalWidth > 0 ? 'loaded' : 'error');
        }}
        src={src}
        alt={t('previewAlt')}
        loading={isEager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        className={cn('size-full object-contain', status !== 'loaded' && 'opacity-0')}
      />
      {status !== 'loaded' && (
        <div
          role={status === 'error' ? 'alert' : 'status'}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted-foreground"
        >
          {status === 'loading' && (
            <Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          <span>{t(status === 'error' ? 'sheetLoadError' : 'sheetLoading')}</span>
        </div>
      )}
    </div>
  );
}
