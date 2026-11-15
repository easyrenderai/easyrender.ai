import type { ApiKeyScope } from './api-keys';
import { AppError } from './errors';
import type { Actor } from './renders';

export function assertActorScope(actor: Actor, scope: ApiKeyScope) {
  // Browser sessions and trusted background workers use the existing ownership checks.
  if (actor.apiKeyId && !actor.apiKeyScopes?.includes(scope)) {
    throw new AppError(`This API key requires the ${scope} scope`, 403, 'insufficient_scope');
  }
}
