import {
  cleanApiRateWindows,
  cleanExpiredUploads,
  flushAnalyticsDeliveries,
  recoverAdvancedGenerations,
  recoverRenders,
} from '@easyrender/core';
import { handle } from '@/lib/http';

export const maxDuration = 300;
export const GET = (request: Request) =>
  handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
      return new Response(null, { status: 401 });
    const [recovered, advanced, , removedUploads, analytics] = await Promise.all([
      recoverRenders(),
      recoverAdvancedGenerations(3),
      cleanApiRateWindows(),
      cleanExpiredUploads(),
      flushAnalyticsDeliveries(),
    ]);
    return Response.json({ recovered, advanced, removedUploads, analytics });
  });
