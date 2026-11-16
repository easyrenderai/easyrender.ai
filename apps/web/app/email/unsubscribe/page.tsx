import type { Metadata } from 'next';
import { MailingTokenForm } from '@/components/mailing-token-form';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

type Props = { searchParams: Promise<{ token?: string; locale?: string }> };
export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { locale } = await searchParams;
  const copy = (locale === 'es' ? es : en).MailingUI;
  return {
    title: copy.unsubscribeTitle,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}
export default async function Page({ searchParams }: Props) {
  const { token, locale } = await searchParams;
  return (
    <MailingTokenForm
      intent="unsubscribe"
      token={typeof token === 'string' && token.length <= 4096 ? token : ''}
      uiLocale={locale === 'es' ? 'es' : 'en'}
      copy={(locale === 'es' ? es : en).MailingUI}
    />
  );
}
