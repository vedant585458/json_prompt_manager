import { describe, expect, it } from 'vitest';

import { buildFolderTree, flattenFolderTree, folderSubtreeIds } from '@/lib/folderTree';
import type { Folder } from '@/domain/types';

function folder(id: string, name: string, parentId: string | null = null): Folder {
  return {
    id,
    name,
    parentId,
    createdAt: '2026-10-24T09:00:00.000Z',
    updatedAt: '2026-10-24T09:00:00.000Z',
  };
}

describe('buildFolderTree', () => {
  it('nests children and sorts siblings by name', () => {
    const tree = buildFolderTree([
      folder('b', 'Beta'),
      folder('a', 'Alpha'),
      folder('b1', 'Beta child', 'b'),
      folder('a1', 'Alpha child', 'a'),
    ]);

    expect(tree.map((node) => node.folder.name)).toEqual(['Alpha', 'Beta']);
    expect(tree[0]?.children.map((node) => node.folder.name)).toEqual(['Alpha child']);
    expect(tree[1]?.children.map((node) => node.folder.name)).toEqual(['Beta child']);
  });

  it('shows a folder with a missing parent at the top level', () => {
    const tree = buildFolderTree([folder('orphan', 'Orphan', 'deleted-parent')]);
    expect(tree.map((node) => node.folder.name)).toEqual(['Orphan']);
  });

  it('promotes folders caught in a parent cycle instead of hanging', () => {
    const tree = buildFolderTree([
      folder('a', 'A', 'b'),
      folder('b', 'B', 'a'),
      folder('root', 'Root'),
    ]);

    // Real roots come first, then the folders the cycle left unreachable. Each
    // folder appears exactly once: the loop is broken, not followed.
    expect(tree.map((node) => node.folder.name)).toEqual(['Root', 'A']);

    const flattened = flattenFolderTree(tree).map((entry) => entry.folder.id);
    expect(flattened.sort()).toEqual(['a', 'b', 'root']);
  });

  it('returns an empty tree for no folders', () => {
    expect(buildFolderTree([])).toEqual([]);
  });
});

describe('flattenFolderTree', () => {
  it('walks depth-first and tracks the indent level', () => {
    const tree = buildFolderTree([
      folder('a', 'A'),
      folder('a1', 'A1', 'a'),
      folder('a11', 'A11', 'a1'),
      folder('b', 'B'),
    ]);

    expect(flattenFolderTree(tree)).toEqual([
      { folder: expect.objectContaining({ id: 'a' }), depth: 0 },
      { folder: expect.objectContaining({ id: 'a1' }), depth: 1 },
      { folder: expect.objectContaining({ id: 'a11' }), depth: 2 },
      { folder: expect.objectContaining({ id: 'b' }), depth: 0 },
    ]);
  });
});

describe('folderSubtreeIds', () => {
  const folders = [
    folder('a', 'A'),
    folder('a1', 'A1', 'a'),
    folder('a11', 'A11', 'a1'),
    folder('b', 'B'),
  ];

  it('includes the folder itself and every descendant', () => {
    expect(folderSubtreeIds(folders, 'a').sort()).toEqual(['a', 'a1', 'a11']);
  });

  it('does not include siblings', () => {
    expect(folderSubtreeIds(folders, 'a1').sort()).toEqual(['a1', 'a11']);
  });

  it('returns the id itself when the folder is unknown', () => {
    expect(folderSubtreeIds(folders, 'gone')).toEqual(['gone']);
  });

  it('survives a cycle without repeating ids', () => {
    const cyclic = [folder('x', 'X', 'y'), folder('y', 'Y', 'x')];
    expect(folderSubtreeIds(cyclic, 'x').sort()).toEqual(['x', 'y']);
  });
});
