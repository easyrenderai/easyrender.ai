'use client';

import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Applied = { code: string | null; credits: number };

// Shown on the sign up form only when a real referral code came with the visitor, in the URL or
// from a link they opened earlier. The code is applied by the cookie that link set, so the field
// is there for reassurance: there is nothing to type. Nothing shows while it loads or on a miss.
export function ReferralApplied({ code }: { code: string | null }) {
  const t = useTranslations('Auth.referral');
  const format = useFormatter();
  const { data } = useQuery({
    queryKey: ['referral-applied', code],
    queryFn: async ({ signal }) => {
      const url = code
        ? `/api/referrals/applied?ref=${encodeURIComponent(code)}`
        : '/api/referrals/applied';
      const response = await fetch(url, { cache: 'no-store', signal });
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as Applied;
    },
    retry: false,
  });
  if (!data?.code) return null;
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="referral-code">{t('label')}</Label>
        <Badge variant="secondary">
          <Check aria-hidden="true" />
          {t('applied')}
        </Badge>
      </div>
      <Input
        id="referral-code"
        value={data.code}
        disabled
        readOnly
        className="font-mono tracking-wider"
      />
      <p className="text-xs text-muted-foreground">
        {t('hint', { credits: format.number(data.credits) })}
      </p>
    </div>
  );
}
