import { db, Prisma, type Render } from '@easyrender/db';
import { AppError } from './errors';
import { type RenderView, toView } from './renders';

export const FOLDER_NAME_MAX = 40;
export const MAX_FOLDERS = 50;
export const MAX_MOVE = 200;

export type LibraryFolderView = { id: string; name: string };
// A render as the library shows it: the public view plus the folder it is filed in.
export type LibraryItemView = RenderView & { folderId: string | null };

const folderNotFound = () => new AppError('Folder not found', 404, 'folder_not_found');

// One line, single spaces, 1 to FOLDER_NAME_MAX characters.
export function cleanFolderName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (name.length === 0 || name.length > FOLDER_NAME_MAX) {
    throw new AppError(
      `Folder names are 1 to ${FOLDER_NAME_MAX} characters`,
      400,
      'bad_folder_name',
    );
  }
  return name;
}

function isDuplicate(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const duplicate = () =>
  new AppError('A folder with that name already exists', 409, 'folder_exists');

export function toLibraryView(render: Render): LibraryItemView {
  return { ...toView(render), folderId: render.folderId };
}

export async function listFolders(userId: string): Promise<LibraryFolderView[]> {
  return db().libraryFolder.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

export async function createFolder(userId: string, rawName: unknown): Promise<LibraryFolderView> {
  const name = cleanFolderName(rawName);
  if ((await db().libraryFolder.count({ where: { userId } })) >= MAX_FOLDERS) {
    throw new AppError(`You can have up to ${MAX_FOLDERS} folders`, 409, 'folder_limit');
  }
  try {
    return await db().libraryFolder.create({
      data: { userId, name },
      select: { id: true, name: true },
    });
  } catch (error) {
    throw isDuplicate(error) ? duplicate() : error;
  }
}

export async function renameFolder(
  userId: string,
  id: string,
  rawName: unknown,
): Promise<LibraryFolderView> {
  const name = cleanFolderName(rawName);
  try {
    const { count } = await db().libraryFolder.updateMany({
      where: { id, userId },
      data: { name },
    });
    if (count === 0) throw folderNotFound();
  } catch (error) {
    throw isDuplicate(error) ? duplicate() : error;
  }
  return { id, name };
}

// The renders stay in the library, unfiled.
export async function deleteFolder(userId: string, id: string): Promise<void> {
  const { count } = await db().libraryFolder.deleteMany({ where: { id, userId } });
  if (count === 0) throw folderNotFound();
}

// Files renders in a folder, or unfiles them with a null folder. Only the owner's renders move,
// into the owner's folder; anything else in the list is ignored.
export async function moveRenders(
  userId: string,
  renderIds: unknown,
  folderId: unknown,
): Promise<number> {
  if (
    !Array.isArray(renderIds) ||
    renderIds.length === 0 ||
    renderIds.length > MAX_MOVE ||
    !renderIds.every((id) => typeof id === 'string')
  ) {
    throw new AppError(`Send 1 to ${MAX_MOVE} render ids`, 400, 'bad_move');
  }
  if (folderId !== null && typeof folderId !== 'string') {
    throw new AppError('folderId must be a folder id or null', 400, 'bad_move');
  }
  if (
    folderId !== null &&
    !(await db().libraryFolder.findFirst({ where: { id: folderId, userId } }))
  ) {
    throw folderNotFound();
  }
  const { count } = await db().render.updateMany({
    where: { id: { in: renderIds }, userId },
    data: { folderId },
  });
  return count;
}
