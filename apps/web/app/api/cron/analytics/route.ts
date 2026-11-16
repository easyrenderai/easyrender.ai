import { flushAnalyticsDeliveries } from '@easyrender/core';
import { handle } from '@/lib/http';
export const maxDuration = 60;
export const GET = (request: Request) =>
  handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
      return new Response(null, { status: 401 });
    return Response.json((await flushAnalyticsDeliveries()) ?? { disabled: true });
  });
