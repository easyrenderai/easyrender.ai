'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { isRoutableLocale } from '@/i18n/config';
import { authClient } from '@/lib/auth-client';
import { ROUTES } from '@/lib/seo/routes';

export function SignOutButton() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const locale = useLocale();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await authClient.signOut();
        router.push(ROUTES.home.paths[isRoutableLocale(locale) ? locale : 'en']);
        router.refresh();
      }}
    >
      {t('signOut')}
    </Button>
  );
}
