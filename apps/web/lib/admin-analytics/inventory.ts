import 'server-only';
import { loadAdminRenders, loadBuyers, signAdminAsset } from '@easyrender/core/admin-analytics';
import { requireAdmin } from './auth';

export async function buyersData() {
  await requireAdmin();
  return loadBuyers();
}
export async function rendersData(page?: string, status?: string) {
  await requireAdmin();
  const data = await loadAdminRenders(page, status);
  return {
    ...data,
    renders: data.renders.map((render) => ({
      ...render,
      previewUrl: render.hasSheet || render.hasSource ? signAdminAsset(render.id, 'preview') : null,
    })),
  };
}
