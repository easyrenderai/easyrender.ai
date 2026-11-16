import { AppError, unsubscribeMailing } from '@easyrender/core';
import {
  mailingBody,
  mailingJson,
  mailingResponse,
  mailingToken,
  requireMailingOrigin,
} from '@/lib/mailing-http';

// RFC 8058 mailbox-provider POSTs authenticate with the signed query token, not a browser session.
export const POST = (request: Request) =>
  mailingResponse(async () => {
    const isOneClick =
      request.headers.get('content-type')?.split(';')[0].trim() ===
      'application/x-www-form-urlencoded';
    let token: string;
    if (isOneClick) {
      const body = new URLSearchParams(await mailingBody(request));
      if (body.get('List-Unsubscribe') !== 'One-Click')
        throw new AppError('Invalid unsubscribe request', 400, 'bad_body');
      token = mailingToken(new URL(request.url).searchParams.get('token'));
    } else {
      requireMailingOrigin(request);
      token = mailingToken((await mailingJson(request)).token);
    }
    if (!(await unsubscribeMailing(token)))
      throw new AppError('This link is invalid', 400, 'invalid_token');
    return Response.json({ unsubscribed: true });
  });
