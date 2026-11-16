import { openapi } from '@/lib/api/openapi';

export function GET() {
  return Response.json(openapi, { headers: { 'cache-control': 'public, max-age=3600' } });
}
