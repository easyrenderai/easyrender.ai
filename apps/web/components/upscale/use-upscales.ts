'use client';

import type { UpscaleView } from '@easyrender/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useActivationError } from '@/lib/activation-errors';
import { upscalePollInterval } from '@/lib/upscale-polling';

export type UpscaleTarget =
  | { kind: 'view'; viewSetId: string; view: string }
  | { kind: 'sheet'; renderId: string };

// The owner's enlargements of one render or one views set, kept current while any is running.
export function useUpscales(filter: { renderId?: string; viewSetId?: string }, isEnabled: boolean) {
  const t = useTranslations('Upscale');
  const localizedError = useActivationError();
  const query = filter.renderId
    ? `renderId=${encodeURIComponent(filter.renderId)}`
    : `viewSetId=${encodeURIComponent(filter.viewSetId ?? '')}`;
  const client = useQueryClient();
  const queryKey = ['upscales', query];
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey,
    enabled: isEnabled,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/upscales?${query}`, { cache: 'no-store', signal });
      if (!response.ok) throw new Error(String(response.status));
      return ((await response.json()) as { upscales: UpscaleView[] }).upscales;
    },
    // Poll while an enlargement is processing; a failed poll keeps the rows and the next one retries.
    refetchInterval: (current) => upscalePollInterval(current.state.data),
  });

  async function start(target: UpscaleTarget, key: string, fallback: string) {
    setBusyKey(key);
    setError(null);
    const response = await fetch('/api/upscales', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(target),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (response?.ok && data) {
      client.setQueryData<UpscaleView[]>(queryKey, (previous = []) => [
        data as UpscaleView,
        ...previous.filter((row) => row.id !== data.id),
      ]);
    } else setError(localizedError(data, data?.code === 'upstream' ? t('refunded') : fallback));
    setBusyKey(null);
  }

  return { rows, busyKey, error, start };
}

// The newest enlargement of one picture, including a terminal failure.
export function latestUpscale(
  rows: UpscaleView[],
  match: (row: UpscaleView) => boolean,
): UpscaleView | null {
  return rows.find(match) ?? null;
}
