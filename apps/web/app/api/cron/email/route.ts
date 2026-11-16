import { runMailing, runServiceEmails } from '@easyrender/core';
import { mailingCatalog, mailingSystemCopies } from '@/lib/mailing';
import { mailingResponse } from '@/lib/mailing-http';
import { serviceEmailTexts } from '@/lib/service-email';

export const maxDuration = 60;
export const GET = (request: Request) =>
  mailingResponse(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
      return new Response(null, { status: 401 });
    const [education, service] = await Promise.allSettled([
      runMailing(mailingCatalog, mailingSystemCopies),
      runServiceEmails(serviceEmailTexts),
    ]);
    if (education.status === 'rejected') throw education.reason;
    if (service.status === 'rejected') throw service.reason;
    return Response.json({ education: education.value, service: service.value });
  });
