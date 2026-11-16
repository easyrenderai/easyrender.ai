import { AppError, confirmMailing } from '@easyrender/core';
import {
  mailingJson,
  mailingResponse,
  mailingToken,
  requireMailingOrigin,
} from '@/lib/mailing-http';

export const POST = (request: Request) =>
  mailingResponse(async () => {
    requireMailingOrigin(request);
    const { token } = await mailingJson(request);
    if (!(await confirmMailing(mailingToken(token))))
      throw new AppError('This link is invalid or expired', 400, 'invalid_token');
    return Response.json({ confirmed: true });
  });
