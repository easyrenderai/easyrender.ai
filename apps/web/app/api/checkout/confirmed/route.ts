import { confirmedPurchase } from '@easyrender/core';
import { resolveActor } from '@/lib/actor';
import {
  allowsServerAdvertisingMeasurement,
  allowsServerMeasurement,
} from '@/lib/analytics/measurement-consent';
import { handle } from '@/lib/http';
export const GET = (request: Request) =>
  handle(async () => {
    const { userId } = await resolveActor(request.headers);
    const session = new URL(request.url).searchParams.get('session_id');
    const result =
      userId && session
        ? await confirmedPurchase(
            userId,
            session,
            allowsServerMeasurement(request.headers),
            allowsServerAdvertisingMeasurement(request.headers),
          )
        : null;
    return Response.json(result, {
      status: result ? 200 : 404,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  });
