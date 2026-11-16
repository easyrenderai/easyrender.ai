'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type en from '@/messages/en.json';

export function FirstModelControls({
  campaign,
  unitCostUsd,
  copy,
}: {
  campaign: { isActive: boolean; maxOffers: number; hasEnded: boolean } | null;
  unitCostUsd: number;
  copy: typeof en.FirstModelAdmin;
}) {
  const router = useRouter();
  const [cap, setCap] = useState(String(campaign?.maxOffers ?? 250));
  const [isBusy, setIsBusy] = useState(false);
  const [hasError, setHasError] = useState(false);
  async function configure() {
    setIsBusy(true);
    setHasError(false);
    try {
      const response = await fetch('/api/admin/experiments/first-model', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !campaign?.isActive, maxOffers: Number(cap) }),
      });
      if (!response.ok) {
        setHasError(true);
        return;
      }
      router.refresh();
    } catch {
      setHasError(true);
    } finally {
      setIsBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{copy.cap}</legend>
        <div className="flex flex-wrap gap-2">
          {[100, 250, 500].map((value) => (
            <Button
              key={value}
              type="button"
              variant={cap === String(value) ? 'default' : 'outline'}
              aria-pressed={cap === String(value)}
              disabled={Boolean(campaign) || isBusy}
              onClick={() => setCap(String(value))}
            >
              {value}
            </Button>
          ))}
        </div>
      </fieldset>
      <p className="text-sm text-muted-foreground">
        {copy.cost.replace('{amount}', (Number(cap) * unitCostUsd).toFixed(2))}
      </p>
      <p className="text-sm text-muted-foreground">{copy.rule}</p>
      <Button onClick={configure} disabled={isBusy || campaign?.hasEnded}>
        {isBusy ? copy.busy : !campaign ? copy.start : campaign.isActive ? copy.pause : copy.resume}
      </Button>
      {hasError && (
        <p role="alert" className="text-sm text-destructive">
          {copy.error}
        </p>
      )}
    </div>
  );
}
