/**
 * Prompt search (TASK-011).
 *
 * One definition of "matches", shared by the library list, its result count,
 * and the highlighted text inside cards. Search is case-insensitive, covers the
 * title, description, tags, and the stored JSON document, and requires every
 * term in the query to appear somewhere (terms are ANDed, fields are ORed).
 *
 * Nothing here sorts by relevance: the library's sort control stays predictable
 * (edited, created, title), and a search only narrows the set. Matching returns
 * the fields that matched and, when the document matched, a readable excerpt so
 * the UI can show *why* a prompt is in the results.
 */

import type { Prompt } from '@/domain/types';

/** Where a query term can appear. Order is the order shown in the UI. */
export const SEARCH_FIELDS = ['title', 'description', 'tag', 'content'] as const;

export type SearchField = (typeof SEARCH_FIELDS)[number];

/** One run of text, flagged when it should be highlighted. */
export interface SearchHighlight {
  readonly text: string;
  readonly match: boolean;
}

export interface PromptMatch {
  readonly promptId: string;
  /** Fields that contained at least one term, in `SEARCH_FIELDS` order. */
  readonly fields: readonly SearchField[];
  /** A readable window onto the JSON hit, or `null` when content did not match. */
  readonly excerpt: string | null;
}

/** Longest excerpt the UI will show; keeps a card from growing a second body. */
export const SEARCH_EXCERPT_LIMIT = 96;

interface Haystack {
  readonly title: string;
  readonly description: string;
  readonly tags: string;
  readonly content: string;
  readonly pretty: string;
}

/**
 * Cached, lowercased search text per prompt.
 *
 * Keyed on object identity: prompts are immutable values replaced on save, so a
 * stale entry can never be read. This keeps typing in the search field cheap
 * even with hundreds of prompts, because the JSON is stringified once per
 * prompt rather than once per keystroke.
 */
const haystacks = new WeakMap<Prompt, Haystack>();

function stringifyDocument(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    // A stored value that cannot be serialized must not break the library.
    return '';
  }
}

function haystackFor(prompt: Prompt): Haystack {
  const cached = haystacks.get(prompt);
  if (cached) return cached;

  const pretty = stringifyDocument(prompt.content);
  const haystack: Haystack = {
    title: prompt.title.toLowerCase(),
    description: prompt.description.toLowerCase(),
    tags: prompt.tags.join('\n').toLowerCase(),
    content: pretty.toLowerCase(),
    pretty,
  };
  haystacks.set(prompt, haystack);
  return haystack;
}

/** Lowercased, de-duplicated terms; an empty query yields an empty list. */
export function parseSearchQuery(raw: string): string[] {
  const terms = new Set<string>();

  for (const part of raw.toLowerCase().split(/\s+/)) {
    if (part.length > 0) terms.add(part);
  }

  return [...terms];
}

/** The first line containing a term, trimmed to a single readable row. */
function excerptFor(pretty: string, terms: readonly string[]): string | null {
  if (pretty.length === 0) return null;

  for (const line of pretty.split('\n')) {
    const lower = line.toLowerCase();
    if (!terms.some((term) => lower.includes(term))) continue;

    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    return trimmed.length > SEARCH_EXCERPT_LIMIT
      ? `${trimmed.slice(0, SEARCH_EXCERPT_LIMIT)}…`
      : trimmed;
  }

  return null;
}

/**
 * Whether one prompt matches, and where.
 *
 * Returns `null` for a non-match and for an empty query — callers that treat an
 * empty query as "no filtering" should check `parseSearchQuery` first.
 */
export function matchPrompt(prompt: Prompt, rawQuery: string): PromptMatch | null {
  const terms = parseSearchQuery(rawQuery);
  if (terms.length === 0) return null;

  const haystack = haystackFor(prompt);
  const matched = new Set<SearchField>();

  for (const term of terms) {
    let found = false;

    if (haystack.title.includes(term)) {
      matched.add('title');
      found = true;
    }
    if (haystack.description.includes(term)) {
      matched.add('description');
      found = true;
    }
    if (haystack.tags.includes(term)) {
      matched.add('tag');
      found = true;
    }
    if (haystack.content.includes(term)) {
      matched.add('content');
      found = true;
    }

    // Every term must appear somewhere: "json schema" should not return every
    // prompt that merely mentions JSON.
    if (!found) return null;
  }

  const fields = SEARCH_FIELDS.filter((field) => matched.has(field));

  return {
    promptId: prompt.id,
    fields,
    excerpt: matched.has('content') ? excerptFor(haystack.pretty, terms) : null,
  };
}

/** Matches in the order given, so the caller's sort stays authoritative. */
export function searchPrompts(
  prompts: readonly Prompt[],
  rawQuery: string,
): Array<{ readonly prompt: Prompt; readonly match: PromptMatch }> {
  if (parseSearchQuery(rawQuery).length === 0) return [];

  const results: Array<{ readonly prompt: Prompt; readonly match: PromptMatch }> = [];
  for (const prompt of prompts) {
    const match = matchPrompt(prompt, rawQuery);
    if (match) results.push({ prompt, match });
  }
  return results;
}

/**
 * Splits text into highlighted and plain runs for rendering.
 *
 * Matching is literal and case-insensitive — no regular expressions are built
 * from user input, so brackets and dots in a query are searched as typed.
 * Overlapping or adjacent hits are merged so `<mark>` elements never nest.
 */
export function highlightSegments(text: string, rawQuery: string): SearchHighlight[] {
  const terms = parseSearchQuery(rawQuery);
  if (terms.length === 0 || text.length === 0) return [{ text, match: false }];

  const lower = text.toLowerCase();
  const ranges: Array<[number, number]> = [];

  for (const term of terms) {
    let from = 0;
    while (from <= lower.length - term.length) {
      const index = lower.indexOf(term, from);
      if (index === -1) break;
      ranges.push([index, index + term.length]);
      from = index + term.length;
    }
  }

  if (ranges.length === 0) return [{ text, match: false }];

  ranges.sort((left, right) => left[0] - right[0] || left[1] - right[1]);

  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push([range[0], range[1]]);
    }
  }

  const segments: SearchHighlight[] = [];
  let cursor = 0;

  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false });
    segments.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });

  return segments;
}
