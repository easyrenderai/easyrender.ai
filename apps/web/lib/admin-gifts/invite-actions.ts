'use server';

import { randomUUID } from 'node:crypto';
import { config, issueCreditInvite, revokeCreditInvite } from '@easyrender/core';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-analytics/auth';

type InviteError = Exclude<Awaited<ReturnType<typeof issueCreditInvite>>['status'], 'issued'>;

export type InviteFormState = { key: string; link?: string; error?: InviteError };

export async function createOutreachInvite(
  previous: InviteFormState,
  form: FormData,
): Promise<InviteFormState> {
  const issuer = await requireAdmin();
  if (!issuer) throw new Error('Admin session unavailable');
  const result = await issueCreditInvite({
    id: previous.key,
    issuerId: issuer.id,
    amount: Number(form.get('amount')),
    campaign: String(form.get('campaign') ?? ''),
  });
  if (result.status !== 'issued') return { key: previous.key, error: result.status };
  revalidatePath('/admin/gift-credits');
  return { key: randomUUID(), link: new URL(`/invite/${result.id}`, config.appUrl()).href };
}

export async function cancelOutreachInvite(form: FormData) {
  await requireAdmin();
  const id = form.get('id');
  if (typeof id !== 'string') return;
  await revokeCreditInvite(id);
  revalidatePath('/admin/gift-credits');
}
