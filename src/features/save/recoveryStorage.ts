/**
 * Recovery drafts for the save pipeline (TASK-015).
 *
 * A recovery draft is the last resort when a save does not land: it is a copy of
 * the editor text in `localStorage`, recorded against the stored version it was
 * typed over. It is **not** a saved prompt and the pipeline never treats it as
 * one — the save status only reports what the database confirmed.
 *
 * Reading is deliberately paranoid: storage can throw (private mode, quota), the
 * JSON can be from an older build, and a draft can belong to a prompt that has
 * since changed. Anything unexpected is treated as "no draft" rather than
 * trusted, and writing fails softly.
 */

import { describeLineDifference, summarizeLineDifference } from '@/domain/textDiff';
import {
  canUseDraftStorage,
  clearStoredDraft,
  readStoredDraft,
  writeStoredDraft,
  type StoredDraft,
} from '@/features/editor/draftStorage';

/** How a recovery draft differs from what storage now holds. */
export interface RecoveryCandidate {
  readonly draft: StoredDraft;
  /** One sentence describing where the draft and the stored text diverge. */
  readonly hint: string;
  /**
   * True when the draft was typed over a different stored record, which means
   * restoring it would replace changes made elsewhere.
   */
  readonly basedOnOlderVersion: boolean;
}

export interface ReadRecoveryOptions {
  readonly promptId: string;
  /** Text of the stored prompt right now. */
  readonly storedText: string;
  /** Version of the stored prompt right now. */
  readonly storedVersion: number;
  readonly storage?: Storage | null;
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** True when this browser can keep recovery drafts at all. */
export function canRecover(storage?: Storage | null): boolean {
  return canUseDraftStorage(storage === undefined ? defaultStorage() : storage);
}

/**
 * Reads a draft that differs from the stored document.
 *
 * A draft identical to the stored text is not offered: there is nothing to
 * recover, and showing a banner for it would train people to dismiss banners.
 */
export function readRecovery({
  promptId,
  storedText,
  storedVersion,
  storage,
}: ReadRecoveryOptions): RecoveryCandidate | null {
  if (!promptId) return null;

  const draft = readStoredDraft(promptId, storage === undefined ? defaultStorage() : storage);
  if (!draft || draft.text === storedText) return null;

  const basedOnOlderVersion =
    draft.baseVersion === undefined ? true : draft.baseVersion !== storedVersion;

  return {
    draft,
    hint: describeLineDifference(summarizeLineDifference(storedText, draft.text)),
    basedOnOlderVersion,
  };
}

export interface WriteRecoveryOptions {
  readonly promptId: string;
  readonly text: string;
  /** Version of the stored prompt this text is based on. */
  readonly baseVersion: number;
  /** `updatedAt` of that stored prompt. */
  readonly baseUpdatedAt: string;
  readonly storage?: Storage | null;
  readonly now?: () => Date;
}

/** Writes a recovery draft; returns false when storage refuses it. */
export function writeRecovery({
  promptId,
  text,
  baseVersion,
  baseUpdatedAt,
  storage,
  now,
}: WriteRecoveryOptions): boolean {
  if (!promptId) return false;

  return writeStoredDraft(
    {
      promptId,
      text,
      savedAt: (now?.() ?? new Date()).toISOString(),
      baseUpdatedAt,
      baseVersion,
    },
    storage === undefined ? defaultStorage() : storage,
  );
}

/** Removes a prompt's recovery draft. Missing drafts are not an error. */
export function clearRecovery(promptId: string, storage?: Storage | null): void {
  if (!promptId) return;
  clearStoredDraft(promptId, storage === undefined ? defaultStorage() : storage);
}
