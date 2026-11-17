import { beforeEach, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ linkSocial: vi.fn(), signIn: { social: vi.fn() } }));
vi.mock('@/lib/auth-client', () => ({ authClient: sdk }));

import { startAdminGoogleRecovery } from './google-recovery';

beforeEach(() => vi.clearAllMocks());

it('starts explicit linking first and returns to the recovery screen', async () => {
  await startAdminGoogleRecovery(false, '/admin/analytics?period=90d', 'es');
  expect(sdk.signIn.social).not.toHaveBeenCalled();
  expect(sdk.linkSocial).toHaveBeenCalledWith({
    provider: 'google',
    callbackURL: '/sign-in/admin?next=%2Fadmin%2Fanalytics%3Fperiod%3D90d&locale=es',
    errorCallbackURL: '/sign-in/admin?next=%2Fadmin%2Fanalytics%3Fperiod%3D90d&locale=es',
  });
});

it('requests a session-bound Google sign-in only after linking', async () => {
  await startAdminGoogleRecovery(true, '/admin/analytics?period=90d', 'en');
  expect(sdk.linkSocial).not.toHaveBeenCalled();
  expect(sdk.signIn.social).toHaveBeenCalledWith({
    provider: 'google',
    callbackURL: '/admin/analytics?period=90d',
    errorCallbackURL: '/sign-in/admin?next=%2Fadmin%2Fanalytics%3Fperiod%3D90d&locale=en',
    additionalData: { adminRecovery: true },
  });
});
