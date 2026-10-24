/**
 * Playground input storage (TASK-021).
 *
 * The values someone types into a variable form are not prompt data: they are a
 * scratch pad for trying the prompt out. They live in `sessionStorage` under one
 * key per prompt, so they survive a reload of this tab and vanish when it closes
 * — a variable's value is often a customer's text, and it should not linger in a
 * profile the way a saved prompt does.
 *
 * Everything fails softly. A browser with storage disabled simply has no
 * remembered inputs, and the panel says so rather than pretending otherwise.
 */

export const PLAYGROUND_STORAGE_PREFIX = 'promptforge.playground.';

/** A prompt with more inputs than this is not stored; the form still works. */
export const MAX_STORED_ENTRIES = 200;

/** Total characters of stored input values, before storage is refused. */
export const MAX_STORED_CHARS = 200_000;

export interface StoredPlaygroundValues {
  readonly promptId: string;
  readonly values: Readonly<Record<string, string>>;
  /** When these inputs were last written (ISO timestamp). */
  readonly savedAt: string;
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Storage key for one prompt's playground inputs. */
export function playgroundStorageKey(promptId: string): string {
  return `${PLAYGROUND_STORAGE_PREFIX}${promptId}`;
}

/** `undefined` means "use this browser's session storage"; `null` disables it. */
function resolveStorage(storage: Storage | null | undefined): Storage | null {
  return storage === undefined ? defaultStorage() : storage;
}

/** True when session storage can be read and written. */
export function canUsePlaygroundStorage(storage?: Storage | null): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;

  try {
    const probe = `${PLAYGROUND_STORAGE_PREFIX}__probe__`;
    target.setItem(probe, '1');
    target.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function isStoredPlaygroundValues(
  value: unknown,
  promptId: string,
): value is StoredPlaygroundValues {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;
  if (candidate.promptId !== promptId) return false;
  if (typeof candidate.savedAt !== 'string') return false;

  const values = candidate.values;
  if (typeof values !== 'object' || values === null || Array.isArray(values)) return false;

  const entries = Object.entries(values as Record<string, unknown>);
  if (entries.length > MAX_STORED_ENTRIES) return false;

  let total = 0;
  for (const [name, input] of entries) {
    if (typeof input !== 'string') return false;
    total += name.length + input.length;
  }

  return total <= MAX_STORED_CHARS;
}

/**
 * Reads a prompt's remembered inputs.
 *
 * Anything that does not look like something this module wrote — unparsable
 * JSON, another prompt's id, a non-string value — is treated as absent.
 */
export function readPlaygroundValues(
  promptId: string,
  storage?: Storage | null,
): StoredPlaygroundValues | null {
  const target = resolveStorage(storage);
  if (!target) return null;

  let raw: string | null;
  try {
    raw = target.getItem(playgroundStorageKey(promptId));
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredPlaygroundValues(parsed, promptId) ? parsed : null;
  } catch {
    return null;
  }
}

/** Writes a prompt's inputs; returns false when storage refuses. */
export function writePlaygroundValues(
  promptId: string,
  values: Readonly<Record<string, string>>,
  storage?: Storage | null,
  savedAt: string = new Date().toISOString(),
): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;

  const entries = Object.entries(values);
  const total = entries.reduce((sum, [name, input]) => sum + name.length + input.length, 0);
  if (entries.length > MAX_STORED_ENTRIES || total > MAX_STORED_CHARS) return false;

  try {
    target.setItem(
      playgroundStorageKey(promptId),
      JSON.stringify({ promptId, values, savedAt } satisfies StoredPlaygroundValues),
    );
    return true;
  } catch {
    return false;
  }
}

/** Removes a prompt's inputs. Missing values are not an error. */
export function clearPlaygroundValues(promptId: string, storage?: Storage | null): void {
  const target = resolveStorage(storage);
  if (!target) return;

  try {
    target.removeItem(playgroundStorageKey(promptId));
  } catch {
    // A removal that fails leaves stale inputs behind; nothing to report.
  }
}
