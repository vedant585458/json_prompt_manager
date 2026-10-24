import { describe, expect, it } from 'vitest';

import {
  ROOT_FOLDER_VALUE,
  countCollectionMembers,
  countFolderContents,
  folderLabel,
  folderMoveIssues,
  folderOptions,
  formatTagInput,
  parentFolderLabel,
  parseTagInput,
  sortedCollections,
} from '@/features/organization/organization';
import { createCollection, createFolder, createPrompt } from '@/domain/factories';
import type { Collection, Folder, Prompt } from '@/domain/types';

const deps = { now: () => new Date('2026-10-24T09:00:00.000Z') };

function folder(id: string, name: string, parentId: string | null = null): Folder {
  return createFolder({ name, parentId }, { ...deps, newId: () => id });
}

function collection(id: string, name: string): Collection {
  return createCollection({ name }, { ...deps, newId: () => id });
}

function prompt(
  id: string,
  overrides: { folderId?: string | null; collectionIds?: string[] } = {},
) {
  return createPrompt(
    { title: `Prompt ${id}`, ...overrides },
    { ...deps, newId: () => id },
  ) as Prompt;
}

const tree: Folder[] = [
  folder('work', 'Work'),
  folder('drafts', 'Drafts', 'work'),
  folder('ideas', 'Ideas', 'drafts'),
  folder('personal', 'Personal'),
];

describe('folderOptions', () => {
  it('offers a root choice and indents nesting', () => {
    const options = folderOptions(tree);

    expect(options[0]).toEqual({ value: ROOT_FOLDER_VALUE, label: 'No parent (top level)' });
    expect(options.map((option) => option.value)).toEqual([
      ROOT_FOLDER_VALUE,
      'personal',
      'work',
      'drafts',
      'ideas',
    ]);
    expect(options[2]?.label).toBe('Work');
    expect(options[4]?.label).toContain('Ideas');
  });

  it('omits the folder being edited and everything below it', () => {
    const options = folderOptions(tree, { excludeFolderId: 'drafts' });

    expect(options.map((option) => option.value)).toEqual([ROOT_FOLDER_VALUE, 'personal', 'work']);
  });

  it('can omit the root option', () => {
    const options = folderOptions(tree, { includeRoot: false });
    expect(options.every((option) => option.value !== ROOT_FOLDER_VALUE)).toBe(true);
  });

  it('uses a caller-supplied root label', () => {
    expect(folderOptions([], { rootLabel: 'Unfiled' })).toEqual([
      { value: ROOT_FOLDER_VALUE, label: 'Unfiled' },
    ]);
  });

  it('never offers a folder that would create a cycle', () => {
    const options = folderOptions(tree, { excludeFolderId: 'work' });
    expect(options.map((option) => option.value)).toEqual([ROOT_FOLDER_VALUE, 'personal']);
  });
});

describe('folder descriptions', () => {
  it('builds a readable path', () => {
    expect(folderLabel(tree, 'ideas')).toBe('Work / Drafts / Ideas');
    expect(folderLabel(tree, 'missing')).toBeNull();
  });

  it('describes the destination of a deletion', () => {
    expect(parentFolderLabel(tree, 'work')).toBe('Work');
    expect(parentFolderLabel(tree, null)).toBe('the top level');
    expect(parentFolderLabel(tree, 'gone')).toBe('the parent folder');
  });

  it('counts prompts and child folders', () => {
    const prompts = [prompt('a', { folderId: 'drafts' }), prompt('b'), prompt('c')];
    expect(countFolderContents(prompts, tree, 'drafts')).toEqual({ prompts: 1, folders: 1 });
    expect(countFolderContents(prompts, tree, 'work')).toEqual({ prompts: 0, folders: 1 });
  });

  it('counts collection members', () => {
    const prompts = [
      prompt('a', { collectionIds: ['kit'] }),
      prompt('b', { collectionIds: ['kit', 'other'] }),
      prompt('c'),
    ];
    expect(countCollectionMembers(prompts, 'kit')).toBe(2);
    expect(countCollectionMembers(prompts, 'other')).toBe(1);
    expect(countCollectionMembers(prompts, 'missing')).toBe(0);
  });
});

describe('folderMoveIssues', () => {
  it('accepts a legal move', () => {
    expect(folderMoveIssues(tree, 'work', 'personal')).toEqual([]);
  });

  it('reports a move into the folder itself', () => {
    const issues = folderMoveIssues(tree, 'work', 'work');
    expect(issues[0]?.message).toMatch(/cannot be moved inside itself/);
  });

  it('reports a move into a descendant', () => {
    const issues = folderMoveIssues(tree, 'work', 'ideas');
    expect(issues[0]?.path).toBe('parentId');
  });
});

describe('tag input', () => {
  it('splits on commas and newlines, normalising each tag', () => {
    expect(parseTagInput('Finance, Legal\nfinance')).toEqual(['finance', 'legal']);
  });

  it('ignores empty entries', () => {
    expect(parseTagInput(' , , ')).toEqual([]);
  });

  it('round-trips through the field format', () => {
    expect(formatTagInput(['finance', 'legal'])).toBe('finance, legal');
    expect(parseTagInput(formatTagInput(['finance', 'legal']))).toEqual(['finance', 'legal']);
  });
});

describe('sortedCollections', () => {
  it('sorts case-insensitively by name', () => {
    const items = [collection('b', 'beta'), collection('a', 'Alpha')];
    expect(sortedCollections(items).map((item) => item.name)).toEqual(['Alpha', 'beta']);
  });

  it('does not mutate the input', () => {
    const items = [collection('b', 'beta'), collection('a', 'Alpha')];
    sortedCollections(items);
    expect(items.map((item) => item.name)).toEqual(['beta', 'Alpha']);
  });
});
