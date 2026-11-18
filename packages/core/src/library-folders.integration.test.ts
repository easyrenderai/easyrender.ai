import { db } from '@easyrender/db';
import { afterAll, describe, expect, it } from 'vitest';

// Runs against a real Postgres: set TEST_DATABASE_URL (a scratch database with the schema pushed).
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const run = describe.skipIf(!url);

run('library folders (real database)', () => {
  const load = async () => import('./library-folders');
  const newUser = async () => {
    const id = `u_${Math.random().toString(36).slice(2)}`;
    await db().user.create({ data: { id, name: 'T', email: `${id}@example.com` } });
    return id;
  };
  const newRender = async (userId: string) =>
    (await db().render.create({ data: { userId, sourceKey: 'fake:source.jpg' } })).id;
  const folderOf = async (renderId: string) =>
    (await db().render.findUniqueOrThrow({ where: { id: renderId } })).folderId;

  afterAll(async () => {
    await db().$disconnect();
  });

  it('files a render in a folder and lists the folder', async () => {
    const lib = await load();
    const userId = await newUser();
    const folder = await lib.createFolder(userId, ' Kitchen ');
    const renderId = await newRender(userId);
    expect(await lib.moveRenders(userId, [renderId], folder.id)).toBe(1);
    expect(await folderOf(renderId)).toBe(folder.id);
    expect(await lib.listFolders(userId)).toEqual([{ id: folder.id, name: 'Kitchen' }]);
  });

  it('unfiles a render when the folder is null', async () => {
    const lib = await load();
    const userId = await newUser();
    const folder = await lib.createFolder(userId, 'Lighting');
    const renderId = await newRender(userId);
    await lib.moveRenders(userId, [renderId], folder.id);
    await lib.moveRenders(userId, [renderId], null);
    expect(await folderOf(renderId)).toBeNull();
  });

  it("never files someone else's render or uses someone else's folder", async () => {
    const lib = await load();
    const owner = await newUser();
    const other = await newUser();
    const ownerFolder = await lib.createFolder(owner, 'Mine');
    const ownerRender = await newRender(owner);
    const otherRender = await newRender(other);
    await expect(lib.moveRenders(other, [otherRender], ownerFolder.id)).rejects.toMatchObject({
      status: 404,
    });
    expect(await lib.moveRenders(owner, [otherRender], ownerFolder.id)).toBe(0);
    expect(await folderOf(otherRender)).toBeNull();
    expect(await folderOf(ownerRender)).toBeNull();
    await expect(lib.renameFolder(other, ownerFolder.id, 'Stolen')).rejects.toMatchObject({
      status: 404,
    });
    await expect(lib.deleteFolder(other, ownerFolder.id)).rejects.toMatchObject({ status: 404 });
    expect(await lib.listFolders(owner)).toEqual([{ id: ownerFolder.id, name: 'Mine' }]);
  });

  it('deleting a folder keeps its renders, unfiled', async () => {
    const lib = await load();
    const userId = await newUser();
    const folder = await lib.createFolder(userId, 'Old');
    const renderId = await newRender(userId);
    await lib.moveRenders(userId, [renderId], folder.id);
    await lib.deleteFolder(userId, folder.id);
    expect(await folderOf(renderId)).toBeNull();
    expect(await db().render.count({ where: { id: renderId } })).toBe(1);
  });

  it('refuses a second folder with the same name, for the same owner only', async () => {
    const lib = await load();
    const userId = await newUser();
    const other = await newUser();
    await lib.createFolder(userId, 'Chairs');
    await expect(lib.createFolder(userId, 'Chairs')).rejects.toMatchObject({
      status: 409,
      code: 'folder_exists',
    });
    const second = await lib.createFolder(userId, 'Tables');
    await expect(lib.renameFolder(userId, second.id, 'Chairs')).rejects.toMatchObject({
      code: 'folder_exists',
    });
    await expect(lib.createFolder(other, 'Chairs')).resolves.toMatchObject({ name: 'Chairs' });
  });

  it('stops at the folder limit', async () => {
    const lib = await load();
    const userId = await newUser();
    for (let n = 0; n < lib.MAX_FOLDERS; n++) await lib.createFolder(userId, `Folder ${n}`);
    await expect(lib.createFolder(userId, 'One more')).rejects.toMatchObject({
      code: 'folder_limit',
    });
  });
});
