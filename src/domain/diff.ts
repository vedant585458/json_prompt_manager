/**
 * Structural JSON comparison (TASK-020).
 *
 * The diff engine answers one question: *what changed, where?* It walks two
 * JSON values together and emits ordered change entries, each with an RFC 6901
 * JSON Pointer, the values on both sides, and a classification:
 *
 * - **structural** — the shape changed: a key or array element was added or
 *   removed, a value changed type, or an array was re-ordered.
 * - **textual** — a value changed in place and kept its type (a string, number,
 *   boolean, or null edit). "Textual" is the task's word for value-level edits;
 *   it does not mean only strings.
 *
 * The engine is pure, framework-free, and deliberately conservative:
 *
 * - **Order is document order.** Additions and changes follow the order of the
 *   *new* value; removals come after their surviving siblings, in the order
 *   they had in the *old* value. Nothing is sorted, because key order is part
 *   of what the user may be comparing.
 * - **Arrays are compared positionally after a common prefix and suffix are
 *   trimmed.** That keeps an insertion at the front one `added` entry instead
 *   of a cascade of `changed` entries.
 * - **Re-ordering is detected only for scalar arrays of equal length whose
 *   values match as a multiset.** Anything else is reported position by
 *   position; the engine never guesses that an element "moved" when its
 *   content also changed.
 * - **Nothing is inferred.** The comparison is textual/structural, not semantic:
 *   the engine cannot know that two different sentences mean the same thing.
 *
 * Large inputs are bounded by `maxEntries`, and the result says so instead of
 * silently truncating the truth.
 */

import type { JsonValue } from '@/domain/types';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type DiffChangeKind = 'added' | 'removed' | 'changed' | 'type-changed' | 'reordered';

/** What a change means for the document's shape. */
export type DiffCategory = 'structural' | 'textual';

export type DiffPathSegment = string | number;

/** One index moving during a re-order. */
export interface DiffMove {
  readonly from: number;
  readonly to: number;
}

export interface DiffEntry {
  /** RFC 6901 JSON Pointer; the empty string is the document root. */
  readonly pointer: string;
  /** The same path split into keys and indices, for building UI breadcrumbs. */
  readonly segments: readonly DiffPathSegment[];
  readonly kind: DiffChangeKind;
  readonly category: DiffCategory;
  /** Readable path such as `instructions[2]` — never the only representation. */
  readonly label: string;
  /** The old value; absent for `added`. */
  readonly before?: JsonValue;
  /** The new value; absent for `removed`. */
  readonly after?: JsonValue;
  /** Positions that moved, for `reordered` entries. */
  readonly moves?: readonly DiffMove[];
  /** How many positions moved in total (may exceed `moves.length`). */
  readonly movedPositions?: number;
}

export interface DiffSummary {
  readonly total: number;
  readonly counts: Readonly<Record<DiffChangeKind, number>>;
  readonly structural: number;
  readonly textual: number;
}

export interface DiffResult {
  readonly identical: boolean;
  readonly entries: readonly DiffEntry[];
  readonly summary: DiffSummary;
  /**
   * True when the entry list hit `maxEntries`. The summary then describes the
   * entries that were collected, not the whole comparison.
   */
  readonly truncated: boolean;
}

export interface DiffOptions {
  /** Hard cap on emitted entries (default 2000). */
  readonly maxEntries?: number;
  /** Hard cap on recorded moves per `reordered` entry (default 50). */
  readonly maxMoves?: number;
}

/* -------------------------------------------------------------------------- */
/* Constants and labels                                                        */
/* -------------------------------------------------------------------------- */

export const DEFAULT_MAX_DIFF_ENTRIES = 2000;
export const DEFAULT_MAX_DIFF_MOVES = 50;

export const DIFF_CHANGE_KINDS: readonly DiffChangeKind[] = [
  'added',
  'removed',
  'changed',
  'type-changed',
  'reordered',
];

export const DIFF_CHANGE_KIND_LABELS: Readonly<Record<DiffChangeKind, string>> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Changed',
  'type-changed': 'Type changed',
  reordered: 'Re-ordered',
};

/** One sentence per kind, for the row's accessible description. */
export const DIFF_CHANGE_KIND_DESCRIPTIONS: Readonly<Record<DiffChangeKind, string>> = {
  added: 'exists only in the newer document',
  removed: 'exists only in the older document',
  changed: 'kept its type and changed value',
  'type-changed': 'changed from one JSON type to another',
  reordered: 'holds the same values in a different order',
};

export const DIFF_CATEGORY_LABELS: Readonly<Record<DiffCategory, string>> = {
  structural: 'Structure',
  textual: 'Text',
};

export const DIFF_CATEGORY_DESCRIPTIONS: Readonly<Record<DiffCategory, string>> = {
  structural: 'A key or array element was added, removed, or re-ordered, or a value changed type.',
  textual: 'A value kept its type and changed in place.',
};

const CATEGORY_BY_KIND: Readonly<Record<DiffChangeKind, DiffCategory>> = {
  added: 'structural',
  removed: 'structural',
  changed: 'textual',
  'type-changed': 'structural',
  reordered: 'structural',
};

/** The category a kind always carries. */
export function categoryOf(kind: DiffChangeKind): DiffCategory {
  return CATEGORY_BY_KIND[kind];
}

/* -------------------------------------------------------------------------- */
/* JSON values                                                                */
/* -------------------------------------------------------------------------- */

function isPlainObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: JsonValue): boolean {
  return value === null || typeof value !== 'object';
}

function sameScalar(a: JsonValue, b: JsonValue): boolean {
  return a === b;
}

/** Deep equality over JSON values; key order is irrelevant, array order is not. */
export function jsonEquals(a: JsonValue, b: JsonValue): boolean {
  if (sameScalar(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, index) => jsonEquals(item, b[index] as JsonValue));
  }

  const before = a as { [key: string]: JsonValue };
  const after = b as { [key: string]: JsonValue };
  const beforeKeys = Object.keys(before);
  const afterKeys = Object.keys(after);
  if (beforeKeys.length !== afterKeys.length) return false;

  return beforeKeys.every(
    (key) =>
      Object.hasOwn(after, key) && jsonEquals(before[key] as JsonValue, after[key] as JsonValue),
  );
}

/** The JSON type name shown when a value's type changed. */
export function jsonTypeName(value: JsonValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value === 'object' ? 'object' : typeof value;
}

/* -------------------------------------------------------------------------- */
/* JSON Pointer                                                               */
/* -------------------------------------------------------------------------- */

/** Escapes one segment per RFC 6901 (`~` → `~0`, `/` → `~1`). */
export function escapePointerSegment(segment: DiffPathSegment): string {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Unescapes one RFC 6901 segment. */
export function unescapePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** Builds an RFC 6901 pointer from segments; `[]` becomes `''` (the root). */
export function pointerFromSegments(segments: readonly DiffPathSegment[]): string {
  return segments.map((segment) => `/${escapePointerSegment(segment)}`).join('');
}

/** Splits a pointer back into segments; numbers stay strings (arrays differ). */
export function segmentsFromPointer(pointer: string): string[] {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) throw new Error(`Not a JSON Pointer: "${pointer}"`);
  return pointer.slice(1).split('/').map(unescapePointerSegment);
}

/**
 * A readable path for people: `document`, `objective`, `instructions[2]`,
 * `context.customer.email`. The RFC 6901 pointer is what gets copied and what
 * tests assert; this is only the human label.
 */
export function describePointer(segments: readonly DiffPathSegment[]): string {
  if (segments.length === 0) return 'document';

  return segments.reduce<string>((text, segment, index) => {
    if (typeof segment === 'number') return `${text}[${segment}]`;
    return index === 0 ? segment : `${text}.${segment}`;
  }, '');
}

/* -------------------------------------------------------------------------- */
/* Values, for display and copy                                               */
/* -------------------------------------------------------------------------- */

export const DEFAULT_VALUE_PREVIEW_CHARS = 240;

export interface FormattedValue {
  readonly text: string;
  readonly truncated: boolean;
  /** Characters of the full formatted value, before any truncation. */
  readonly characters: number;
}

/**
 * Formats one side of a change for display.
 *
 * Scalars are rendered as their JSON literal so `"3"` and `3` stay
 * distinguishable; containers are pretty-printed with two spaces. Long values
 * are cut at `maxLength` with an ellipsis and flagged, so the UI can offer the
 * full value instead of pretending the rest does not exist.
 */
export function formatDiffValue(
  value: JsonValue,
  options: { readonly maxLength?: number } = {},
): FormattedValue {
  const maxLength = options.maxLength ?? DEFAULT_VALUE_PREVIEW_CHARS;
  const full = JSON.stringify(value, null, typeof value === 'object' && value !== null ? 2 : 0);

  if (full.length <= maxLength) return { text: full, truncated: false, characters: full.length };
  return { text: `${full.slice(0, maxLength)}…`, truncated: true, characters: full.length };
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                 */
/* -------------------------------------------------------------------------- */

interface DiffContext {
  readonly entries: DiffEntry[];
  readonly maxEntries: number;
  readonly maxMoves: number;
  truncated: boolean;
}

function atCapacity(context: DiffContext): boolean {
  if (context.entries.length >= context.maxEntries) {
    context.truncated = true;
    return true;
  }
  return false;
}

function record(
  context: DiffContext,
  segments: readonly DiffPathSegment[],
  kind: DiffChangeKind,
  values: {
    readonly before?: JsonValue;
    readonly after?: JsonValue;
    readonly moves?: readonly DiffMove[];
    readonly movedPositions?: number;
  },
): void {
  if (atCapacity(context)) return;

  context.entries.push({
    pointer: pointerFromSegments(segments),
    segments: [...segments],
    kind,
    category: categoryOf(kind),
    label: describePointer(segments),
    ...values,
  });
}

/**
 * Scalar arrays with the same values in a different order.
 *
 * With duplicate values a move is a *hint*: the target is the first index that
 * holds the value, so `["a","a"]` moving cannot be described as a permutation.
 */
function reorderMoves(
  before: readonly JsonValue[],
  after: readonly JsonValue[],
  maxMoves: number,
): { readonly moves: readonly DiffMove[]; readonly movedPositions: number } {
  const moved: DiffMove[] = [];
  let movedPositions = 0;

  for (let index = 0; index < before.length; index += 1) {
    const value = before[index] as JsonValue;
    if (sameScalar(value, after[index] as JsonValue)) continue;

    movedPositions += 1;
    if (moved.length >= maxMoves) continue;
    const target = after.findIndex((candidate) => sameScalar(candidate, value));
    if (target >= 0) moved.push({ from: index, to: target });
  }

  return { moves: moved, movedPositions };
}

function sameValueMultiset(before: readonly JsonValue[], after: readonly JsonValue[]): boolean {
  if (before.length !== after.length) return false;

  const beforeValues = [...before].map((value) => JSON.stringify(value)).sort();
  const afterValues = [...after].map((value) => JSON.stringify(value)).sort();

  return beforeValues.every((value, index) => value === afterValues[index]);
}

function walk(
  before: JsonValue,
  after: JsonValue,
  segments: readonly DiffPathSegment[],
  context: DiffContext,
): void {
  if (atCapacity(context)) return;
  if (jsonEquals(before, after)) return;

  if (Array.isArray(before) && Array.isArray(after)) {
    walkArrays(before, after, segments, context);
    return;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    walkObjects(before, after, segments, context);
    return;
  }

  if (isScalar(before) && isScalar(after) && typeof before === typeof after) {
    record(context, segments, 'changed', { before, after });
    return;
  }

  record(context, segments, 'type-changed', { before, after });
}

function walkObjects(
  before: { [key: string]: JsonValue },
  after: { [key: string]: JsonValue },
  segments: readonly DiffPathSegment[],
  context: DiffContext,
): void {
  // Additions and changes follow the new document's key order…
  for (const key of Object.keys(after)) {
    if (atCapacity(context)) return;
    const next = [...segments, key];

    if (!Object.hasOwn(before, key)) {
      record(context, next, 'added', { after: after[key] as JsonValue });
      continue;
    }

    walk(before[key] as JsonValue, after[key] as JsonValue, next, context);
  }

  // …and removals come after their surviving siblings, in old key order.
  for (const key of Object.keys(before)) {
    if (atCapacity(context)) return;
    if (!Object.hasOwn(after, key)) {
      record(context, [...segments, key], 'removed', { before: before[key] as JsonValue });
    }
  }
}

function walkArrays(
  before: readonly JsonValue[],
  after: readonly JsonValue[],
  segments: readonly DiffPathSegment[],
  context: DiffContext,
): void {
  const bothScalar = before.every(isScalar) && after.every(isScalar);

  // A pure re-order is one entry, not one `changed` per index. It is only
  // claimed when every value still exists and the lengths match (ADR-102).
  if (
    bothScalar &&
    before.length === after.length &&
    before.length > 1 &&
    sameValueMultiset(before, after)
  ) {
    const { moves, movedPositions } = reorderMoves(before, after, context.maxMoves);
    record(context, segments, 'reordered', {
      before: [...before],
      after: [...after],
      moves,
      movedPositions,
    });
    return;
  }

  // Trim the common prefix and suffix so an insertion or removal in the middle
  // does not masquerade as a change to every element after it.
  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    jsonEquals(before[prefix] as JsonValue, after[prefix] as JsonValue)
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    jsonEquals(
      before[before.length - 1 - suffix] as JsonValue,
      after[after.length - 1 - suffix] as JsonValue,
    )
  ) {
    suffix += 1;
  }

  const beforeEnd = before.length - suffix;
  const afterEnd = after.length - suffix;
  const shared = Math.min(beforeEnd, afterEnd);

  for (let index = prefix; index < shared; index += 1) {
    if (atCapacity(context)) return;
    walk(before[index] as JsonValue, after[index] as JsonValue, [...segments, index], context);
  }

  // Extra elements on either side sit at the end of the differing region.
  for (let index = shared; index < afterEnd; index += 1) {
    record(context, [...segments, index], 'added', { after: after[index] as JsonValue });
  }
  for (let index = shared; index < beforeEnd; index += 1) {
    record(context, [...segments, index], 'removed', { before: before[index] as JsonValue });
  }
}

function summarise(entries: readonly DiffEntry[]): DiffSummary {
  const counts: Record<DiffChangeKind, number> = {
    added: 0,
    removed: 0,
    changed: 0,
    'type-changed': 0,
    reordered: 0,
  };

  let structural = 0;
  let textual = 0;

  for (const entry of entries) {
    counts[entry.kind] += 1;
    if (entry.category === 'structural') structural += 1;
    else textual += 1;
  }

  return { total: entries.length, counts, structural, textual };
}

/**
 * Compares two JSON values.
 *
 * `identical` is decided by deep equality over the parsed values. Two documents
 * that differ only in whitespace are identical by construction, and two that
 * differ only in object key order are also identical: member order is not part
 * of the JSON data model. Array order *is* content, so array order changes are
 * reported (as `reordered` when nothing else changed).
 */
export function diffDocuments(
  before: JsonValue,
  after: JsonValue,
  options: DiffOptions = {},
): DiffResult {
  const context: DiffContext = {
    entries: [],
    maxEntries: Math.max(1, options.maxEntries ?? DEFAULT_MAX_DIFF_ENTRIES),
    maxMoves: Math.max(1, options.maxMoves ?? DEFAULT_MAX_DIFF_MOVES),
    truncated: false,
  };

  walk(before, after, [], context);

  return {
    identical: context.entries.length === 0 && !context.truncated,
    entries: context.entries,
    summary: summarise(context.entries),
    truncated: context.truncated,
  };
}

/* -------------------------------------------------------------------------- */
/* Summaries and filtering                                                    */
/* -------------------------------------------------------------------------- */

/** `3 changes: 1 added, 2 changed` — one phrasing for the screen and the copy. */
export function describeDiffSummary(summary: DiffSummary): string {
  if (summary.total === 0) return 'No differences.';

  const parts = DIFF_CHANGE_KINDS.filter((kind) => summary.counts[kind] > 0).map(
    (kind) =>
      `${summary.counts[kind]} ${DIFF_CHANGE_KIND_LABELS[kind].toLowerCase()}${
        summary.counts[kind] === 1 ? '' : 's'
      }`,
  );

  return `${summary.total} ${summary.total === 1 ? 'change' : 'changes'}: ${parts.join(', ')}.`;
}

/** `2 structure, 1 text` — the classification, said in words. */
export function describeDiffCategories(summary: DiffSummary): string {
  if (summary.total === 0) return 'Nothing to classify.';
  return `${summary.structural} structure, ${summary.textual} text.`;
}

/** Entries of the requested kinds; `[]` or a full list means "everything". */
export function filterDiffEntries(
  entries: readonly DiffEntry[],
  kinds: readonly DiffChangeKind[],
): readonly DiffEntry[] {
  if (kinds.length === 0 || kinds.length === DIFF_CHANGE_KINDS.length) return entries;
  const wanted = new Set(kinds);
  return entries.filter((entry) => wanted.has(entry.kind));
}

/**
 * A result restricted to the entries a filter leaves visible.
 *
 * Copying a filtered view must reproduce *that* view, so the copy helpers take
 * a restricted result rather than the original one. `identical` and
 * `truncated` describe the comparison, not the filter, and are preserved.
 */
export function restrictDiffResult(result: DiffResult, entries: readonly DiffEntry[]): DiffResult {
  return {
    identical: result.identical,
    entries,
    summary: summarise(entries),
    truncated: result.truncated,
  };
}

/** Entries grouped by their kind, for the summary chips. */
export function countDiffEntries(
  entries: readonly DiffEntry[],
): Readonly<Record<DiffChangeKind, number>> {
  return summarise(entries).counts;
}

/* -------------------------------------------------------------------------- */
/* Copy output                                                                */
/* -------------------------------------------------------------------------- */

export interface DiffExportSides {
  /** Label for the old side, e.g. `Snapshot v3 · 24 Oct 2026, 09:00`. */
  readonly before: string;
  readonly after: string;
}

export interface DiffExportOptions {
  /**
   * Set when the screen is showing a filtered subset. The note is copied too,
   * so a pasted diff never looks like it covered entries it did not.
   */
  readonly filterNote?: string;
}

interface SerializedDiffEntry {
  readonly pointer: string;
  readonly path: string;
  readonly kind: DiffChangeKind;
  readonly category: DiffCategory;
  readonly before?: JsonValue;
  readonly after?: JsonValue;
  readonly moves?: readonly DiffMove[];
  readonly movedPositions?: number;
}

/**
 * The change list as JSON — the faithful, machine-readable copy target.
 *
 * It contains exactly what the screen shows: every entry, its pointer, its
 * kind and category, and both values. `truncated` is part of the output so a
 * copy never claims to be complete when the engine stopped early.
 */
export function diffToJson(
  result: DiffResult,
  sides?: DiffExportSides,
  options: DiffExportOptions = {},
): string {
  const entries: SerializedDiffEntry[] = result.entries.map((entry) => ({
    pointer: entry.pointer,
    path: entry.label,
    kind: entry.kind,
    category: entry.category,
    ...(entry.before === undefined ? {} : { before: entry.before }),
    ...(entry.after === undefined ? {} : { after: entry.after }),
    ...(entry.moves === undefined ? {} : { moves: entry.moves }),
    ...(entry.movedPositions === undefined ? {} : { movedPositions: entry.movedPositions }),
  }));

  return JSON.stringify(
    {
      ...(sides ? { before: sides.before, after: sides.after } : {}),
      identical: result.identical,
      truncated: result.truncated,
      ...(options.filterNote ? { filter: options.filterNote } : {}),
      summary: result.summary,
      changes: entries,
    },
    null,
    2,
  );
}

/**
 * The change list as plain text, for pasting into a message.
 *
 * This is a readable list, **not** a unified diff and not a patch: it cannot be
 * applied to anything. The UI labels it that way rather than offering a file
 * format it does not produce.
 */
export function diffToText(
  result: DiffResult,
  sides?: DiffExportSides,
  options: DiffExportOptions = {},
): string {
  const lines: string[] = [];

  if (sides) {
    lines.push(`Before: ${sides.before}`, `After:  ${sides.after}`, '');
  }

  lines.push(describeDiffSummary(result.summary), describeDiffCategories(result.summary));

  if (options.filterNote) lines.push(options.filterNote);

  if (result.truncated) {
    lines.push(`Truncated: showing the first ${result.entries.length} changes.`);
  }

  for (const entry of result.entries) {
    lines.push('');
    const marker =
      entry.kind === 'added'
        ? '+'
        : entry.kind === 'removed'
          ? '-'
          : entry.kind === 'reordered'
            ? '~'
            : '~';
    lines.push(
      `${marker} ${entry.label}  (${DIFF_CHANGE_KIND_LABELS[entry.kind].toLowerCase()}, ${
        entry.category === 'structural' ? 'structure' : 'text'
      })`,
    );

    if (entry.before !== undefined) {
      lines.push(`  - ${indentLines(formatDiffValue(entry.before, { maxLength: 1000 }).text)}`);
    }
    if (entry.after !== undefined) {
      lines.push(`  + ${indentLines(formatDiffValue(entry.after, { maxLength: 1000 }).text)}`);
    }
    if (entry.moves && entry.moves.length > 0) {
      const described = entry.moves.map((move) => `${move.from} → ${move.to}`).join(', ');
      lines.push(`  moved: ${described}`);
    }
  }

  return lines.join('\n');
}

function indentLines(text: string): string {
  return text.split('\n').join('\n    ');
}

/* -------------------------------------------------------------------------- */
/* Source labels                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A short label for one side of a comparison: the prompt title plus which
 * snapshot it is. Used in the picker, the header, and the copy output, so all
 * three always name the same thing.
 */
export function describeDiffSide(input: {
  readonly title: string;
  readonly revisionNumber?: number;
  readonly label?: string | null;
}): string {
  if (input.revisionNumber === undefined) return input.title;

  const snapshot = `v${input.revisionNumber}`;
  const label = input.label?.trim();
  return label ? `${input.title} · ${snapshot} · ${label}` : `${input.title} · ${snapshot}`;
}
