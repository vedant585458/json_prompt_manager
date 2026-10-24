/**
 * Theme resolution logic (TASK-002).
 *
 * Framework-free and DOM-free where possible so it can be unit tested:
 * preference resolution, persistence, and applying the result to a root element.
 * A settings-store-backed preference replaces the localStorage key in TASK-007.
 */

export type ThemePreference = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'promptforge.theme';
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'dark', 'light'];

/** Minimal storage surface so tests and future storage adapters can stand in. */
export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'dark' || value === 'light';
}

/** Dark is the product default when the OS preference is unavailable. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

export function getSystemThemeQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia('(prefers-color-scheme: dark)');
}

export function systemPrefersDark(query: Pick<MediaQueryList, 'matches'> | null = null): boolean {
  const resolvedQuery = query ?? getSystemThemeQuery();
  if (!resolvedQuery) return true;
  return resolvedQuery.matches;
}

export function getBrowserStorage(): ThemeStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Unknown, corrupt, or unreadable values fall back to following the OS. */
export function readThemePreference(storage: ThemeStorage | null | undefined): ThemePreference {
  if (!storage) return 'system';
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Returns false rather than throwing when persistence is unavailable. */
export function writeThemePreference(
  storage: ThemeStorage | null | undefined,
  preference: ThemePreference,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(THEME_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

/** Applies the theme before paint (boot script) or on change. */
export function applyResolvedTheme(root: HTMLElement, theme: ResolvedTheme): void {
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
}
