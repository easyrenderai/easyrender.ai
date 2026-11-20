import { LegalPage } from '@/components/legal-page';
import { legalMetadata } from '@/lib/seo/pages';

export function generateMetadata() {
  return legalMetadata('terms', 'en');
}

export default function TermsPage() {
  return <LegalPage kind="terms" locale="en" />;
}
