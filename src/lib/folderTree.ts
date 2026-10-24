/**
 * Folder tree helpers (TASK-011).
 *
 * Folders are stored flat with a `parentId`, so the library rail needs a small,
 * predictable tree builder. It is tolerant on purpose: a folder whose parent is
 * missing is shown at the top level, and a corrupt parent loop cannot hang the
 * render — folders caught in a cycle are promoted to the top level too. Storage
 * is untrusted input, and a broken tree must not cost the user their library.
 */

import type { Folder } from '@/domain/types';

export interface FolderNode {
  readonly folder: Folder;
  readonly children: readonly FolderNode[];
}

export interface FlatFolderNode {
  readonly folder: Folder;
  /** 0 for a top-level folder; one more than its parent otherwise. */
  readonly depth: number;
}

function compareFolders(left: Folder, right: Folder): number {
  const byName = left.name.localeCompare(right.name, 'en', { sensitivity: 'base' });
  return byName !== 0 ? byName : left.id.localeCompare(right.id);
}

function childrenByParent(folders: readonly Folder[]): Map<string | null, Folder[]> {
  const known = new Set(folders.map((folder) => folder.id));
  const grouped = new Map<string | null, Folder[]>();

  for (const folder of folders) {
    // An unknown parent is treated as "at the top level" rather than dropped.
    const key = folder.parentId !== null && known.has(folder.parentId) ? folder.parentId : null;
    const siblings = grouped.get(key) ?? [];
    siblings.push(folder);
    grouped.set(key, siblings);
  }

  for (const siblings of grouped.values()) siblings.sort(compareFolders);
  return grouped;
}

/** Builds a name-sorted tree; cycles and orphans cannot lose a folder. */
export function buildFolderTree(folders: readonly Folder[]): FolderNode[] {
  const grouped = childrenByParent(folders);
  const visited = new Set<string>();

  const build = (folder: Folder, ancestry: ReadonlySet<string>): FolderNode => {
    visited.add(folder.id);
    const nextAncestry = new Set(ancestry).add(folder.id);
    const children = (grouped.get(folder.id) ?? [])
      .filter((child) => !nextAncestry.has(child.id))
      .map((child) => build(child, nextAncestry));

    return { folder, children };
  };

  const roots = (grouped.get(null) ?? []).map((folder) => build(folder, new Set<string>()));

  // Anything still unvisited was unreachable from a top-level folder: a broken
  // parent chain or a loop. Promote it one at a time, skipping whatever an
  // earlier promotion already adopted, so no folder appears twice.
  const stranded: FolderNode[] = [];
  for (const folder of [...folders].sort(compareFolders)) {
    if (visited.has(folder.id)) continue;
    stranded.push(build(folder, new Set<string>()));
  }

  return [...roots, ...stranded];
}

/** Depth-first order with the indent level the rail renders. */
export function flattenFolderTree(nodes: readonly FolderNode[], depth = 0): FlatFolderNode[] {
  const flat: FlatFolderNode[] = [];

  for (const node of nodes) {
    flat.push({ folder: node.folder, depth });
    flat.push(...flattenFolderTree(node.children, depth + 1));
  }

  return flat;
}

/**
 * A folder and every folder below it.
 *
 * Selecting a parent in the rail should show its descendants too; that is what
 * users mean by "the Support folder". An unknown id returns itself so a stale
 * link filters to nothing instead of silently showing everything.
 */
export function folderSubtreeIds(folders: readonly Folder[], rootId: string): string[] {
  const grouped = childrenByParent(folders);
  const ids: string[] = [];
  const queue: string[] = [rootId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);

    for (const child of grouped.get(id) ?? []) {
      if (!seen.has(child.id)) queue.push(child.id);
    }
  }

  return ids;
}
