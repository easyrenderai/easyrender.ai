'use client';

import { MAX_SIDE_CM, MIN_SIDE_CM, type RealSize } from '@easyrender/harness/glb';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { captureBrowser } from '@/lib/analytics/browser';

type Loaded = { size: RealSize | null; version: number };
const SIDES = ['widthCm', 'depthCm', 'heightCm'] as const;
type Side = (typeof SIDES)[number];
type Fields = Record<Side, string>;

const toFields = (size: RealSize | null): Fields => ({
  widthCm: size?.widthCm?.toString() ?? '',
  depthCm: size?.depthCm?.toString() ?? '',
  heightCm: size?.heightCm?.toString() ?? '',
});

// The side lengths to send, or null when a field holds something that is not a size.
function toSize(fields: Fields): RealSize | null {
  const size: RealSize = {};
  for (const side of SIDES) {
    const text = fields[side].trim();
    if (!text) continue;
    const value = Number(text);
    if (!Number.isFinite(value) || value < MIN_SIDE_CM || value > MAX_SIDE_CM) return null;
    size[side] = value;
  }
  return size;
}

// The owner's real size for the piece. The stored model is never changed: AR and the downloads
// get it at this size, so removing it restores the generated one.
export function SizePanel({
  renderId,
  onSaved,
}: {
  renderId: string;
  // Called with the new model version, so the page can load the model at its new size.
  onSaved?: (version: number) => void;
}) {
  const t = useTranslations('Render.size');
  const client = useQueryClient();
  const queryKey = ['size', renderId];
  const query = useQuery({
    queryKey,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/renders/${renderId}/size`, {
        cache: 'no-store',
        signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as Loaded;
    },
  });
  const loaded = query.data ?? null;
  // Only what the owner typed since the last save; until then the fields show the saved size.
  const [changed, setChanged] = useState<Fields | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'saved'; text: string } | null>(null);
  const fields = changed ?? toFields(loaded?.size ?? null);
  const isDirty = changed !== null;
  const isSet = loaded?.size != null;

  async function send(size: RealSize | null) {
    setIsSaving(true);
    setMessage(null);
    const response = await fetch(`/api/renders/${renderId}/size`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ size }),
    }).catch(() => null);
    if (response?.ok) {
      const next = (await response.json()) as Loaded;
      client.setQueryData(queryKey, next);
      setChanged(null);
      captureBrowser(size ? 'model_size_saved' : 'model_size_removed');
      setMessage({ tone: 'saved', text: t(size ? 'saved' : 'removed') });
      onSaved?.(next.version);
    } else {
      setMessage({ tone: 'error', text: t('saveFailed') });
    }
    setIsSaving(false);
  }

  function save() {
    const size = toSize(fields);
    if (size === null) setMessage({ tone: 'error', text: t('saveFailed') });
    else if (Object.keys(size).length === 0) void send(null);
    else void send(size);
  }

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        {!loaded && !query.isError && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('loading')}
          </p>
        )}
        {query.isError && !loaded && (
          <Alert variant="destructive">
            <AlertDescription>{t('loadFailed')}</AlertDescription>
          </Alert>
        )}
        {loaded && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {SIDES.map((side) => (
                <div key={side} className="space-y-1.5">
                  <Label htmlFor={`size-${renderId}-${side}`}>{t(side)}</Label>
                  <Input
                    id={`size-${renderId}-${side}`}
                    type="number"
                    inputMode="decimal"
                    min={MIN_SIDE_CM}
                    max={MAX_SIDE_CM}
                    step="0.1"
                    className="tabular-nums"
                    value={fields[side]}
                    onChange={(event) => {
                      setMessage(null);
                      setChanged({ ...fields, [side]: event.target.value });
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={save} disabled={isSaving || !isDirty}>
                {isSaving && <Loader2 className="animate-spin" />}
                {t('save')}
              </Button>
              {isSet && (
                <Button size="sm" variant="outline" onClick={() => send(null)} disabled={isSaving}>
                  {t('remove')}
                </Button>
              )}
            </div>
          </>
        )}
        {message && (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={
              message.tone === 'error'
                ? 'text-sm text-destructive'
                : 'text-sm text-muted-foreground'
            }
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
