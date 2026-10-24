/**
 * Recovery drafts for the editor (TASK-014).
 *
 * A draft is a copy of the text in this tab, kept in `localStorage` so an
 * accidental reload does not lose work. It is **not** a saved prompt: TASK-015
 * owns persistence. Everything here fails softly — a browser with storage
 * disabled simply has no drafts, and the editor says so by not offering any.
 */

export const DRAFT_STORAGE_PREFIX = 'promptforge.editor.draft.';

/** Drafts larger than this are refused rather than filling the origin's quota. */
export const MAX_DRAFT_CHARS = 2_000_000;

export interface StoredDraft {
  readonly promptId: string;
  readonly text: string;
  /** When the draft was written (ISO timestamp). */
  readonly savedAt: string;
  /** `updatedAt` of the stored prompt the draft was typed over. */
  readonly baseUpdatedAt: string;
  /**
   * Version of the stored prompt the draft was typed over (TASK-015).
   *
   * Optional because drafts written by TASK-014 predate it; a recovery candidate
   * then falls back to comparing `baseUpdatedAt`.
   */
  readonly baseVersion?: number;
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Storage key for a prompt's draft. */
export function draftStorageKey(promptId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${promptId}`;
}

/** True when `localStorage` can be read and written (Safari private mode is not). */
export function canUseDraftStorage(storage: Storage | null = defaultStorage()): boolean {
  if (!storage) return false;

  try {
    const probe = `${DRAFT_STORAGE_PREFIX}__probe__`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function isStoredDraft(value: unknown): value is StoredDraft {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.promptId === 'string' &&
    typeof candidate.text === 'string' &&
    candidate.text.length <= MAX_DRAFT_CHARS &&
    typeof candidate.savedAt === 'string' &&
    typeof candidate.baseUpdatedAt === 'string' &&
    (candidate.baseVersion === undefined ||
      (typeof candidate.baseVersion === 'number' && Number.isFinite(candidate.baseVersion)))
  );
}

/**
 * Reads a draft for one prompt.
 *
 * Anything that does not look like a draft we wrote — unparsable JSON, a missing
 * field, another prompt's id — is treated as absent rather than trusted.
 */
export function readStoredDraft(
  promptId: string,
  storage: Storage | null = defaultStorage(),
): StoredDraft | null {
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(draftStorageKey(promptId));
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredDraft(parsed) || parsed.promptId !== promptId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Writes a draft; returns false when storage refuses (quota, private mode). */
export function writeStoredDraft(
  draft: StoredDraft,
  storage: Storage | null = defaultStorage(),
): boolean {
  if (!storage || draft.text.length > MAX_DRAFT_CHARS) return false;

  try {
    storage.setItem(draftStorageKey(draft.promptId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/** Removes a prompt's draft. Missing drafts are not an error. */
export function clearStoredDraft(
  promptId: string,
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) return;

  try {
    storage.removeItem(draftStorageKey(promptId));
  } catch {
    // Nothing to recover from a removal that failed; the draft is simply gone.
  }
}
