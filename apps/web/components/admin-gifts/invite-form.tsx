'use client';

import { useActionState } from 'react';
import { ReferralLink } from '@/components/referral-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createOutreachInvite, type InviteFormState } from '@/lib/admin-gifts/invite-actions';
import { MAX_GIFT_CREDITS } from '@/lib/admin-gifts/limits';

type InviteFormCopy = {
  email: string;
  campaign: string;
  credits: string;
  create: string;
  link: string;
  copy: string;
  copied: string;
  copyError: string;
  errors: Record<NonNullable<InviteFormState['error']>, string>;
};

export function InviteForm({
  requestKey,
  defaultCredits,
  copy,
}: {
  requestKey: string;
  defaultCredits: number;
  copy: InviteFormCopy;
}) {
  const [state, action, isPending] = useActionState(createOutreachInvite, { key: requestKey });

  return (
    <div className="space-y-4">
      <form action={action} className="grid items-end gap-3 md:grid-cols-[1.3fr_1fr_7rem_auto]">
        <div className="space-y-2">
          <Label htmlFor="invite-email">{copy.email}</Label>
          <Input id="invite-email" name="email" type="email" required maxLength={254} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-campaign">{copy.campaign}</Label>
          <Input id="invite-campaign" name="campaign" required maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-amount">{copy.credits}</Label>
          <Input
            id="invite-amount"
            name="amount"
            type="number"
            min={1}
            max={MAX_GIFT_CREDITS}
            defaultValue={defaultCredits}
            required
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {copy.create}
        </Button>
      </form>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{copy.errors[state.error]}</AlertDescription>
        </Alert>
      )}
      {state.link && (
        <ReferralLink
          link={state.link}
          label={copy.link}
          copyLabel={copy.copy}
          copiedLabel={copy.copied}
          errorLabel={copy.copyError}
        />
      )}
    </div>
  );
}
