/**
 * Comparison sources (TASK-020).
 *
 * The diff screen compares two *sources*, and a source has to survive a reload.
 * So every source is a short, stable string that can live in a query parameter:
 *
 * - `prompt:<promptId>` — the stored prompt.
 * - `revision:<revisionId>` — one snapshot of a prompt; the prompt is derived
 *   from the revision, so the parameter never needs a second id.
 * - `text` — JSON pasted into the picker. The parameter marks the *mode*; the
 *   text itself stays in component state, because a whole document does not
 *   belong in a URL. The screen says so instead of pretending otherwise.
 *
 * Resolution is a value, not an exception: a deleted prompt or a pruned
 * revision comes back as an explanation the screen can render.
 */

import { describeDiffSide } from '@/domain/diff';
import { documentToJson } from '@/domain/serialization';
import type { JsonValue, Prompt, PromptRevision } from '@/domain/types';

export type DiffSideName = 'before' | 'after';

/** What a side can be: a stored prompt, one snapshot, or pasted JSON. */
export type DiffSourceKind = 'prompt' | 'revision' | 'text';

export type DiffSource =
  | { readonly kind: 'prompt'; readonly promptId: string }
  | { readonly kind: 'revision'; readonly revisionId: string; readonly promptId: string }
  | { readonly kind: 'text' };

export interface DiffSourceDocuments {
  readonly prompts: readonly Prompt[];
  readonly revisions: readonly PromptRevision[];
}

export type ResolvedSide =
  | {
      readonly ok: true;
      readonly document: JsonValue;
      /** The prompt title, or "Pasted JSON". */
      readonly label: string;
      /** Which snapshot, or "Stored prompt". */
      readonly detail: string;
    }
  | { readonly ok: false; readonly error: string };

/* -------------------------------------------------------------------------- */
/* Query parameters                                                           */
/* -------------------------------------------------------------------------- */

/** Serialises a source for `?left=` / `?right=`. */
export function serializeDiffSource(source: DiffSource): string {
  switch (source.kind) {
    case 'prompt':
      return `prompt:${source.promptId}`;
    case 'revision':
      return `revision:${source.revisionId}`;
    case 'text':
      return 'text';
  }
}

/**
 * Parses a source parameter. Returns `null` for a missing or malformed value so
 * the caller can fall back to a default instead of rendering an error for a URL
 * it never generated.
 */
export function parseDiffSource(value: string | null | undefined): DiffSource | null {
  if (!value) return null;

  if (value === 'text') return { kind: 'text' };

  const separator = value.indexOf(':');
  if (separator === -1) return null;

  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1).trim();
  if (id.length === 0) return null;

  if (kind === 'prompt') return { kind: 'prompt', promptId: id };

  if (kind === 'revision') {
    // The prompt is filled in by the caller once the revision is found; keeping
    // it optional here means a hand-typed parameter still parses.
    return { kind: 'revision', revisionId: id, promptId: '' };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The pair shown when a link says only `?prompt=<id>`: the newest snapshot
 * against what is stored now — the comparison a person actually wants after
 * taking a snapshot. With no snapshots yet, the stored prompt is compared with
 * a pasted document, so the screen has something to explain.
 */
export function defaultDiffSources(
  promptId: string,
  revisions: readonly PromptRevision[],
): { readonly before: DiffSource; readonly after: DiffSource } {
  const newest = revisions
    .filter((revision) => revision.promptId === promptId)
    .sort((a, b) => b.revisionNumber - a.revisionNumber)[0];

  if (newest) {
    return {
      before: { kind: 'revision', revisionId: newest.id, promptId },
      after: { kind: 'prompt', promptId },
    };
  }

  return { before: { kind: 'prompt', promptId }, after: { kind: 'text' } };
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                 */
/* -------------------------------------------------------------------------- */

/** Resolves one side against the hydrated store. */
export function resolveDiffSource(source: DiffSource, docs: DiffSourceDocuments): ResolvedSide {
  if (source.kind === 'text') {
    return { ok: false, error: 'Paste JSON into this side to include it in the comparison.' };
  }

  if (source.kind === 'prompt') {
    const prompt = docs.prompts.find((candidate) => candidate.id === source.promptId);
    if (!prompt) {
      return { ok: false, error: `This prompt (${source.promptId}) is not in your library.` };
    }

    return {
      ok: true,
      // Canonical key order, so the comparison does not depend on how the
      // document was built in memory.
      document: documentToJson(prompt.content),
      label: prompt.title,
      detail: 'Stored prompt',
    };
  }

  const revision = docs.revisions.find((candidate) => candidate.id === source.revisionId);
  if (!revision) {
    return {
      ok: false,
      error: `This snapshot (${source.revisionId}) is no longer stored. It may have been pruned.`,
    };
  }

  const prompt = docs.prompts.find((candidate) => candidate.id === revision.promptId);

  return {
    ok: true,
    document: documentToJson(revision.contentSnapshot),
    label: describeDiffSide({
      title: prompt?.title ?? 'Deleted prompt',
      revisionNumber: revision.revisionNumber,
      label: revision.label,
    }),
    detail: prompt ? `Snapshot v${revision.revisionNumber}` : 'Snapshot of a deleted prompt',
  };
}

/** Every revision of a prompt, newest first — the picker's option list. */
export function revisionsOfPrompt(
  revisions: readonly PromptRevision[],
  promptId: string | undefined,
): readonly PromptRevision[] {
  if (!promptId) return [];
  return revisions
    .filter((revision) => revision.promptId === promptId)
    .slice()
    .sort((a, b) => b.revisionNumber - a.revisionNumber);
}

/**
 * Chooses a source of the requested kind while keeping the current prompt
 * where possible, so switching "Stored prompt" ↔ "Snapshot" does not jump to
 * an unrelated prompt.
 */
export function switchDiffSourceKind(
  kind: 'prompt' | 'revision',
  current: DiffSource,
  docs: DiffSourceDocuments,
): DiffSource {
  const promptId =
    current.kind === 'text' ? docs.prompts[0]?.id : current.promptId || docs.prompts[0]?.id;

  if (!promptId) return current;

  if (kind === 'prompt') return { kind: 'prompt', promptId };

  const newest = revisionsOfPrompt(docs.revisions, promptId)[0];
  return newest ? { kind: 'revision', revisionId: newest.id, promptId } : { kind: 'text' };
}
