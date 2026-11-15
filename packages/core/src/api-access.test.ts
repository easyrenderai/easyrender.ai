import { expect, it } from 'vitest';
import { assertActorScope } from './api-access';

it('rejects a key missing the required capability', () => {
  expect(() =>
    assertActorScope({ userId: 'u', apiKeyId: 'k', apiKeyScopes: ['read'] }, 'spend'),
  ).toThrow('spend');
  expect(() => assertActorScope({ userId: 'u', apiKeyId: 'k' }, 'write')).toThrow('write');
});
it('allows a scoped key and leaves browser ownership decisions to the operation', () => {
  expect(() =>
    assertActorScope({ userId: 'u', apiKeyId: 'k', apiKeyScopes: ['spend'] }, 'spend'),
  ).not.toThrow();
  expect(() => assertActorScope({ userId: 'u' }, 'spend')).not.toThrow();
});
