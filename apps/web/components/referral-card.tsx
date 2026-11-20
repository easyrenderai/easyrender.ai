'use client';

import { Check, Copy } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ReferralLink({
  link,
  label,
  copyLabel,
  copiedLabel,
  errorLabel,
}: {
  link: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
  errorLabel: string;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(link);
      setStatus('copied');
      timer.current = setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="referral-link">{label}</Label>
      <div className="flex min-w-0 flex-col gap-2 min-[480px]:flex-row">
        <Input
          id="referral-link"
          className="min-w-0 flex-1"
          value={link}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button type="button" variant="outline" onClick={copy} className="shrink-0">
          {status === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {status === 'copied' ? copiedLabel : copyLabel}
        </Button>
      </div>
      {status === 'error' && <p className="text-sm text-destructive">{errorLabel}</p>}
    </div>
  );
}
