import { mailingStatus } from '@easyrender/core';
import { getLocale } from 'next-intl/server';
import { MailingPreferencesForm } from '@/components/mailing-preferences-form';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

export async function MailingPreferences({ userId }: { userId: string }) {
  // Preview deployments skip schema sync; never read the new table there or in local dev.
  // Production must still offer unsubscribe when the send flag is switched off.
  if (process.env.VERCEL_ENV !== 'production') return null;
  const [status, locale] = await Promise.all([mailingStatus(userId), getLocale()]);
  if (
    !status.isAvailable &&
    status.status !== 'active' &&
    status.status !== 'pending' &&
    status.status !== 'held'
  )
    return null;
  const uiLocale = locale === 'es' ? 'es' : 'en';
  return (
    <MailingPreferencesForm
      initial={status}
      copy={(uiLocale === 'es' ? es : en).MailingUI}
      uiLocale={uiLocale}
    />
  );
}
