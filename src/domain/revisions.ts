/**
 * Version-history rules (TASK-019).
 *
 * A revision is an immutable snapshot of the fields a user authors: the
 * document, title, description, tags, and variables (`PromptRevision`). This
 * module is the pure part of the feature — ordering, labels, sizes, the restore
 * *impact* the confirmation dialog reads out, and the prune arithmetic. Writing
 * revisions lives in the data store; rendering lives in `src/routes/history`.
 *
 * Three rules shape everything here:
 *
 * 1. **A snapshot is complete.** It carries every authorable field, so restoring
 *    one cannot leave the prompt half-old. Fields a revision does *not* carry
 *    (folder, collections, status, favorite, pin, archive, attached schema) are
 *    named in `RESTORE_UNCHANGED_FIELDS` so the confirmation can say exactly
 *    what will stay as it is instead of implying a full revert.
 * 2. **Restoration is described before it happens.** `restoreImpact` compares the
 *    snapshot with the stored prompt field by field, so the dialog lists the
 *    changes it will make and the fields that already match.
 * 3. **Pruning is newest-first and never empties the history.** `prunePlan` keeps
 *    the newest N and reports exactly which rows would go; it refuses `keep < 1`.
 *    Numbers are not renumbered afterwards — `revisionNumber` is a historical
 *    label, not an array index, so a gap is expected and harmless.
 */

import { documentHash } from '@/domain/serialization';
import type { Prompt, PromptRevision, RevisionKind } from '@/domain/types';

/** Human labels for the three revision kinds; used by every surface. */
export const REVISION_KIND_LABELS: Readonly<Record<RevisionKind, string>> = {
  manual: 'Snapshot',
  'restore-safety': 'Safety snapshot',
  import: 'Imported',
};

/** One sentence per kind, for the viewer and the list's accessible names. */
export const REVISION_KIND_DESCRIPTIONS: Readonly<Record<RevisionKind, string>> = {
  manual: 'Saved by hand. Autosave never creates one of these.',
  'restore-safety':
    'Taken automatically before a restore, so the state it replaced can be recovered.',
  import: 'Created when the prompt arrived from an import bundle.',
};

/**
 * Snapshot count at which the history warns that pruning may be worthwhile.
 *
 * Manual snapshots only: this is not a storage limit and nothing is removed
 * automatically. It marks the point where the list stops being scannable.
 */
export const REVISION_WARNING_THRESHOLD = 25;

/** Counts offered by the prune dialog, smallest history first. */
export const PRUNE_KEEP_OPTIONS = [10, 25, 50] as const;

/** Longest label the snapshot dialog accepts; `null` means "no label". */
export const MAX_REVISION_LABEL_LENGTH = 80;

/**
 * Fields a restore leaves alone, because a revision never captured them.
 *
 * Exported so the dialog, the docs, and the tests all read one list rather than
 * three copies of the same sentence.
 */
export const RESTORE_UNCHANGED_FIELDS: readonly string[] = [
  'Folder',
  'Collections',
  'Status',
  'Favorite',
  'Pin',
  'Archive state',
  'Attached schema',
];

/* -------------------------------------------------------------------------- */
/* Ordering                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Newest first: revision number descending, then creation time, then id.
 *
 * The number is the authority for a prompt's own history — it is monotonic even
 * when two snapshots share a millisecond — and the tie-breakers keep the order
 * total so the list cannot flicker between renders.
 */
export function sortRevisionsNewestFirst(revisions: readonly PromptRevision[]): PromptRevision[] {
  return [...revisions].sort((left, right) => {
    if (left.revisionNumber !== right.revisionNumber) {
      return right.revisionNumber - left.revisionNumber;
    }
    if (left.createdAt !== right.createdAt) return right.createdAt.localeCompare(left.createdAt);
    return left.id.localeCompare(right.id);
  });
}

/** One prompt's revisions, newest first, ignoring every other prompt. */
export function revisionsForPrompt(
  revisions: readonly PromptRevision[],
  promptId: string,
): PromptRevision[] {
  return sortRevisionsNewestFirst(revisions.filter((revision) => revision.promptId === promptId));
}

/** The newest revision carrying a given number, or `null`. */
export function findRevision(
  revisions: readonly PromptRevision[],
  revisionId: string,
): PromptRevision | null {
  return revisions.find((revision) => revision.id === revisionId) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Summaries                                                                  */
/* -------------------------------------------------------------------------- */

export interface RevisionSummary {
  readonly revision: PromptRevision;
  /** `v3`, as shown in the list and the viewer heading. */
  readonly versionLabel: string;
  /** The saved title, which may differ from the prompt's current title. */
  readonly title: string;
  readonly kindLabel: string;
  readonly kindDescription: string;
  /** Characters of the document JSON — the list's "size" figure. */
  readonly characters: number;
  readonly tags: readonly string[];
  readonly variables: number;
  readonly requiredVariables: number;
  readonly instructions: number;
  readonly constraints: number;
  /** Content hash, used to notice that a snapshot matches what is stored now. */
  readonly hash: string;
}

export function summariseRevision(revision: PromptRevision): RevisionSummary {
  const document = revision.contentSnapshot;

  return {
    revision,
    versionLabel: `v${revision.revisionNumber}`,
    title: revision.titleSnapshot,
    kindLabel: REVISION_KIND_LABELS[revision.kind],
    kindDescription: REVISION_KIND_DESCRIPTIONS[revision.kind],
    characters: JSON.stringify(document).length,
    tags: revision.tagsSnapshot,
    variables: revision.variablesSnapshot.length,
    requiredVariables: revision.variablesSnapshot.filter((variable) => variable.required).length,
    instructions: document.instructions.length,
    constraints: document.constraints.length,
    hash: documentHash(document),
  };
}

/** `1,284 characters of JSON` — one phrasing for every surface. */
export function describeRevisionSize(characters: number): string {
  return `${characters.toLocaleString()} ${characters === 1 ? 'character' : 'characters'} of JSON`;
}

/* -------------------------------------------------------------------------- */
/* Restore impact                                                             */
/* -------------------------------------------------------------------------- */

/** One authorable field, as the restore dialog describes it. */
export interface RestoreChange {
  /** `Title`, `Description`, `Tags`, `Variables`, or `Document`. */
  readonly field: string;
  /** What is stored now, in words. */
  readonly from: string;
  /** What the snapshot would put there, in words. */
  readonly to: string;
}

export interface RestoreImpact {
  /** Fields whose value differs; empty means the restore would change nothing. */
  readonly changes: readonly RestoreChange[];
  /** Fields that already match the snapshot. */
  readonly unchanged: readonly string[];
  /** True when no authorable field would change. */
  readonly noop: boolean;
}

function tagLabel(tags: readonly string[]): string {
  return tags.length === 0 ? 'no tags' : tags.join(', ');
}

function variableLabel(count: number, required: number): string {
  if (count === 0) return 'none declared';
  return `${count} declared (${required} required)`;
}

/**
 * Compares a snapshot with the stored prompt, field by field.
 *
 * The wording is deliberately concrete — "“Draft” → “Final”" rather than "title
 * changes" — because the confirmation's job is to describe the write before it
 * happens (acceptance criterion for TASK-019).
 */
export function restoreImpact(revision: PromptRevision, prompt: Prompt): RestoreImpact {
  const changes: RestoreChange[] = [];
  const unchanged: string[] = [];

  /**
   * Records a field as changed or matching.
   *
   * `matches` is passed explicitly where the display labels are not the value
   * (a document is "current document" versus "the document stored in v3"), so a
   * field that is identical can never be reported as a change.
   */
  const compare = (field: string, from: string, to: string, matches = from === to): void => {
    if (matches) {
      unchanged.push(field);
      return;
    }
    changes.push({ field, from, to });
  };

  const documentMatches = documentHash(prompt.content) === documentHash(revision.contentSnapshot);
  const variablesMatch =
    JSON.stringify(prompt.variables) === JSON.stringify(revision.variablesSnapshot);

  compare('Title', prompt.title, revision.titleSnapshot);
  compare(
    'Description',
    prompt.description || 'no description',
    revision.descriptionSnapshot || 'no description',
  );
  compare('Tags', tagLabel(prompt.tags), tagLabel(revision.tagsSnapshot));
  compare(
    'Variables',
    variableLabel(
      prompt.variables.length,
      prompt.variables.filter((variable) => variable.required).length,
    ),
    variableLabel(
      revision.variablesSnapshot.length,
      revision.variablesSnapshot.filter((variable) => variable.required).length,
    ),
    variablesMatch,
  );
  compare(
    'Document',
    'current document',
    `document stored in v${revision.revisionNumber}`,
    documentMatches,
  );

  return { changes, unchanged, noop: changes.length === 0 };
}

/* -------------------------------------------------------------------------- */
/* Labels and prune                                                           */
/* -------------------------------------------------------------------------- */

/** A label is optional; when present it is trimmed and length-limited. */
export function normaliseRevisionLabel(label: string | null | undefined): string | null {
  const trimmed = (label ?? '').trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Error message for the label field, or `null` when it is acceptable. */
export function checkRevisionLabel(label: string): string | null {
  if (label.trim().length > MAX_REVISION_LABEL_LENGTH) {
    return `Keep the label under ${MAX_REVISION_LABEL_LENGTH} characters.`;
  }
  return null;
}

export interface PrunePlan {
  /** Revisions that stay, newest first. */
  readonly keep: readonly PromptRevision[];
  /** Revisions that would be removed, newest first. */
  readonly remove: readonly PromptRevision[];
  readonly removalCount: number;
}

/**
 * Plans a prune that keeps the newest `keep` revisions.
 *
 * `keep` is clamped to at least 1: an empty history is not a useful state, and
 * the newest snapshot is the one a restore is most likely to need. With a
 * history at or below the limit the plan removes nothing, which the dialog uses
 * to disable the action rather than offering a no-op.
 */
export function prunePlan(revisions: readonly PromptRevision[], keep: number): PrunePlan {
  const ordered = sortRevisionsNewestFirst(revisions);
  const safeKeep = Number.isFinite(keep) ? Math.max(1, Math.trunc(keep)) : 1;

  return {
    keep: ordered.slice(0, safeKeep),
    remove: ordered.slice(safeKeep),
    removalCount: Math.max(0, ordered.length - safeKeep),
  };
}

/** True when the history is long enough to warrant the warning banner. */
export function needsPruneWarning(count: number): boolean {
  return count >= REVISION_WARNING_THRESHOLD;
}
