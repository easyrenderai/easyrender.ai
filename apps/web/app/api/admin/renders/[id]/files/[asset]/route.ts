import { adminAssetResponse } from '@/lib/admin-analytics/asset-route';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; asset: string }> },
) {
  const { id, asset } = await context.params;
  return adminAssetResponse(request, id, asset, true);
}
