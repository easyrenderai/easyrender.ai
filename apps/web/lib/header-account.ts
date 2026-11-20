import { getBalance } from '@easyrender/core';
import { getFormatter, getTranslations } from 'next-intl/server';
import type { AccountMenuCopy } from '@/components/account-menu';
import type { Locale } from '@/i18n/config';

// The same read as the Account page. A failure becomes a missing balance: the header hides the
// pill and does not show an error. The header awaits this with the session, so the pill is in the
// first HTML when the read succeeds and absent when it does not.
async function readBalance(userId: string): Promise<number | null> {
  try {
    return await getBalance(userId);
  } catch {
    return null;
  }
}

export async function loadHeaderAccount(userId: string, locale?: Locale): Promise<AccountMenuCopy> {
  const [balance, t, format] = await Promise.all([
    readBalance(userId),
    locale ? getTranslations({ locale, namespace: 'Header' }) : getTranslations('Header'),
    locale ? getFormatter({ locale }) : getFormatter(),
  ]);
  return {
    balanceLabel: balance === null ? null : t('creditsBalance', { count: balance }),
    balanceNumber: balance === null ? null : format.number(balance),
    accountLabel: t('account'),
    creditsLinkLabel: t('creditsLink'),
    menuLabel: t('accountMenu'),
  };
}
