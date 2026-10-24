/**
 * Domain invariants (TASK-005).
 *
 * Pure helpers that encode the rules from `tasks.md` §6.2: tag normalization,
 * folder-tree limits and cycle detection, unique folder names, monotonic
 * revision numbering, and the capped activity log. Nothing here mutates its
 * input, imports UI code, or touches storage.
 */

import type {
  ActivityEvent,
  Collection,
  DomainIssue,
  Folder,
  PromptRevision,
} from '@/domain/types';

/* -------------------------------------------------------------------------- */
/* Generic helpers                                                            */
/* -------------------------------------------------------------------------- */

/** True when any issue is fatal. */
export function hasErrors(issues: readonly DomainIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

/** True when at least one issue is advisory. */
export function hasWarnings(issues: readonly DomainIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'warning');
}

/* -------------------------------------------------------------------------- */
/* Tags                                                                       */
/* -------------------------------------------------------------------------- */

export const MAX_TAG_LENGTH = 32;

/**
 * Normalizes a tag for storage and comparison: lowercase, trimmed, spaces and
 * underscores collapsed to single hyphens, unsupported characters dropped.
 *
 * Returns `''` when nothing usable remains; callers drop those entries.
 */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_TAG_LENGTH)
    .replace(/-$/, '');
}

/** True when the raw value normalizes to a non-empty, storable tag. */
export function isValidTag(raw: string): boolean {
  return normalizeTag(raw).length > 0;
}

/** Normalizes a list of tags, dropping empties and duplicates, keeping order. */
export function normalizeTags(rawTags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of rawTags) {
    const tag = normalizeTag(raw);
    if (tag.length === 0 || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }

  return result;
}

/** One tag edit, expressed as additions and removals. */
export interface TagEdit {
  readonly add: readonly string[];
  readonly remove: readonly string[];
}

/**
 * Applies a tag edit to one prompt's tags.
 *
 * Removals win over additions, so a request that both adds and removes the same
 * tag deletes it rather than leaving the result ambiguous. Existing order is
 * preserved and new tags are appended, which keeps a prompt's tag list stable
 * across repeated bulk edits (TASK-013).
 */
export function applyTagEdit(current: readonly string[], edit: TagEdit): string[] {
  const remove = new Set(edit.remove.map(normalizeTag).filter((tag) => tag.length > 0));
  const kept = current.filter((tag) => !remove.has(normalizeTag(tag)));
  const additions = normalizeTags(edit.add).filter((tag) => !remove.has(tag));
  return normalizeTags([...kept, ...additions]);
}

/** Case-insensitive membership check for an already-normalized tag list. */
export function hasTag(tags: readonly string[], candidate: string): boolean {
  const normalized = normalizeTag(candidate);
  return normalized.length > 0 && tags.some((tag) => normalizeTag(tag) === normalized);
}

/* -------------------------------------------------------------------------- */
/* Titles                                                                     */
/* -------------------------------------------------------------------------- */

/** Collapses whitespace in a user-entered title. */
export function normalizeTitle(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Comparison key used for duplicate/conflict detection (case-insensitive). */
export function titleKey(raw: string): string {
  return normalizeTitle(raw).toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Variables                                                                  */
/* -------------------------------------------------------------------------- */

const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** True for `{{mustache}}`-friendly identifiers. */
export function isValidVariableName(name: string): boolean {
  return VARIABLE_NAME.test(name);
}

/** Trims and converts free text into a valid identifier where possible. */
export function normalizeVariableName(raw: string): string {
  const collapsed = raw
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (collapsed.length === 0) return '';
  return /^[0-9]/.test(collapsed) ? `v_${collapsed}` : collapsed;
}

/* -------------------------------------------------------------------------- */
/* Autosave                                                                   */
/* -------------------------------------------------------------------------- */

/** Spec §6.5: default 900 ms debounce, configurable within safe bounds. */
export const AUTOSAVE_DELAY = { min: 300, max: 5000, defaultValue: 900 } as const;

/** Clamps a requested autosave delay into the supported window. */
export function clampAutosaveDelay(value: number): number {
  if (!Number.isFinite(value)) return AUTOSAVE_DELAY.defaultValue;
  return Math.min(AUTOSAVE_DELAY.max, Math.max(AUTOSAVE_DELAY.min, Math.round(value)));
}

/* -------------------------------------------------------------------------- */
/* Folders                                                                    */
/* -------------------------------------------------------------------------- */

/** Maximum folder nesting depth (root folders are depth 1). */
export const MAX_FOLDER_DEPTH = 5;

function findFolder(folders: readonly Folder[], id: string): Folder | undefined {
  return folders.find((folder) => folder.id === id);
}

/**
 * Depth of a folder, counting itself as 1. Returns `null` when the folder is
 * missing from the list, and `Infinity` when the parent chain has a cycle.
 */
export function folderDepth(folders: readonly Folder[], folderId: string): number | null {
  let current = findFolder(folders, folderId);
  if (!current) return null;

  const seen = new Set<string>();
  let depth = 1;

  while (current.parentId !== null) {
    if (seen.has(current.id)) return Number.POSITIVE_INFINITY;
    seen.add(current.id);
    const parent = findFolder(folders, current.parentId);
    if (!parent) return null;
    current = parent;
    depth += 1;
  }

  return depth;
}

/** Names from the root to the folder, or `[]` when the folder is unknown. */
export function folderPath(folders: readonly Folder[], folderId: string): string[] {
  const path: string[] = [];
  const seen = new Set<string>();
  let current = findFolder(folders, folderId);

  while (current) {
    if (seen.has(current.id)) return [];
    seen.add(current.id);
    path.unshift(current.name);
    current = current.parentId ? findFolder(folders, current.parentId) : undefined;
  }

  return path;
}

/** True when `candidateId` sits somewhere below `folderId`. */
export function isDescendantFolder(
  folders: readonly Folder[],
  folderId: string,
  candidateId: string,
): boolean {
  const seen = new Set<string>();
  let current = findFolder(folders, candidateId);

  while (current && current.parentId !== null) {
    if (seen.has(current.id)) return false;
    seen.add(current.id);
    if (current.parentId === folderId) return true;
    current = findFolder(folders, current.parentId);
  }

  return false;
}

/** Folder ids that participate in a parent/child cycle (corrupt data guard). */
export function findFolderCycles(folders: readonly Folder[]): string[] {
  const cyclic = new Set<string>();

  for (const folder of folders) {
    const seen = new Set<string>();
    let current: Folder | undefined = folder;

    while (current && current.parentId !== null) {
      if (seen.has(current.id)) {
        cyclic.add(folder.id);
        break;
      }
      seen.add(current.id);
      current = findFolder(folders, current.parentId);
    }
  }

  return [...cyclic];
}

/** True when re-parenting `folderId` under `newParentId` would create a cycle. */
export function wouldCreateFolderCycle(
  folders: readonly Folder[],
  folderId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) return false;
  if (newParentId === folderId) return true;
  return isDescendantFolder(folders, folderId, newParentId);
}

/** Case-insensitive comparison key for folder names within one parent. */
export function folderNameKey(name: string): string {
  return normalizeTitle(name).toLowerCase();
}

/**
 * Checks that a folder name is available under `parentId`.
 *
 * Names are unique per parent (case-insensitive, whitespace-insensitive); two
 * different parents may each hold a "Drafts" folder.
 */
export function checkFolderName(
  folders: readonly Folder[],
  name: string,
  parentId: string | null,
  excludeId?: string,
): DomainIssue[] {
  const issues: DomainIssue[] = [];
  const trimmed = normalizeTitle(name);

  if (trimmed.length === 0) {
    issues.push({ path: 'name', message: 'Folder name cannot be empty.', severity: 'error' });
    return issues;
  }
  if (trimmed.length > 80) {
    issues.push({
      path: 'name',
      message: 'Folder name must be at most 80 characters.',
      severity: 'error',
    });
  }

  const key = folderNameKey(trimmed);
  const clash = folders.find(
    (folder) =>
      folder.id !== excludeId && folder.parentId === parentId && folderNameKey(folder.name) === key,
  );

  if (clash) {
    issues.push({
      path: 'name',
      message: `A folder named "${clash.name}" already exists here.`,
      severity: 'error',
    });
  }

  return issues;
}

/**
 * Validates creating a folder with `name` under `parentId`.
 *
 * The parent must exist, be part of a sane tree, and sit at least one level
 * above the depth limit. Name collisions are checked among siblings only.
 */
export function checkNewFolder(
  folders: readonly Folder[],
  name: string,
  parentId: string | null = null,
): DomainIssue[] {
  const issues = checkFolderName(folders, name, parentId);
  if (parentId === null) return issues;

  const depth = folderDepth(folders, parentId);
  if (depth === null) {
    issues.push({
      path: 'parentId',
      message: 'Target folder no longer exists.',
      severity: 'error',
    });
  } else if (!Number.isFinite(depth)) {
    issues.push({
      path: 'parentId',
      message: 'Target folder is part of an invalid tree and cannot receive folders.',
      severity: 'error',
    });
  } else if (depth + 1 > MAX_FOLDER_DEPTH) {
    issues.push({
      path: 'parentId',
      message: `Folders nest at most ${MAX_FOLDER_DEPTH} levels deep.`,
      severity: 'error',
    });
  }

  return issues;
}

/**
 * Validates moving `folderId` under `newParentId`.
 *
 * Deleting a folder is a different operation: its prompts and child folders
 * move up one level rather than being deleted, so no check is needed here.
 */
export function checkFolderMove(
  folders: readonly Folder[],
  folderId: string,
  newParentId: string | null,
): DomainIssue[] {
  const folder = findFolder(folders, folderId);
  if (!folder) {
    return [{ path: 'id', message: 'Folder no longer exists.', severity: 'error' }];
  }

  if (wouldCreateFolderCycle(folders, folderId, newParentId)) {
    return [
      {
        path: 'parentId',
        message: 'A folder cannot be moved inside itself or one of its subfolders.',
        severity: 'error',
      },
    ];
  }

  if (newParentId !== null && !findFolder(folders, newParentId)) {
    return [{ path: 'parentId', message: 'Target folder no longer exists.', severity: 'error' }];
  }

  const parentDepth = newParentId === null ? 0 : folderDepth(folders, newParentId);
  if (parentDepth === null || !Number.isFinite(parentDepth)) {
    return [
      {
        path: 'parentId',
        message: 'Target folder is part of an invalid tree and cannot receive folders.',
        severity: 'error',
      },
    ];
  }

  const subtreeDepth = maxSubtreeDepth(folders, folderId);
  if (parentDepth + subtreeDepth > MAX_FOLDER_DEPTH) {
    return [
      {
        path: 'parentId',
        message: `Folders nest at most ${MAX_FOLDER_DEPTH} levels deep.`,
        severity: 'error',
      },
    ];
  }

  return [];
}

/* -------------------------------------------------------------------------- */
/* Collections                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Checks that a collection name is usable.
 *
 * Collection names are unique across the library (case-insensitive, as folders
 * are within one parent), because two collections with the same name are
 * indistinguishable in the rail and in a prompt's membership list.
 */
export function checkCollectionName(
  collections: readonly Collection[],
  name: string,
  excludeId?: string,
): DomainIssue[] {
  const issues: DomainIssue[] = [];
  const trimmed = normalizeTitle(name);

  if (trimmed.length === 0) {
    issues.push({ path: 'name', message: 'Collection name cannot be empty.', severity: 'error' });
    return issues;
  }
  if (trimmed.length > 80) {
    issues.push({
      path: 'name',
      message: 'Collection name must be at most 80 characters.',
      severity: 'error',
    });
  }

  const key = folderNameKey(trimmed);
  const clash = collections.find(
    (collection) => collection.id !== excludeId && folderNameKey(collection.name) === key,
  );

  if (clash) {
    issues.push({
      path: 'name',
      message: `A collection named "${clash.name}" already exists.`,
      severity: 'error',
    });
  }

  return issues;
}

function maxSubtreeDepth(folders: readonly Folder[], folderId: string): number {
  const children = folders.filter((folder) => folder.parentId === folderId);
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map((child) => maxSubtreeDepth(folders, child.id)));
}

/* -------------------------------------------------------------------------- */
/* Revisions                                                                  */
/* -------------------------------------------------------------------------- */

/** Next revision number for a prompt: one above the highest existing number. */
export function nextRevisionNumber(revisions: readonly PromptRevision[]): number {
  return revisions.reduce((max, revision) => Math.max(max, revision.revisionNumber), 0) + 1;
}

/** True when `(promptId, revisionNumber)` is not already taken. */
export function isRevisionNumberAvailable(
  revisions: readonly PromptRevision[],
  promptId: string,
  revisionNumber: number,
): boolean {
  return !revisions.some(
    (revision) => revision.promptId === promptId && revision.revisionNumber === revisionNumber,
  );
}

/** Newest first, with the revision number as a deterministic tie-breaker. */
export function sortRevisions(revisions: readonly PromptRevision[]): PromptRevision[] {
  return [...revisions].sort((left, right) => {
    if (left.revisionNumber !== right.revisionNumber) {
      return right.revisionNumber - left.revisionNumber;
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}

/* -------------------------------------------------------------------------- */
/* Activity log                                                               */
/* -------------------------------------------------------------------------- */

/** Newest entries kept in the capped activity log. */
export const ACTIVITY_LOG_LIMIT = 500;

/**
 * Keeps the newest `limit` events.
 *
 * Ordering is by `createdAt` descending with `id` as tie-breaker so identical
 * timestamps (possible with an injected clock) still produce a stable order.
 */
export function capActivityLog(
  events: readonly ActivityEvent[],
  limit: number = ACTIVITY_LOG_LIMIT,
): ActivityEvent[] {
  return [...events]
    .sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return right.createdAt.localeCompare(left.createdAt);
      }
      return right.id.localeCompare(left.id);
    })
    .slice(0, Math.max(0, limit));
}
