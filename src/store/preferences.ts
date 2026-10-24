/**
 * Theme preference slice (TASK-002).
 *
 * TASK-007 moved the implementation into `preferencesStore.ts`, which owns the
 * full preference set (theme, density, indentation, autosave, reduced motion).
 * This module stays as the import path the theme provider and its tests already
 * use, so the public surface did not move under them.
 */

export {
  createPreferencesStore,
  getInitialPreferences,
  usePreferencesStore,
  DEFAULT_AUTOSAVE_DELAY,
  type InitialPreferences,
  type PreferencesDefaults,
  type PreferencesState,
  type PreferencesStore,
} from '@/store/preferencesStore';
