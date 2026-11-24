import { createHmac } from 'node:crypto';
import { db, type Prisma } from '@easyrender/db';
import {
  isCreditInviteId,
  MAX_CREDIT_INVITE_BATCH,
  MAX_GIFT_CREDITS,
  normalizedGiftEmail,
} from './credit-gift-policy';
import { grantCreditsInTransaction } from './credits';

const INVITE_LIFETIME_MS = 30 * 86_400_000;
const INVITES_PER_PAGE = 50;
// Previously issued invitations always stored a valid email. Empty is an unbound code.
const UNBOUND_RECIPIENT_EMAIL = '';
const inviteDetails = {
  id: true,
  recipientEmail: true,
  amount: true,
  createdAt: true,
  expiresAt: true,
  revokedAt: true,
  redeemedAt: true,
  redeemedById: true,
} satisfies Prisma.CreditInviteSelect;

type Invite = Prisma.CreditInviteGetPayload<{ select: typeof inviteDetails }>;
type InviteState = 'pending' | 'redeemed' | 'expired' | 'revoked';

function inviteState(invite: Invite, now: Date): InviteState {
  if (invite.redeemedAt) return 'redeemed';
  if (invite.revokedAt) return 'revoked';
  return invite.expiresAt <= now ? 'expired' : 'pending';
}

type InviteRequest = {
  id: string;
  issuerId: string;
  amount: number;
  campaign: string;
};

function validateInvite(input: InviteRequest) {
  if (!isCreditInviteId(input.id)) return { status: 'invalid_key' as const };
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > MAX_GIFT_CREDITS)
    return { status: 'invalid_amount' as const };
  const campaign = typeof input.campaign === 'string' ? input.campaign.trim() : '';
  if (!campaign || campaign.length > 120) return { status: 'invalid_campaign' as const };
  return { status: 'valid' as const, campaign };
}

export async function issueCreditInvite(input: InviteRequest) {
  const validation = validateInvite(input);
  if (validation.status !== 'valid') return validation;
  const { campaign } = validation;

  const id = input.id.toLowerCase();
  await db().creditInvite.createMany({
    data: {
      id,
      issuerId: input.issuerId,
      recipientEmail: UNBOUND_RECIPIENT_EMAIL,
      amount: input.amount,
      campaign,
      expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS),
    },
    skipDuplicates: true,
  });
  const invite = await db().creditInvite.findUniqueOrThrow({ where: { id } });
  if (
    invite.issuerId !== input.issuerId ||
    invite.recipientEmail !== UNBOUND_RECIPIENT_EMAIL ||
    invite.amount !== input.amount ||
    invite.campaign !== campaign
  )
    return { status: 'invalid_key' as const };
  return { status: 'issued' as const, id };
}

function batchInviteId(requestId: string, index: number) {
  // Keep retries stable while making sibling links unpredictable from any individual link.
  const hex = createHmac('sha256', requestId).update(String(index)).digest('hex').slice(0, 32);
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 3) | 8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    variant + hex.slice(17, 20),
    hex.slice(20),
  ].join('-');
}

class InviteBatchConflict extends Error {}

export async function issueCreditInviteBatch(input: InviteRequest & { quantity: number }) {
  const validation = validateInvite(input);
  if (validation.status !== 'valid') return validation;
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 2 ||
    input.quantity > MAX_CREDIT_INVITE_BATCH
  )
    return { status: 'invalid_quantity' as const };

  const { campaign } = validation;
  const { amount, issuerId } = input;
  const ids = Array.from({ length: input.quantity }, (_, index) =>
    batchInviteId(input.id.toLowerCase(), index),
  );
  const values = { issuerId, amount, campaign, recipientEmail: UNBOUND_RECIPIENT_EMAIL };
  const expiresAt = new Date(Date.now() + INVITE_LIFETIME_MS);
  try {
    await db().$transaction(async (tx) => {
      await tx.creditInvite.createMany({
        data: ids.map((id) => ({ ...values, id, expiresAt })),
        skipDuplicates: true,
      });
      const matching = await tx.creditInvite.count({ where: { ...values, id: { in: ids } } });
      if (matching !== ids.length) throw new InviteBatchConflict();
    });
  } catch (error) {
    if (error instanceof InviteBatchConflict) return { status: 'invalid_key' as const };
    throw error;
  }
  return { status: 'issued' as const, ids };
}

export async function publicCreditInvite(id: string) {
  if (!isCreditInviteId(id)) return null;
  const invite = await db().creditInvite.findFirst({
    where: {
      id: id.toLowerCase(),
      expiresAt: { gt: new Date() },
      revokedAt: null,
      redeemedAt: null,
    },
    select: { amount: true, recipientEmail: true },
  });
  return invite
    ? { amount: invite.amount, isEmailBound: invite.recipientEmail !== UNBOUND_RECIPIENT_EMAIL }
    : null;
}

async function intendedInvite(tx: Prisma.TransactionClient, id: string, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true, createdAt: true },
  });
  if (!user) return null;
  const email = normalizedGiftEmail(user.email);
  if (!email) return null;
  const invite = await tx.creditInvite.findFirst({
    where: {
      id: id.toLowerCase(),
      OR: [
        { redeemedById: userId },
        {
          createdAt: { lte: user.createdAt },
          OR: [{ recipientEmail: UNBOUND_RECIPIENT_EMAIL }, { recipientEmail: email }],
        },
      ],
    },
    select: inviteDetails,
  });
  return invite ? { invite, isVerified: user.emailVerified } : null;
}

export async function creditInviteForUser(id: string, userId: string) {
  if (!isCreditInviteId(id)) return null;
  const result = await intendedInvite(db(), id, userId);
  if (!result) return null;
  const { invite, isVerified } = result;
  if (invite.redeemedById === userId)
    return {
      amount: invite.amount,
      state: 'used' as const,
      isEmailBound: invite.recipientEmail !== UNBOUND_RECIPIENT_EMAIL,
    };
  if (inviteState(invite, new Date()) !== 'pending') return null;
  const previous = await db().creditInvite.findUnique({ where: { redeemedById: userId } });
  if (previous) return null;
  return {
    amount: invite.amount,
    isEmailBound: invite.recipientEmail !== UNBOUND_RECIPIENT_EMAIL,
    state: isVerified ? ('ready' as const) : ('unverified' as const),
  };
}

type Redemption = 'unavailable' | 'unverified' | 'used' | 'redeemed';

export async function redeemCreditInvite(id: string, userId: string): Promise<Redemption> {
  if (!isCreditInviteId(id)) return 'unavailable';
  return db().$transaction(async (tx) => {
    // Claims for different links to the same account serialize before checking its redemption.
    await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${userId} FOR UPDATE`;
    const result = await intendedInvite(tx, id, userId);
    if (!result) return 'unavailable';
    const { invite, isVerified } = result;
    if (invite.redeemedById === userId) return 'used';
    const now = new Date();
    if (inviteState(invite, now) !== 'pending') return 'unavailable';
    if (!isVerified) return 'unverified';
    if (await tx.creditInvite.findUnique({ where: { redeemedById: userId } })) return 'unavailable';
    const claim = await tx.creditInvite.updateMany({
      where: { id: invite.id, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { redeemedById: userId, redeemedAt: now },
    });
    if (!claim.count) return 'unavailable';
    const isGranted = await grantCreditsInTransaction(tx, {
      userId,
      amount: invite.amount,
      key: `credit-invite:${invite.id}`,
      reason: 'outreach_credit_invite',
    });
    if (!isGranted) throw new Error('The outreach credit ledger key was already used');
    return 'redeemed';
  });
}

export async function revokeCreditInvite(id: string) {
  if (!isCreditInviteId(id)) return false;
  const info = await db().creditInvite.updateMany({
    where: { id: id.toLowerCase(), redeemedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return info.count > 0;
}

export async function listCreditInvites() {
  return (await listCreditInvitePage({ campaign: '', page: 1 })).invites;
}

function campaignPrefix(campaign: string) {
  return campaign
    .trim()
    .slice(0, 120)
    .replace(/[\\%_]/g, '\\$&');
}

export async function listPendingCreditInvites(campaign: string) {
  const prefix = campaignPrefix(campaign);
  if (!prefix) return [];
  return db().creditInvite.findMany({
    where: {
      campaign: { startsWith: prefix, mode: 'insensitive' },
      expiresAt: { gt: new Date() },
      redeemedAt: null,
      revokedAt: null,
    },
    orderBy: [{ campaign: 'asc' }, { id: 'asc' }],
    select: { campaign: true, id: true, amount: true, expiresAt: true },
  });
}

export async function listCreditInvitePage({ campaign, page }: { campaign: string; page: number }) {
  const prefix = campaignPrefix(campaign);
  const pattern = `${prefix}%`;
  const [summary] = await db().$queryRaw<{ total: number; redeemed: number; completed: number }[]>`
    SELECT COUNT(*)::int AS total,
           COUNT(i."redeemedAt")::int AS redeemed,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM "Render" r
             WHERE r."userId" = i."redeemedById" AND r.status = 'ready'
               AND r."glbKey" IS NOT NULL AND r."completedAt" >= i."redeemedAt"
           ))::int AS completed
      FROM "CreditInvite" i
      WHERE i.campaign ILIKE ${pattern}
  `;
  const { total, redeemed, completed } = summary ?? { total: 0, redeemed: 0, completed: 0 };
  const pages = Math.max(1, Math.ceil(total / INVITES_PER_PAGE));
  const current = Number.isSafeInteger(page) ? Math.min(pages, Math.max(1, page)) : 1;
  const invites = await db().creditInvite.findMany({
    where: { campaign: { startsWith: prefix, mode: 'insensitive' } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (current - 1) * INVITES_PER_PAGE,
    take: INVITES_PER_PAGE,
    select: { ...inviteDetails, campaign: true, redeemedBy: { select: { email: true } } },
  });
  const claimed = invites.flatMap(({ redeemedAt, redeemedById }) =>
    redeemedAt && redeemedById ? [{ userId: redeemedById, completedAt: { gte: redeemedAt } }] : [],
  );
  const models = claimed.length
    ? await db().render.groupBy({
        by: ['userId'],
        where: { OR: claimed, status: 'ready', glbKey: { not: null } },
        _min: { completedAt: true },
      })
    : [];
  const firstModel = new Map(models.map((row) => [row.userId, row._min.completedAt]));
  const now = new Date();
  return {
    invites: invites.map(({ redeemedBy, redeemedById, ...invite }) => ({
      ...invite,
      recipientEmail: redeemedBy?.email ?? (invite.recipientEmail || null),
      status: inviteState({ ...invite, redeemedById }, now),
      firstModelAt: firstModel.get(redeemedById) ?? null,
    })),
    total,
    redeemed,
    completed,
    page: current,
    pages,
  };
}
