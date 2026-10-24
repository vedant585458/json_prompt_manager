/**
 * Organization helpers (TASK-012).
 *
 * Folder and collection dialogs need the same small set of derived facts: which
 * parents may be chosen without creating a cycle, how many prompts and child
 * folders a deletion would touch, and how a tag field turns into stored tags.
 * Those live here as pure functions so the dialogs only render, and so the
 * rules are testable without a DOM.
 */

import { checkFolderMove, folderPath, normalizeTags } from '@/domain/invariants';
import type { Collection, DomainIssue, Folder, Prompt } from '@/domain/types';
import { buildFolderTree, flattenFolderTree, folderSubtreeIds } from '@/lib/folderTree';

export interface OrganizationOption {
  readonly value: string;
  readonly label: string;
}

export const ROOT_FOLDER_VALUE = '';

/** `A / B / C` for a folder, or `null` when the id is unknown. */
export function folderLabel(folders: readonly Folder[], folderId: string): string | null {
  const path = folderPath(folders, folderId);
  return path.length > 0 ? path.join(' / ') : null;
}

/**
 * Folder choices for a parent select.
 *
 * The folder being edited and everything below it are left out, because a
 * folder cannot contain itself; the domain re-checks on submit for stored data
 * that already contains a cycle. `includeRoot` adds the "No parent" option.
 */
export function folderOptions(
  folders: readonly Folder[],
  options: {
    readonly excludeFolderId?: string | null;
    readonly includeRoot?: boolean;
    readonly rootLabel?: string;
  } = {},
): OrganizationOption[] {
  const excluded = options.excludeFolderId ?? null;
  // A folder cannot contain itself: drop it and everything below it.
  const blocked =
    excluded === null ? new Set<string>() : new Set(folderSubtreeIds(folders, excluded));

  const flat = flattenFolderTree(buildFolderTree(folders)).filter(
    (entry) => !blocked.has(entry.folder.id),
  );

  const choices: OrganizationOption[] = flat.map((entry) => ({
    value: entry.folder.id,
    label: `${'\u00a0\u00a0'.repeat(entry.depth)}${entry.depth > 0 ? '\u21b3 ' : ''}${entry.folder.name}`,
  }));

  if (options.includeRoot === false) return choices;
  return [
    { value: ROOT_FOLDER_VALUE, label: options.rootLabel ?? 'No parent (top level)' },
    ...choices,
  ];
}

/** Prompts and child folders that a folder deletion would move up one level. */
export function countFolderContents(
  prompts: readonly Prompt[],
  folders: readonly Folder[],
  folderId: string,
): { readonly prompts: number; readonly folders: number } {
  return {
    prompts: prompts.filter((prompt) => prompt.folderId === folderId).length,
    folders: folders.filter((folder) => folder.parentId === folderId).length,
  };
}

/** Prompts that would lose their membership if a collection were deleted. */
export function countCollectionMembers(prompts: readonly Prompt[], collectionId: string): number {
  return prompts.filter((prompt) => prompt.collectionIds.includes(collectionId)).length;
}

/** Name shown in confirmation copy for a folder's new home. */
export function parentFolderLabel(folders: readonly Folder[], parentId: string | null): string {
  if (parentId === null) return 'the top level';
  return folders.find((folder) => folder.id === parentId)?.name ?? 'the parent folder';
}

/**
 * Rules that must hold before a folder may be re-parented.
 *
 * Kept separate from the store so a dialog can show the message beside the
 * select while the user is still choosing.
 */
export function folderMoveIssues(
  folders: readonly Folder[],
  folderId: string,
  parentId: string | null,
): readonly DomainIssue[] {
  return checkFolderMove(folders, folderId, parentId);
}

/** Splits a comma- or newline-separated tag field into stored tags. */
export function parseTagInput(raw: string): string[] {
  return normalizeTags(raw.split(/[,\n]/));
}

/** Renders stored tags back into the comma-separated field. */
export function formatTagInput(tags: readonly string[]): string {
  return tags.join(', ');
}

/** Collections sorted A→Z, as every collection control shows them. */
export function sortedCollections(collections: readonly Collection[]): Collection[] {
  return [...collections].sort((left, right) =>
    left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }),
  );
}
