'use client';

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

// Last-resort boundary for errors in the root layout. It has no providers, so no translations.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  // use-effect-audit: ignore reports the error to Sentry, an external system
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
