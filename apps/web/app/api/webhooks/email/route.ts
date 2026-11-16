import { handleMailingWebhook, handleServiceEmailWebhook } from '@easyrender/core';
import { mailingBody, mailingResponse } from '@/lib/mailing-http';

export const POST = (request: Request) =>
  mailingResponse(async () => {
    // The verifier receives the exact text and Svix headers; never parse/re-serialize before verifying.
    const raw = await mailingBody(request, 1_048_576);
    await handleMailingWebhook(raw, request.headers);
    await handleServiceEmailWebhook(raw, request.headers);
    return Response.json({ received: true });
  });
