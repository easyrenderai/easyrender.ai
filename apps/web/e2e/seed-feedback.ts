// Local browser fixtures only. Existing showcase bytes, no provider or remote database calls.
import { copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { db } from '@easyrender/db';

const url = process.env.DATABASE_URL;
if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || process.env.VERCEL)
  throw new Error('Local database required');
const userId = process.argv[2];
if (!userId) throw new Error('Pass the local test user ID');
const assetDir = join(tmpdir(), 'easyrender-e2e-storage', 'feedback');
mkdirSync(assetDir, { recursive: true });
for (const extension of ['glb', 'jpg']) {
  copyFileSync(`public/showcase/clay-vase.${extension}`, join(assetDir, `vase.${extension}`));
}
const renders = await Promise.all(
  [true, true, true, false].map((isReady) =>
    db().render.create({
      data: {
        userId,
        name: 'Feedback fixture',
        sourceKey: 'local:feedback/vase.jpg',
        status: isReady ? 'ready' : 'rendering',
        glbKey: isReady ? 'local:feedback/vase.glb' : null,
        isPublic: true,
      },
      select: { id: true },
    }),
  ),
);
await db().$disconnect();
process.stdout.write(JSON.stringify(renders.map(({ id }) => id)));
