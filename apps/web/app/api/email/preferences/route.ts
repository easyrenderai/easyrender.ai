import {
  AppError,
  dispatchMailingConfirmation,
  mailingStatus,
  reportError,
  requestMailing,
  stopMailing,
} from '@easyrender/core';
import { after } from 'next/server';
import { currentUser } from '@/lib/actor';
import { mailingOriginMap, mailingSystemCopies } from '@/lib/mailing';
import { mailingJson, mailingResponse, requireMailingOrigin } from '@/lib/mailing-http';

export const maxDuration = 60;

async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError('Sign in first', 401, 'unauthorized');
  return user;
}
export const GET = () =>
  mailingResponse(async () => Response.json(await mailingStatus((await requireUser()).id)));
export const POST = (request: Request) =>
  mailingResponse(async () => {
    requireMailingOrigin(request);
    const user = await requireUser();
    const body = await mailingJson(request);
    if (body.intent === 'unsubscribe') {
      await stopMailing(user.id);
    } else if (body.intent === 'subscribe') {
      if (body.locale !== 'es' && body.locale !== 'en')
        throw new AppError('Choose Spanish or English', 400, 'invalid_locale');
      if (typeof body.timezone !== 'string' || body.timezone.length > 100)
        throw new AppError('Choose a valid timezone', 400, 'invalid_timezone');
      try {
        new Intl.DateTimeFormat('en', { timeZone: body.timezone }).format();
      } catch {
        throw new AppError('Choose a valid timezone', 400, 'invalid_timezone');
      }
      await requestMailing(
        user.id,
        { locale: body.locale, timezone: body.timezone },
        mailingOriginMap,
        mailingSystemCopies,
      );
      after(async () => {
        try {
          await dispatchMailingConfirmation(user.id);
        } catch {
          reportError(new Error('Mailing confirmation dispatch failed'));
        }
      });
    } else throw new AppError('Choose subscribe or unsubscribe', 400, 'invalid_intent');
    return Response.json(await mailingStatus(user.id));
  });
