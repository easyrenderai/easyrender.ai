'use server';

import { randomUUID } from 'node:crypto';
import {
  config,
  issueCreditInvite,
  issueCreditInviteBatch,
  revokeCreditInvite,
} from '@easyrender/core';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-analytics/auth';

type InviteError = Exclude<Awaited<ReturnType<typeof issueCreditInviteBatch>>['status'], 'issued'>;

export type InviteFormState = {
  key: string;
  link?: string;
  batch?: { campaign: string; count: number };
  error?: InviteError;
};

export async function createOutreachInvite(
  previous: InviteFormState,
  form: FormData,
): Promise<InviteFormState> {
  const issuer = await requireAdmin();
  if (!issuer) throw new Error('Admin session unavailable');
  const quantity = Number(form.get('quantity') ?? 1);
  const input = {
    id: previous.key,
    issuerId: issuer.id,
    amount: Number(form.get('amount')),
    campaign: String(form.get('campaign') ?? '').trim(),
  };
  if (quantity !== 1) {
    const batch = await issueCreditInviteBatch({ ...input, quantity });
    if (batch.status !== 'issued') return { key: previous.key, error: batch.status };
    revalidatePath('/admin/gift-credits');
    return { key: randomUUID(), batch: { campaign: input.campaign, count: batch.ids.length } };
  }
  const result = await issueCreditInvite(input);
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
