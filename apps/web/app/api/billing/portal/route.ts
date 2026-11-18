import { AppError, createBillingPortal } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { isRoutableLocale } from '@/i18n/config';
import { resolveActor } from '@/lib/actor';
import { handle } from '@/lib/http';

export const POST = (request: Request) =>
  handle(async () => {
    const { userId } = await resolveActor(request.headers);
    if (!userId) throw new AppError('Sign in first', 401, 'unauthorized');
    const body: { locale?: unknown } = await request.json().catch(() => ({}));
    return NextResponse.json({
      url: await createBillingPortal(
        userId,
        isRoutableLocale(body?.locale) ? body.locale : undefined,
      ),
    });
  });
