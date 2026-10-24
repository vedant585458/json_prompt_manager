/**
 * Library view preference (TASK-011).
 *
 * Which of the two library views the user last chose. It is a display
 * preference, not data, so it lives in `localStorage` beside the theme: it must
 * be readable before anything hydrates, and it must never block the library if
 * storage is unavailable or holds junk.
 *
 * The URL still wins when it carries `?view=`, so a shared link opens in the
 * view it was shared from.
 */

export const LIBRARY_VIEWS = ['grid', 'list'] as const;

export type LibraryView = (typeof LIBRARY_VIEWS)[number];

export const LIBRARY_VIEW_STORAGE_KEY = 'promptforge.library.view';

export const DEFAULT_LIBRARY_VIEW: LibraryView = 'grid';

/** Minimal storage surface, so tests can pass a fake or a throwing stand-in. */
export type ViewStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isLibraryView(value: unknown): value is LibraryView {
  return value === 'grid' || value === 'list';
}

/** Unknown, missing, or unreadable values fall back to the default view. */
export function readLibraryView(storage: ViewStorage | null | undefined): LibraryView {
  if (!storage) return DEFAULT_LIBRARY_VIEW;

  try {
    const stored = storage.getItem(LIBRARY_VIEW_STORAGE_KEY);
    return isLibraryView(stored) ? stored : DEFAULT_LIBRARY_VIEW;
  } catch {
    return DEFAULT_LIBRARY_VIEW;
  }
}

/** Returns whether the preference was written; a failure is never fatal. */
export function writeLibraryView(
  view: LibraryView,
  storage: ViewStorage | null | undefined,
): boolean {
  if (!storage) return false;

  try {
    storage.setItem(LIBRARY_VIEW_STORAGE_KEY, view);
    return true;
  } catch {
    return false;
  }
}
