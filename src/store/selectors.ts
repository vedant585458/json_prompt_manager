/**
 * Pure selectors (TASK-007).
 *
 * Library filtering, ordering, and dashboard aggregates live here rather than
 * inside components so they can be tested without a renderer, reused by the
 * dashboard (TASK-010) and the library (TASK-011), and memoized in one place.
 *
 * Nothing in this module touches storage or React.
 */

import { matchPrompt } from '@/domain/search';
import type { ActivityEvent, Prompt, PromptStatus } from '@/domain/types';

export type PromptSort = 'updated' | 'created' | 'title';

export interface LibraryQuery {
  /**
   * Case-insensitive search over title, description, tags, and the stored JSON
   * document (TASK-011). Every term must appear somewhere.
   */
  readonly search?: string;
  /** `false` (default) hides archived prompts; `true` shows only archived. */
  readonly archived?: boolean;
  readonly favoritesOnly?: boolean;
  readonly pinnedOnly?: boolean;
  /** `null` selects Unfiled prompts; omit for every folder. */
  readonly folderId?: string | null;
  /** Several folders at once, used by a folder and its descendants. */
  readonly folderIds?: readonly string[];
  readonly collectionId?: string;
  /** Several collections at once; a prompt may belong to any of them. */
  readonly collectionIds?: readonly string[];
  /** Prompts that belong to at least one collection. */
  readonly hasCollection?: boolean;
  readonly tag?: string;
  /** Every listed tag must be present (AND), matching the multi-select chip UI. */
  readonly tags?: readonly string[];
  readonly status?: PromptStatus | 'all';
  /**
   * Document-health filter. The ids come from the caller because parsing is
   * expensive: the library computes the set once per data change (TASK-011).
   */
  readonly documentFilter?: {
    readonly kind: 'parsable' | 'unparsable';
    readonly ids: readonly string[];
  };
  /** Prompts that have at least one stored revision. */
  readonly snapshotPromptIds?: readonly string[];
  /** ISO timestamp; prompts edited before it are excluded. */
  readonly updatedAfter?: string;
  readonly sort?: PromptSort;
}

/** Dashboards and filters need the same counts; compute them once. */
export interface LibraryCounts {
  readonly all: number;
  readonly active: number;
  readonly draft: number;
  readonly deprecated: number;
  readonly archived: number;
  readonly favorites: number;
  readonly pinned: number;
}

export interface TagCount {
  readonly tag: string;
  readonly count: number;
}

export interface DashboardSummary {
  readonly total: number;
  readonly active: number;
  readonly draft: number;
  readonly deprecated: number;
  readonly archived: number;
  readonly favorites: number;
  readonly pinned: number;
  readonly updatedThisWeek: number;
  readonly tagCount: number;
  readonly recent: readonly Prompt[];
  readonly topTags: readonly TagCount[];
  readonly activityCount: number;
}

function compare(sort: PromptSort, left: Prompt, right: Prompt): number {
  if (sort === 'title') {
    const byTitle = left.title.toLowerCase().localeCompare(right.title.toLowerCase());
    if (byTitle !== 0) return byTitle;
    return left.id.localeCompare(right.id);
  }

  const field = sort === 'created' ? 'createdAt' : 'updatedAt';
  if (left[field] !== right[field]) return right[field].localeCompare(left[field]);
  return left.id.localeCompare(right.id);
}

/**
 * Filters and orders prompts for the library view.
 *
 * Filters are ANDed, matching the persistence query contract, so a selector
 * result can be compared directly with `prompts.query()` in tests.
 */
export function selectLibrary(prompts: readonly Prompt[], query: LibraryQuery = {}): Prompt[] {
  const needle = query.search?.trim() ?? '';
  const archived = query.archived ?? false;
  const folderIds = query.folderIds ? new Set(query.folderIds) : null;
  const collectionIds = query.collectionIds ? new Set(query.collectionIds) : null;
  const tags = query.tags ?? [];
  const unparsable = query.documentFilter ? new Set(query.documentFilter.ids) : null;
  const withSnapshots = query.snapshotPromptIds ? new Set(query.snapshotPromptIds) : null;

  const filtered = prompts.filter((prompt) => {
    if (prompt.archived !== archived) return false;
    if (query.favoritesOnly === true && !prompt.favorite) return false;
    if (query.pinnedOnly === true && !prompt.pinned) return false;
    if (query.folderId !== undefined && prompt.folderId !== query.folderId) return false;
    if (folderIds && !folderIds.has(prompt.folderId ?? '')) return false;
    if (query.hasCollection === true && prompt.collectionIds.length === 0) return false;
    if (query.collectionId !== undefined && !prompt.collectionIds.includes(query.collectionId)) {
      return false;
    }
    if (
      collectionIds &&
      !prompt.collectionIds.some((collectionId) => collectionIds.has(collectionId))
    ) {
      return false;
    }
    if (query.tag !== undefined && !prompt.tags.includes(query.tag)) return false;
    if (tags.length > 0 && !tags.every((tag) => prompt.tags.includes(tag))) return false;
    if (query.status !== undefined && query.status !== 'all' && prompt.status !== query.status) {
      return false;
    }
    if (query.documentFilter && unparsable) {
      const unreadable = unparsable.has(prompt.id);
      if (query.documentFilter.kind === 'unparsable' && !unreadable) return false;
      if (query.documentFilter.kind === 'parsable' && unreadable) return false;
    }
    if (withSnapshots && !withSnapshots.has(prompt.id)) return false;
    if (query.updatedAfter !== undefined && prompt.updatedAt < query.updatedAfter) return false;
    if (needle.length > 0 && matchPrompt(prompt, needle) === null) return false;
    return true;
  });

  return filtered.sort((left, right) => compare(query.sort ?? 'updated', left, right));
}

/**
 * Memoized library selector.
 *
 * Single-entry cache keyed on the prompts array identity plus the normalized
 * query: React state updates replace the array only when data changed, so the
 * common case (re-render for an unrelated reason) returns the same reference
 * and does not re-sort. No dependency, no cache invalidation bugs.
 */
export function createLibrarySelector(): (
  prompts: readonly Prompt[],
  query?: LibraryQuery,
) => Prompt[] {
  let lastPrompts: readonly Prompt[] | null = null;
  let lastKey = '';
  let lastResult: Prompt[] = [];

  return (prompts, query = {}) => {
    const key = JSON.stringify(query);
    if (lastPrompts === prompts && lastKey === key) return lastResult;

    lastPrompts = prompts;
    lastKey = key;
    lastResult = selectLibrary(prompts, query);
    return lastResult;
  };
}

/**
 * Pinned prompts, A→Z.
 *
 * `Prompt` has no `pinnedAt`, so "most recently pinned" cannot be derived
 * without inventing a field and migrating stored records. Ordering by title is
 * stable, explainable, and matches the rail's A→Z ordering (TASK-013).
 */
export function sortPinnedByTitle(prompts: readonly Prompt[]): Prompt[] {
  return [...prompts].sort((left, right) => {
    const byTitle = left.title.toLowerCase().localeCompare(right.title.toLowerCase());
    return byTitle !== 0 ? byTitle : left.id.localeCompare(right.id);
  });
}

export function selectPromptById(prompts: readonly Prompt[], id: string | null): Prompt | null {
  if (id === null) return null;
  return prompts.find((prompt) => prompt.id === id) ?? null;
}

export function selectCounts(prompts: readonly Prompt[]): LibraryCounts {
  return {
    all: prompts.length,
    active: prompts.filter((prompt) => prompt.status === 'active' && !prompt.archived).length,
    draft: prompts.filter((prompt) => prompt.status === 'draft' && !prompt.archived).length,
    deprecated: prompts.filter((prompt) => prompt.status === 'deprecated' && !prompt.archived)
      .length,
    archived: prompts.filter((prompt) => prompt.archived).length,
    favorites: prompts.filter((prompt) => prompt.favorite && !prompt.archived).length,
    pinned: prompts.filter((prompt) => prompt.pinned && !prompt.archived).length,
  };
}

/** Tag frequency over non-archived prompts, most used first, then A→Z. */
export function selectTagCounts(prompts: readonly Prompt[], limit?: number): TagCount[] {
  const counts = new Map<string, number>();

  for (const prompt of prompts) {
    if (prompt.archived) continue;
    for (const tag of prompt.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  const sorted = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => {
      if (left.count !== right.count) return right.count - left.count;
      return left.tag.localeCompare(right.tag);
    });

  return limit === undefined ? sorted : sorted.slice(0, Math.max(0, limit));
}

export interface DashboardOptions {
  readonly now?: Date;
  readonly recentLimit?: number;
  readonly topTagLimit?: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Aggregates for the dashboard.
 *
 * `activityCount` is passed through rather than recomputed so the dashboard can
 * label it "recent activity" without implying it counts every historical event.
 */
export function selectDashboard(
  prompts: readonly Prompt[],
  activity: readonly ActivityEvent[] = [],
  options: DashboardOptions = {},
): DashboardSummary {
  const now = options.now ?? new Date();
  const recentLimit = options.recentLimit ?? 5;
  const topTagLimit = options.topTagLimit ?? 5;
  const counts = selectCounts(prompts);
  const weekAgo = new Date(now.getTime() - WEEK_MS).toISOString();

  const recent = selectLibrary(prompts, { sort: 'updated' }).slice(0, recentLimit);
  const topTags = selectTagCounts(prompts, topTagLimit);

  return {
    total: prompts.length,
    active: counts.active,
    draft: counts.draft,
    deprecated: counts.deprecated,
    archived: counts.archived,
    favorites: counts.favorites,
    pinned: counts.pinned,
    updatedThisWeek: prompts.filter((prompt) => !prompt.archived && prompt.updatedAt >= weekAgo)
      .length,
    tagCount: new Set(prompts.flatMap((prompt) => prompt.tags)).size,
    recent,
    topTags,
    activityCount: activity.length,
  };
}
