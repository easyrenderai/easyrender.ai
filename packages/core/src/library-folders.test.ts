import { describe, expect, it } from 'vitest';
import { AppError } from './errors';
import { cleanFolderName, FOLDER_NAME_MAX, moveRenders } from './library-folders';

const codeOf = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof AppError ? error.code : 'other';
  }
  return 'none';
};

describe('cleanFolderName', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanFolderName('  Kitchen   and\tdining ')).toBe('Kitchen and dining');
  });

  it('refuses an empty name, a blank one and a non-string', () => {
    expect(codeOf(() => cleanFolderName(''))).toBe('bad_folder_name');
    expect(codeOf(() => cleanFolderName('   '))).toBe('bad_folder_name');
    expect(codeOf(() => cleanFolderName(42))).toBe('bad_folder_name');
  });

  it('keeps a name at the limit and refuses one over it', () => {
    expect(cleanFolderName('a'.repeat(FOLDER_NAME_MAX))).toHaveLength(FOLDER_NAME_MAX);
    expect(codeOf(() => cleanFolderName('a'.repeat(FOLDER_NAME_MAX + 1)))).toBe('bad_folder_name');
  });
});

describe('moveRenders input', () => {
  it('refuses a body that is not a list of ids before touching the database', async () => {
    await expect(moveRenders('u1', 'r1', null)).rejects.toMatchObject({ code: 'bad_move' });
    await expect(moveRenders('u1', [], null)).rejects.toMatchObject({ code: 'bad_move' });
    await expect(moveRenders('u1', [1], null)).rejects.toMatchObject({ code: 'bad_move' });
    await expect(moveRenders('u1', ['r1'], 7)).rejects.toMatchObject({ code: 'bad_move' });
  });
});
