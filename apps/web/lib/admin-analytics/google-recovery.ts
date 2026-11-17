import { adminReturnPath, adminVerificationPath } from '@/lib/admin-analytics/navigation';
import { authClient } from '@/lib/auth-client';

export function startAdminGoogleRecovery(
  hasGoogleAccount: boolean,
  next: string,
  locale: 'en' | 'es',
) {
  const target = adminReturnPath(next);
  const recovery = `${adminVerificationPath(target)}&locale=${locale}`;
  if (!hasGoogleAccount)
    return authClient.linkSocial({
      provider: 'google',
      callbackURL: recovery,
      errorCallbackURL: recovery,
    });
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: target,
    errorCallbackURL: recovery,
    additionalData: { adminRecovery: true },
  });
}
