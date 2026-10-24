/**
 * Bulk selection helpers (TASK-013).
 *
 * Pure functions behind the multi-select bar: range selection over the visible
 * order, tag edits applied identically to every selected prompt, and the tag
 * census the tag picker shows. Nothing here touches storage or React, so the
 * rules that decide *what* a bulk action means can be tested on their own.
 */

import { normalizeTags, type TagEdit } from '@/domain/invariants';
import type { Prompt } from '@/domain/types';

/**
 * Ids from `anchorId` to `targetId`, inclusive, following the order on screen.
 *
 * Shift-clicking a checkbox means "everything between the last one I touched
 * and this one", so the order must be the rendered order. When either anchor is
 * no longer visible (a filter changed underneath the selection) only the target
 * is returned, which is the least surprising fallback.
 */
export function rangeIds(ordered: readonly string[], anchorId: string, targetId: string): string[] {
  const from = ordered.indexOf(anchorId);
  const to = ordered.indexOf(targetId);
  if (from === -1 || to === -1) return [targetId];

  const start = Math.min(from, to);
  const end = Math.max(from, to);
  return ordered.slice(start, end + 1);
}

/** True when the edit has nothing to do — no additions and no removals. */
export function isEmptyTagEdit(edit: TagEdit): boolean {
  return normalizeTags(edit.add).length === 0 && normalizeTags(edit.remove).length === 0;
}

export interface TagCensus {
  readonly tag: string;
  readonly count: number;
}

/**
 * Tags present on at least one of the given prompts, most used first.
 *
 * Archived prompts are included on purpose: a bulk edit can touch them when the
 * archive scope is on, and the picker must describe the selection it is about to
 * change. Passing the whole library gives the tag manager its census.
 */
export function tagCensus(prompts: readonly Prompt[]): TagCensus[] {
  const counts = new Map<string, number>();

  for (const prompt of prompts) {
    for (const tag of prompt.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => {
      if (left.count !== right.count) return right.count - left.count;
      return left.tag.localeCompare(right.tag);
    });
}

/** "1 prompt" / "4 prompts" — used by every bulk message. */
export function countPrompts(count: number): string {
  return `${count} ${count === 1 ? 'prompt' : 'prompts'}`;
}
