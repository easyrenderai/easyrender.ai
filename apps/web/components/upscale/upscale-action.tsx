'use client';

import type { UpscaleView } from '@easyrender/core';
import { Download, Loader2, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// One picture's Upscale control: the price on the button before the click, a spinner while it
// runs, then a download of the larger file. Never names the model that does the work.
export function UpscaleAction({
  row,
  credits,
  balance,
  isBusy,
  buyHref,
  onStart,
}: {
  row: UpscaleView | null;
  credits: number;
  balance: number;
  isBusy: boolean;
  buyHref: string;
  onStart: () => void;
}) {
  const t = useTranslations('Upscale');
  const format = useFormatter();

  if (row?.status === 'ready') {
    return (
      <Button variant="outline" size="sm" className="w-full" asChild>
        <a href={`/api/upscales/${row.id}/image?download=1`}>
          <Download />
          {row.width ? t('download', { width: format.number(row.width) }) : t('downloadLarge')}
        </a>
      </Button>
    );
  }
  if (row?.status === 'processing' || isBusy) {
    return (
      <Button variant="outline" size="sm" className="w-full" disabled>
        <Loader2 className="animate-spin" />
        {t('working')}
      </Button>
    );
  }
  if (balance < credits) {
    return (
      <Button variant="outline" size="sm" className="w-full" asChild>
        <Link href={buyHref}>{t('buy')}</Link>
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" className="w-full" onClick={onStart}>
      <Maximize2 />
      {t('action', { credits: format.number(credits) })}
    </Button>
  );
}
