import { serviceEmailAvailable } from '@easyrender/core';
import type { Metadata } from 'next';
import { ServiceAuthForm } from '@/components/service-auth-form';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

type Props = { searchParams: Promise<{ token?: string; locale?: string; error?: string }> };
export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { locale } = await searchParams;
  return {
    title: (locale === 'es' ? es : en).AuthService.resetTitle,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}
export default async function Page({ searchParams }: Props) {
  const { token, locale, error } = await searchParams;
  const language = locale === 'es' ? 'es' : 'en';
  return (
    <ServiceAuthForm
      mode="reset"
      locale={language}
      copy={(language === 'es' ? es : en).AuthService}
      token={!error && typeof token === 'string' && token.length <= 4096 ? token : ''}
      isAvailable={serviceEmailAvailable()}
    />
  );
}
