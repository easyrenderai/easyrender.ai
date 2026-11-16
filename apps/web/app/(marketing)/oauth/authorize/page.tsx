import { AppError, parseAuthorizeRequest } from '@easyrender/core';
import { BadgeCheck, Laptop, Plug, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { currentUser } from '@/lib/actor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Connect · easyrender', robots: { index: false } };

// Consent screen for MCP clients (claude.ai and others) that connect through OAuth.
export default async function AuthorizePage({ searchParams }: PageProps<'/oauth/authorize'>) {
  const t = await getTranslations('OAuth');
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') params.set(key, value);
  }

  let request: ReturnType<typeof parseAuthorizeRequest> | null = null;
  try {
    request = parseAuthorizeRequest(params);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }

  const host = request ? new URL(request.redirectUri).host : '';
  const isUnverified = request?.trust === 'unverified';

  if (request) {
    const user = await currentUser();
    if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/oauth/authorize?${params}`)}`);
  }

  return (
    <div className="mx-auto flex max-w-md px-4 py-16 sm:px-6">
      <Card className="w-full">
        {request ? (
          <form method="post" action="/api/oauth/authorize" className="contents">
            <input type="hidden" name="query" value={params.toString()} />
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg border bg-muted">
                <Plug className="size-5" />
              </div>
              <CardTitle className="text-xl">
                {t('title', { client: request.client.name })}
              </CardTitle>
              <CardDescription>
                {t('description', {
                  client: request.client.name,
                  host,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant={isUnverified ? 'destructive' : 'default'} className="mb-4">
                {request.trust === 'verified' ? (
                  <BadgeCheck />
                ) : request.trust === 'local' ? (
                  <Laptop />
                ) : (
                  <ShieldAlert />
                )}
                <AlertTitle>{t(`trust.${request.trust}`)}</AlertTitle>
                <AlertDescription>
                  {t(`trust.${request.trust}Body`, { client: request.client.name, host })}
                </AlertDescription>
              </Alert>
              <p className="mb-4 text-sm text-muted-foreground">
                {t('trust.returnsTo')}{' '}
                <span className="break-all font-mono text-foreground">{host}</span>
              </p>
              <ul className="space-y-2 text-sm">
                {(['create', 'read', 'spend'] as const).map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    {t(`can.${key}`)}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">{t('revoke')}</p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button
                type="submit"
                name="decision"
                value="approve"
                variant={isUnverified ? 'outline' : 'default'}
                className="flex-1"
              >
                {t(isUnverified ? 'trust.approveAnyway' : 'approve')}
              </Button>
              <Button
                type="submit"
                name="decision"
                value="deny"
                variant={isUnverified ? 'default' : 'outline'}
              >
                {t('deny')}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <CardHeader>
            <TriangleAlert className="mb-2 size-5 text-destructive" />
            <CardTitle>{t('invalidTitle')}</CardTitle>
            <CardDescription>{t('invalidBody')}</CardDescription>
          </CardHeader>
        )}
      </Card>
    </div>
  );
}
