import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { authMetadata } from '@/lib/seo/auth';

export default function SignUpPage() {
  return (
    <Suspense>
      <AuthForm mode="sign-up" />
    </Suspense>
  );
}

export async function generateMetadata() {
  return authMetadata('sign-up', 'en');
}
