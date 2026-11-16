import {
  AppError,
  bearerToken,
  consumeApiRateLimit,
  getBalance,
  verifyApiKeyPrincipal,
} from '@easyrender/core';
import { db } from '@easyrender/db';
import { currentUser } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

// Intentionally separate from resolveActor: a browser session is never proof of a working key.
export async function POST(request: Request) {
  return apiHandle(request, async () => {
    const token = bearerToken(request.headers);
    if (!token) throw new AppError('Supply an API key to verify', 401, 'key_required');
    const principal = await verifyApiKeyPrincipal(token);
    if (!principal) throw new AppError('Invalid or expired API key', 401, 'unauthorized');
    await consumeApiRateLimit(`api:${principal.id}`, 120);
    const sessionUser = await currentUser();
    if (sessionUser && sessionUser.id !== principal.userId)
      throw new AppError('Use a key from your signed-in account', 403, 'account_mismatch');
    if (!principal.scopes.includes('read'))
      throw new AppError('This check requires read permission', 403, 'insufficient_scope');
    const account = await db().user.findUnique({
      where: { id: principal.userId },
      select: { name: true, email: true },
    });
    if (!account) throw new AppError('Account unavailable', 401, 'unauthorized');
    const balance = await getBalance(principal.userId);
    return Response.json({
      account,
      balance,
      key: {
        scopes: principal.scopes,
        expiresAt: principal.expiresAt?.toISOString() ?? null,
        creditLimit: principal.creditLimit,
        spentCredits: principal.spentCredits,
        remainingCredits:
          principal.creditLimit === null
            ? null
            : Math.max(0, principal.creditLimit - principal.spentCredits),
      },
    });
  });
}
export const OPTIONS = apiOptions;
