/**
 * Library search focus target (TASK-011).
 *
 * The "Search the library" command lives in the command registry, which is
 * deliberately framework-free, but the field it should focus lives in a mounted
 * route. A single registered callback bridges the two without threading refs
 * through the registry or reaching for DOM ids from the library's markup.
 */

type FocusTarget = () => void;

let target: FocusTarget | null = null;

/** Registers the active search field; returns an unregister function. */
export function registerLibrarySearchFocus(next: FocusTarget): () => void {
  target = next;

  return () => {
    if (target === next) target = null;
  };
}

/**
 * Focuses the library search field.
 *
 * Returns false when the library is not mounted, so a command can report that
 * it did nothing instead of silently failing.
 */
export function focusLibrarySearch(): boolean {
  if (!target) return false;
  target();
  return true;
}
