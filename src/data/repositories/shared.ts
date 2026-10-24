/**
 * Shared repository behaviour (TASK-006).
 *
 * Ordering, query matching, row mapping, and stored-record validation live here
 * so the IndexedDB and in-memory adapters cannot drift apart. The contract test
 * suite relies on both doing exactly the same thing.
 */

import { CorruptDataError } from '@/data/db/errors';
import type { PromptQuery } from '@/data/repositories/contracts';
import type { PromptRow, TemplateRow } from '@/data/db/schema';
import { flag } from '@/data/db/schema';
import type {
  ActivityEvent,
  Collection,
  Folder,
  Prompt,
  PromptRevision,
  PromptTemplate,
} from '@/domain/types';

/* -------------------------------------------------------------------------- */
/* Validation of stored records                                               */
/* -------------------------------------------------------------------------- */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(source: Record<string, unknown>, key: string, store: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new CorruptDataError(`A record in "${store}" is missing a usable "${key}".`);
  }
  return value;
}

/**
 * Validates the fields every query depends on.
 *
 * A record that fails here can still be exported by hand, but it must not be
 * handed to a store as if it were sound.
 */
export function assertStoredEntity(value: unknown, store: string): { id: string } {
  if (!isRecord(value)) {
    throw new CorruptDataError(`A record in "${store}" is not an object.`);
  }
  requireString(value, 'id', store);
  // The original record is returned: validation must not strip fields.
  return value as { id: string };
}

export function assertStoredPrompt(value: unknown): Prompt {
  const base = assertStoredEntity(value, 'prompts');
  const source = value as Record<string, unknown>;

  requireString(source, 'title', 'prompts');
  if (!isRecord(source.content)) {
    throw new CorruptDataError(`Prompt ${base.id} has no readable document.`);
  }
  if (typeof source.version !== 'number' || !Number.isInteger(source.version)) {
    throw new CorruptDataError(`Prompt ${base.id} has an invalid version counter.`);
  }
  for (const key of ['tags', 'collectionIds', 'variables'] as const) {
    if (!Array.isArray(source[key])) {
      throw new CorruptDataError(`Prompt ${base.id} has an invalid "${key}" list.`);
    }
  }

  return value as Prompt;
}

export function assertStoredRevision(value: unknown): PromptRevision {
  const base = assertStoredEntity(value, 'revisions');
  const source = value as Record<string, unknown>;

  requireString(source, 'promptId', 'revisions');
  if (typeof source.revisionNumber !== 'number' || !Number.isInteger(source.revisionNumber)) {
    throw new CorruptDataError(`Revision ${base.id} has an invalid revision number.`);
  }
  return value as PromptRevision;
}

/* -------------------------------------------------------------------------- */
/* Ordering                                                                   */
/* -------------------------------------------------------------------------- */

/** Case-insensitive text comparison that is stable across platforms. */
export function compareText(left: string, right: string): number {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function sortPrompts(prompts: readonly Prompt[]): Prompt[] {
  return [...prompts].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) {
      return left.updatedAt < right.updatedAt ? 1 : -1;
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

export function sortRevisions(revisions: readonly PromptRevision[]): PromptRevision[] {
  return [...revisions].sort((left, right) => {
    if (left.revisionNumber !== right.revisionNumber) {
      return right.revisionNumber - left.revisionNumber;
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

export function sortByName<T extends { id: string }>(
  items: readonly T[],
  nameOf: (item: T) => string,
): T[] {
  return [...items].sort((left, right) => {
    const byName = compareText(nameOf(left), nameOf(right));
    if (byName !== 0) return byName;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

export function sortFolders(folders: readonly Folder[]): Folder[] {
  return sortByName(folders, (folder) => folder.name);
}

export function sortCollections(collections: readonly Collection[]): Collection[] {
  return sortByName(collections, (collection) => collection.name);
}

export function sortTemplates(templates: readonly PromptTemplate[]): PromptTemplate[] {
  return sortByName(templates, (template) => template.name);
}

export function sortActivity(events: readonly ActivityEvent[]): ActivityEvent[] {
  return [...events].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt < right.createdAt ? 1 : -1;
    }
    return left.id < right.id ? 1 : left.id > right.id ? -1 : 0;
  });
}

/* -------------------------------------------------------------------------- */
/* Query matching                                                            */
/* -------------------------------------------------------------------------- */

function withinRange(
  value: string,
  after: string | undefined,
  before: string | undefined,
): boolean {
  if (after !== undefined && value < after) return false;
  if (before !== undefined && value > before) return false;
  return true;
}

/** Applies every supplied criterion; omitted criteria match everything. */
export function matchesPromptQuery(prompt: Prompt, query: PromptQuery = {}): boolean {
  if (query.folderId !== undefined && prompt.folderId !== query.folderId) return false;
  if (query.collectionId !== undefined && !prompt.collectionIds.includes(query.collectionId)) {
    return false;
  }
  if (query.tag !== undefined && !prompt.tags.includes(query.tag)) return false;
  if (query.status !== undefined && prompt.status !== query.status) return false;
  if (query.archived !== undefined && prompt.archived !== query.archived) return false;
  if (query.favorite !== undefined && prompt.favorite !== query.favorite) return false;
  if (query.pinned !== undefined && prompt.pinned !== query.pinned) return false;
  return withinRange(prompt.updatedAt, query.updatedAfter, query.updatedBefore);
}

/* -------------------------------------------------------------------------- */
/* Row mapping                                                               */
/* -------------------------------------------------------------------------- */

/** Adds the numeric mirrors IndexedDB needs for its boolean-like indexes. */
export function toPromptRow(prompt: Prompt): PromptRow {
  return {
    ...prompt,
    archivedFlag: flag(prompt.archived),
    favoriteFlag: flag(prompt.favorite),
    pinnedFlag: flag(prompt.pinned),
  };
}

export function fromPromptRow(row: PromptRow): Prompt {
  const { archivedFlag: _archived, favoriteFlag: _favorite, pinnedFlag: _pinned, ...prompt } = row;
  return prompt;
}

export function toTemplateRow(template: PromptTemplate): TemplateRow {
  return { ...template, builtInFlag: flag(template.isBuiltIn) };
}

export function fromTemplateRow(row: TemplateRow): PromptTemplate {
  const { builtInFlag: _builtIn, ...template } = row;
  return template;
}

/** Structured clone used by the in-memory adapter to mimic serialization. */
export function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
