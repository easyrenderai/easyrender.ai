import { createHash } from 'node:crypto';
import { bearerToken, consumeApiRateLimit, verifyApiKeyPrincipal } from '@easyrender/core';
import { serveMcpRequest } from '@easyrender/mcp/http';
import { privacyRegion } from '@/lib/analytics/privacy-region';

export const maxDuration = 60;
export const runtime = 'nodejs';

const serve = (request: Request) =>
  serveMcpRequest(request, async (incoming) => {
    const principal = await verifyApiKeyPrincipal(bearerToken(incoming.headers));
    if (!principal) {
      const ip =
        incoming.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        incoming.headers.get('x-real-ip') ||
        'unknown';
      const subject = createHash('sha256').update(ip).digest('hex');
      await consumeApiRateLimit(`mcp:anonymous:${subject}`, 120);
      return null;
    }
    await consumeApiRateLimit(`api:${principal.id}`, 120);
    return {
      userId: principal.userId,
      source: 'mcp',
      apiKeyId: principal.id,
      apiKeyScopes: principal.scopes,
      geoCountry: privacyRegion(incoming.headers).country,
    };
  });

export { serve as DELETE, serve as GET, serve as POST, serve as OPTIONS };
