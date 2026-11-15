import { db } from '@easyrender/db';
import type { ApiKeyScope } from './api-keys';
import { AppError } from './errors';
import type { Actor } from './renders';

export function assertActorScope(actor: Actor, scope: ApiKeyScope) {
  // Browser sessions and trusted background workers use the existing ownership checks.
  if (actor.apiKeyId && !actor.apiKeyScopes?.includes(scope)) {
    throw new AppError(`This API key requires the ${scope} scope`, 403, 'insufficient_scope');
  }
}

export async function actorForApiKey(userId: string, apiKeyId?: string | null): Promise<Actor> {
  if (!apiKeyId) return { userId };
  const key = await db().apiKey.findUnique({ where: { id: apiKeyId } });
  if (!key || key.userId !== userId || (key.expiresAt && key.expiresAt <= new Date())) {
    throw new AppError(
      'The key that authorized this job is revoked or expired',
      403,
      'insufficient_scope',
    );
  }
  return { userId, apiKeyId, apiKeyScopes: key.scopes };
}
