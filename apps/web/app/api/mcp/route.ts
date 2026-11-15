import { bearerToken, verifyApiKey } from '@easyrender/core';
import { serveMcpRequest } from '@easyrender/mcp/http';
import { privacyRegion } from '@/lib/analytics/privacy-region';

export const maxDuration = 60;
export const runtime = 'nodejs';

const serve = (request: Request) =>
  serveMcpRequest(request, async (incoming) => {
    const userId = await verifyApiKey(bearerToken(incoming.headers));
    return userId ? { userId, geoCountry: privacyRegion(incoming.headers).country } : null;
  });

export { serve as DELETE, serve as GET, serve as POST, serve as OPTIONS };
