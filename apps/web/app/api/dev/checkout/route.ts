import {
  AppError,
  checkoutInlineReturn,
  checkoutReturnPath,
  devGrant,
  parseCheckout,
} from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { handle } from '@/lib/http';

// Local only: grants credits without Stripe. devGrant refuses in production or when Stripe is set.
export const GET = (request: Request) =>
  handle(async () => {
    const { userId, anonId } = await resolveActor(request.headers);
    if (!userId) throw new AppError('Sign in first', 401, 'unauthorized');
    const url = new URL(request.url);
    const request_ = parseCheckout({
      plan: url.searchParams.get('plan'),
      credits: url.searchParams.get('credits'),
    });
    await devGrant(userId, request_, anonId);
    const next = checkoutReturnPath(url.searchParams.get('next'));
    // A pack bought from a build button goes back to that render, as the Stripe return does.
    const inline = checkoutInlineReturn({
      next,
      inline: url.searchParams.get('inline') === '1',
      quality: url.searchParams.get('quality'),
    });
    if (inline) {
      const back = new URL(`${inline.path}?purchase=success${inline.quality}`, url);
      return NextResponse.redirect(back);
    }
    const destination = new URL('/credits', url);
    if (next) destination.searchParams.set('next', next);
    return NextResponse.redirect(destination);
  });
