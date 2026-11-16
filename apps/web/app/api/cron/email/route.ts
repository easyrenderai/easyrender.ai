import { runMailing } from '@easyrender/core';
import { mailingCatalog, mailingSystemCopies } from '@/lib/mailing';
import { mailingResponse } from '@/lib/mailing-http';

export const maxDuration = 60;
export const GET = (request: Request) =>
  mailingResponse(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
      return new Response(null, { status: 401 });
    return Response.json(await runMailing(mailingCatalog, mailingSystemCopies));
  });
