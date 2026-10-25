/**
 * Dismissed quality findings, kept in this browser (TASK-024).
 *
 * A dismissal is a decision about **one prompt's one finding**: "I know, and I
 * want it that way." It is stored in `localStorage`, next to the recovery drafts,
 * and nowhere else — it never touches the prompt, its history, or the database,
 * because dismissing a suggestion is not editing a prompt.
 *
 * Everything here fails softly: a browser with storage disabled simply forgets
 * dismissals, and the panel says so instead of pretending the dismissal stuck.
 */

import { parseDismissals, type QualityDismissal } from '@/domain/quality';

export const QUALITY_DISMISSAL_PREFIX = 'promptforge.quality.dismissals.';

/** Storage key for one prompt's dismissals. */
export function dismissalStorageKey(promptId: string): string {
  return `${QUALITY_DISMISSAL_PREFIX}${promptId}`;
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** True when `localStorage` can be read and written (Safari private mode is not). */
export function canUseDismissalStorage(storage: Storage | null = defaultStorage()): boolean {
  if (!storage) return false;

  try {
    const probe = `${QUALITY_DISMISSAL_PREFIX}__probe__`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the stored dismissals for a prompt.
 *
 * Anything that does not validate is dropped rather than repaired: a corrupt row
 * must not resurrect a dismissal nobody can explain, and it must not crash the
 * screen either.
 */
export function loadDismissals(
  promptId: string,
  storage: Storage | null = defaultStorage(),
): QualityDismissal[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(dismissalStorageKey(promptId));
    if (raw === null) return [];
    return parseDismissals(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

/** Writes the list; `false` means the browser refused and nothing was stored. */
export function saveDismissals(
  promptId: string,
  dismissals: readonly QualityDismissal[],
  storage: Storage | null = defaultStorage(),
): boolean {
  if (!storage) return false;

  try {
    if (dismissals.length === 0) storage.removeItem(dismissalStorageKey(promptId));
    else storage.setItem(dismissalStorageKey(promptId), JSON.stringify(dismissals));
    return true;
  } catch {
    return false;
  }
}

/** Forgets every dismissal for a prompt. */
export function clearDismissals(
  promptId: string,
  storage: Storage | null = defaultStorage(),
): boolean {
  return saveDismissals(promptId, [], storage);
}
