import { db, type Prisma } from '@easyrender/db';
import { isCreditInviteId, MAX_GIFT_CREDITS, normalizedGiftEmail } from './credit-gift-policy';
import { grantCreditsInTransaction } from './credits';

const INVITE_LIFETIME_MS = 30 * 86_400_000;
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

export async function issueCreditInvite(input: {
  id: string;
  issuerId: string;
  email: string;
  amount: number;
  campaign: string;
}) {
  const email = normalizedGiftEmail(input.email);
  if (!email) return { status: 'invalid_email' as const };
  if (!isCreditInviteId(input.id)) return { status: 'invalid_key' as const };
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > MAX_GIFT_CREDITS)
    return { status: 'invalid_amount' as const };
  const campaign = typeof input.campaign === 'string' ? input.campaign.trim() : '';
  if (!campaign || campaign.length > 120) return { status: 'invalid_campaign' as const };

  const id = input.id.toLowerCase();
  const existing = await db().creditInvite.findUnique({ where: { id } });
  if (
    !existing &&
    (await db().user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    }))
  )
    return { status: 'existing_account' as const };
  if (!existing) {
    await db().creditInvite.createMany({
      data: {
        id,
        issuerId: input.issuerId,
        recipientEmail: email,
        amount: input.amount,
        campaign,
        expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS),
      },
      skipDuplicates: true,
    });
  }
  const invite = existing ?? (await db().creditInvite.findUniqueOrThrow({ where: { id } }));
  if (
    invite.issuerId !== input.issuerId ||
    invite.recipientEmail !== email ||
    invite.amount !== input.amount ||
    invite.campaign !== campaign
  )
    return { status: 'invalid_key' as const };
  return { status: 'issued' as const, id };
}

export async function publicCreditInvite(id: string): Promise<{ amount: number } | null> {
  if (!isCreditInviteId(id)) return null;
  return db().creditInvite.findFirst({
    where: {
      id: id.toLowerCase(),
      expiresAt: { gt: new Date() },
      revokedAt: null,
      redeemedAt: null,
    },
    select: { amount: true },
  });
}

async function intendedInvite(tx: Prisma.TransactionClient, id: string, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true, createdAt: true },
  });
  if (!user) return null;
  const invite = await tx.creditInvite.findFirst({
    where: {
      id: id.toLowerCase(),
      OR: [
        { redeemedById: userId },
        {
          recipientEmail: normalizedGiftEmail(user.email) ?? '',
          createdAt: { lte: user.createdAt },
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
  if (invite.redeemedById === userId) return { amount: invite.amount, state: 'used' as const };
  if (inviteState(invite, new Date()) !== 'pending') return null;
  const previous = await db().creditInvite.findUnique({ where: { redeemedById: userId } });
  if (previous) return null;
  return {
    amount: invite.amount,
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
  const invites = await db().creditInvite.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
    select: { ...inviteDetails, campaign: true },
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
  return invites.map(({ redeemedById, ...invite }) => ({
    ...invite,
    status: inviteState({ ...invite, redeemedById }, now),
    firstModelAt: firstModel.get(redeemedById) ?? null,
  }));
}
