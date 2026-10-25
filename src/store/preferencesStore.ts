/**
 * Preferences store (TASK-007).
 *
 * Owns every user preference: theme (TASK-002's slice, now extended), editor
 * density, indentation, autosave behaviour, and reduced motion. Values are
 * mirrored into the settings repository when the user saves them; the theme
 * also stays in `localStorage` so the pre-paint boot script can apply it before
 * React mounts.
 */

import { create } from 'zustand';

import { clampAutosaveDelay, AUTOSAVE_DELAY } from '@/domain/invariants';
import { createDefaultSettings } from '@/domain/factories';
import { DEFAULT_HEALTH_THRESHOLDS, normalizeHealthThresholds } from '@/domain/health';
import type { EditorDensity, HealthThresholds, IndentSize, Settings } from '@/domain/types';
import {
  getBrowserStorage,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  type ResolvedTheme,
  type ThemePreference,
} from '@/styles/theme';

export interface InitialPreferences {
  readonly themePreference: ThemePreference;
  readonly resolvedTheme: ResolvedTheme;
}

export interface PreferencesState {
  readonly themePreference: ThemePreference;
  readonly resolvedTheme: ResolvedTheme;
  readonly density: EditorDensity;
  readonly indentSize: IndentSize;
  readonly autosaveEnabled: boolean;
  readonly autosaveDelayMs: number;
  readonly reducedMotion: boolean;
  /** Ages at which a prompt counts as stale; shared with the health report. */
  readonly healthThresholds: HealthThresholds;

  setTheme: (preference: ThemePreference, resolvedTheme: ResolvedTheme) => void;
  setDensity: (density: EditorDensity) => void;
  setIndentSize: (indentSize: IndentSize) => void;
  setAutosaveEnabled: (enabled: boolean) => void;
  /** Clamped to `AUTOSAVE_DELAY` bounds; invalid values fall back to the default. */
  setAutosaveDelay: (milliseconds: number) => void;
  setReducedMotion: (enabled: boolean) => void;
  /** Out-of-range or unreadable values fall back to the default. */
  setHealthThresholds: (thresholds: HealthThresholds) => void;
  /** Adopts a persisted settings record (called after hydration). */
  applySettings: (settings: Settings) => void;
  /**
   * Writes these preferences into a settings record, preserving fields the
   * store does not own (`onboardedAt`, `seedVersion`).
   */
  toSettings: (base?: Settings) => Settings;
}

export type PreferencesStore = ReturnType<typeof createPreferencesStore>;

export interface PreferencesDefaults extends InitialPreferences {
  readonly density?: EditorDensity;
  readonly indentSize?: IndentSize;
  readonly autosaveEnabled?: boolean;
  readonly autosaveDelayMs?: number;
  readonly reducedMotion?: boolean;
  readonly healthThresholds?: HealthThresholds;
}

/** Reads the persisted theme and resolves it against the OS setting. */
export function getInitialPreferences(): InitialPreferences {
  const themePreference = readThemePreference(getBrowserStorage());
  return {
    themePreference,
    resolvedTheme: resolveTheme(themePreference, systemPrefersDark()),
  };
}

export function createPreferencesStore(initial: PreferencesDefaults = getInitialPreferences()) {
  const defaults = createDefaultSettings();

  return create<PreferencesState>()((set, get) => ({
    themePreference: initial.themePreference,
    resolvedTheme: initial.resolvedTheme,
    density: initial.density ?? defaults.density,
    indentSize: initial.indentSize ?? defaults.indentSize,
    autosaveEnabled: initial.autosaveEnabled ?? defaults.autosaveEnabled,
    autosaveDelayMs: initial.autosaveDelayMs ?? defaults.autosaveDelayMs,
    reducedMotion: initial.reducedMotion ?? defaults.reducedMotion,
    healthThresholds: initial.healthThresholds ?? DEFAULT_HEALTH_THRESHOLDS,

    setTheme: (themePreference, resolvedTheme) => set({ themePreference, resolvedTheme }),
    setDensity: (density) => set({ density }),
    setIndentSize: (indentSize) => set({ indentSize }),
    setAutosaveEnabled: (autosaveEnabled) => set({ autosaveEnabled }),
    setAutosaveDelay: (milliseconds) => set({ autosaveDelayMs: clampAutosaveDelay(milliseconds) }),
    setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    setHealthThresholds: (thresholds) =>
      set({ healthThresholds: normalizeHealthThresholds(thresholds) }),

    applySettings: (settings) =>
      set({
        themePreference: settings.theme,
        resolvedTheme: resolveTheme(settings.theme, systemPrefersDark()),
        density: settings.density,
        indentSize: settings.indentSize,
        autosaveEnabled: settings.autosaveEnabled,
        autosaveDelayMs: clampAutosaveDelay(settings.autosaveDelayMs),
        reducedMotion: settings.reducedMotion,
        healthThresholds: normalizeHealthThresholds(settings.healthThresholds),
      }),

    toSettings: (base = createDefaultSettings()) => {
      const state = get();
      return {
        ...base,
        theme: state.themePreference,
        density: state.density,
        indentSize: state.indentSize,
        autosaveEnabled: state.autosaveEnabled,
        autosaveDelayMs: clampAutosaveDelay(state.autosaveDelayMs),
        reducedMotion: state.reducedMotion,
        healthThresholds: state.healthThresholds,
      };
    },
  }));
}

export const usePreferencesStore = createPreferencesStore();

/** Default autosave delay, re-exported for settings surfaces. */
export const DEFAULT_AUTOSAVE_DELAY = AUTOSAVE_DELAY.defaultValue;
