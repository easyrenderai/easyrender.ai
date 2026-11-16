'use client';

import type { UpscaleView } from '@easyrender/core';
import { useCallback, useEffect, useState } from 'react';

export type UpscaleTarget =
  | { kind: 'view'; viewSetId: string; view: string }
  | { kind: 'sheet'; renderId: string };

// The owner's enlargements of one render or one views set, kept current while any is running.
export function useUpscales(filter: { renderId?: string; viewSetId?: string }, isEnabled: boolean) {
  const query = filter.renderId
    ? `renderId=${encodeURIComponent(filter.renderId)}`
    : `viewSetId=${encodeURIComponent(filter.viewSetId ?? '')}`;
  const [rows, setRows] = useState<UpscaleView[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/upscales?${query}`, { cache: 'no-store' }).catch(() => null);
    if (response?.ok) setRows(((await response.json()) as { upscales: UpscaleView[] }).upscales);
  }, [query]);

  useEffect(() => {
    if (isEnabled) void refresh();
  }, [isEnabled, refresh]);

  const isRunning = rows.some((row) => row.status === 'processing');
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [isRunning, refresh]);

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
      setRows((previous) => [data as UpscaleView, ...previous.filter((row) => row.id !== data.id)]);
    } else setError(data?.error ?? fallback);
    setBusyKey(null);
  }

  return { rows, busyKey, error, start };
}

// The newest enlargement that is running or finished for one picture.
export function latestUpscale(
  rows: UpscaleView[],
  match: (row: UpscaleView) => boolean,
): UpscaleView | null {
  return rows.find((row) => row.status !== 'failed' && match(row)) ?? null;
}
