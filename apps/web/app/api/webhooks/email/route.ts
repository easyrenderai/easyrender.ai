import { handleMailingWebhook } from '@easyrender/core';
import { mailingBody, mailingResponse } from '@/lib/mailing-http';

export const POST = (request: Request) =>
  mailingResponse(async () => {
    // The verifier receives the exact text and Svix headers; never parse/re-serialize before verifying.
    await handleMailingWebhook(await mailingBody(request, 1_048_576), request.headers);
    return Response.json({ received: true });
  });
