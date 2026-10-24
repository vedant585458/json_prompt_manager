import { create } from 'zustand';

import {
  getBrowserStorage,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  type ResolvedTheme,
  type ThemePreference,
} from '@/styles/theme';

/**
 * Preferences slice (TASK-002).
 *
 * Only the theme slice exists at this stage. TASK-007 extends this store with
 * editor density, indent size, and autosave settings backed by the settings
 * repository. Keeping the slice separate from the provider keeps theme state
 * testable without rendering React.
 */

export interface PreferencesState {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (preference: ThemePreference, resolvedTheme: ResolvedTheme) => void;
}

export type PreferencesStore = ReturnType<typeof createPreferencesStore>;

export interface InitialPreferences {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
}

/** Reads the persisted preference and resolves it against the OS setting. */
export function getInitialPreferences(): InitialPreferences {
  const themePreference = readThemePreference(getBrowserStorage());
  return {
    themePreference,
    resolvedTheme: resolveTheme(themePreference, systemPrefersDark()),
  };
}

export function createPreferencesStore(initial: InitialPreferences = getInitialPreferences()) {
  return create<PreferencesState>()((set) => ({
    themePreference: initial.themePreference,
    resolvedTheme: initial.resolvedTheme,
    setTheme: (themePreference, resolvedTheme) => set({ themePreference, resolvedTheme }),
  }));
}

export const usePreferencesStore = createPreferencesStore();
