import { useCallback, useEffect, useMemo, type ReactNode } from 'react';

import { ThemeContext, type ThemeContextValue } from '@/app/providers/theme-context';
import { usePreferencesStore } from '@/store/preferences';
import {
  applyReducedMotion,
  applyResolvedTheme,
  getBrowserStorage,
  getSystemThemeQuery,
  resolveTheme,
  systemPrefersDark,
  writeThemePreference,
  type ThemePreference,
} from '@/styles/theme';

/**
 * Applies the resolved theme to <html> and keeps it in sync with the OS when
 * the user's preference is "system".
 *
 * The initial paint is handled by the inline boot script in index.html, so this
 * provider never causes a flash of the wrong theme; it re-applies the same
 * resolution on mount and owns every later change.
 *
 * It also owns the reduced-motion attribute. `global.css` already honoured
 * `[data-reduced-motion='true']`, but nothing ever set it, so the in-app
 * preference was a switch that did nothing — the OS setting worked and the
 * product's own did not (TASK-028). The attribute is set from the stored
 * preference, which means a person who cannot tolerate motion gets that from
 * choosing it here as well as from their operating system.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = usePreferencesStore((state) => state.themePreference);
  const resolved = usePreferencesStore((state) => state.resolvedTheme);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const reducedMotion = usePreferencesStore((state) => state.reducedMotion);

  useEffect(() => {
    applyResolvedTheme(document.documentElement, resolved);
  }, [resolved]);

  useEffect(() => {
    applyReducedMotion(document.documentElement, reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    if (preference !== 'system') return;

    const query = getSystemThemeQuery();
    if (!query) return;

    // Reconcile once in case the OS changed between module load and mount.
    setTheme('system', resolveTheme('system', query.matches));

    const handleChange = (event: MediaQueryListEvent) => {
      setTheme('system', resolveTheme('system', event.matches));
    };

    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [preference, setTheme]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setTheme(next, resolveTheme(next, systemPrefersDark()));
      // localStorage failure is non-fatal: the theme still applies for this
      // session, and TASK-007 moves persistence into the settings repository.
      writeThemePreference(getBrowserStorage(), next);
    },
    [setTheme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
