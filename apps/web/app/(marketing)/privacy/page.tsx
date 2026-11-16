import { LegalPage } from '@/components/legal-page';
import { legalMetadata } from '@/lib/seo/pages';

export function generateMetadata() {
  return legalMetadata('privacy', 'en');
}

export default function PrivacyPage() {
  return <LegalPage kind="privacy" locale="en" />;
}
