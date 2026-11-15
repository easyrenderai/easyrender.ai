import { createHash, randomBytes } from 'node:crypto';
import { db, Prisma } from '@easyrender/db';
import { config } from './config';
import { AppError } from './errors';

const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');

export const API_KEY_SCOPES = ['read', 'write', 'spend', 'share'] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];
export type ApiKeyOptions = {
  scopes?: readonly ApiKeyScope[];
  creditLimit?: number | null;
  expiresAt?: Date | null;
};

export function isApiKeyScope(value: unknown): value is ApiKeyScope {
  return API_KEY_SCOPES.some((scope) => scope === value);
}

function keyOptions(options: ApiKeyOptions) {
  const scopes = options.scopes ?? API_KEY_SCOPES;
  const creditLimit = options.creditLimit ?? null;
  const expiresAt = options.expiresAt ?? null;
  if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every(isApiKeyScope)) {
    throw new AppError('Choose read, write, spend or share scopes', 400, 'bad_key_options');
  }
  if (
    creditLimit !== null &&
    (!Number.isSafeInteger(creditLimit) || creditLimit < 0 || creditLimit > 2_147_483_647)
  ) {
    throw new AppError('creditLimit must be a non-negative integer', 400, 'bad_key_options');
  }
  if (
    expiresAt !== null &&
    (!(expiresAt instanceof Date) ||
      !Number.isFinite(expiresAt.getTime()) ||
      expiresAt.getTime() <= Date.now())
  ) {
    throw new AppError('expiresAt must be a future date', 400, 'bad_key_options');
  }
  return { scopes: [...new Set(scopes)], creditLimit, expiresAt };
}

// The raw key is shown once; only its hash is stored.
export async function createApiKey(userId: string, name: string, options: ApiKeyOptions = {}) {
  const restrictions = keyOptions(options);
  const raw = `er_${randomBytes(24).toString('base64url')}`;
  const key = await db().apiKey.create({
    data: {
      userId,
      name: name.slice(0, 60) || 'API key',
      prefix: raw.slice(0, 10),
      hash: hash(raw),
      ...restrictions,
    },
  });
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    createdAt: key.createdAt,
    key: raw,
    scopes: key.scopes,
    creditLimit: key.creditLimit,
    spentCredits: key.spentCredits,
    expiresAt: key.expiresAt,
  };
}

export async function redeemOAuthApiKey(input: {
  codeHash: string;
  userId: string;
  name: string;
  expiresAt: Date;
  resource: string;
}): Promise<string> {
  const raw = `er_${randomBytes(24).toString('base64url')}`;
  try {
    await db().$transaction(async (tx) => {
      if (input.expiresAt.getTime() <= Date.now()) {
        throw new AppError('Authorization code expired', 400, 'invalid_grant');
      }
      // Expired signed codes can never pass validation again. Keep live tombstones independent
      // of API key deletion so revocation cannot be undone by replaying an authorization code.
      await tx.oAuthCodeRedemption.deleteMany({ where: { expiresAt: { lte: new Date() } } });
      await tx.oAuthCodeRedemption.create({
        data: { codeHash: input.codeHash, expiresAt: input.expiresAt },
      });
      await tx.apiKey.create({
        data: {
          userId: input.userId,
          name: input.name.slice(0, 60) || 'OAuth client',
          prefix: raw.slice(0, 10),
          hash: hash(raw),
          resource: input.resource,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Authorization code already used', 400, 'invalid_grant');
    }
    throw error;
  }
  return raw;
}

export function listApiKeys(userId: string) {
  return db().apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      prefix: true,
      createdAt: true,
      lastUsedAt: true,
      resource: true,
      scopes: true,
      creditLimit: true,
      spentCredits: true,
      expiresAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeApiKey(userId: string, id: string) {
  await db().apiKey.deleteMany({ where: { id, userId } });
}

export type ApiKeyPrincipal = {
  id: string;
  userId: string;
  resource: string | null;
  scopes: ApiKeyScope[];
  creditLimit: number | null;
  spentCredits: number;
  expiresAt: Date | null;
};

const USAGE_WRITE_INTERVAL_MS = 5 * 60 * 1000;

export async function verifyApiKeyPrincipal(
  raw: string | null | undefined,
): Promise<ApiKeyPrincipal | null> {
  if (!raw?.startsWith('er_')) return null;
  const key = await db().apiKey.findUnique({ where: { hash: hash(raw) } });
  if (!key) return null;
  if (key.resource && key.resource !== `${config.appUrl()}/api/mcp`) return null;
  const now = new Date();
  if (key.expiresAt && key.expiresAt <= now) return null;
  const cutoff = new Date(now.getTime() - USAGE_WRITE_INTERVAL_MS);
  if (!key.lastUsedAt || key.lastUsedAt <= cutoff) {
    const { count } = await db().apiKey.updateMany({
      where: { id: key.id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lte: cutoff } }] },
      data: { lastUsedAt: now },
    });
    // Another request may have refreshed the timestamp, or the owner may have revoked the key.
    // updateMany never throws P2025 if deletion wins the race. Re-read rather than accepting a
    // revoked key from a stale in-process cache.
    if (count === 0 && !(await db().apiKey.findUnique({ where: { id: key.id } }))) return null;
  }
  return {
    id: key.id,
    userId: key.userId,
    resource: key.resource,
    scopes: key.scopes.filter(isApiKeyScope),
    creditLimit: key.creditLimit,
    spentCredits: key.spentCredits,
    expiresAt: key.expiresAt,
  };
}

export async function verifyApiKey(raw: string | null | undefined): Promise<string | null> {
  return (await verifyApiKeyPrincipal(raw))?.userId ?? null;
}

export function bearerToken(headers: Headers): string | null {
  const value = headers.get('authorization');
  return value?.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : null;
}
