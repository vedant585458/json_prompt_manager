import { describe, expect, it } from 'vitest';

import { AUTOSAVE_DELAY } from '@/domain/invariants';
import { createDefaultSettings } from '@/domain/factories';
import { createPreferencesStore, DEFAULT_AUTOSAVE_DELAY } from '@/store/preferencesStore';

const initial = {
  themePreference: 'dark' as const,
  resolvedTheme: 'dark' as const,
};

describe('preferencesStore', () => {
  it('defaults editor preferences to the settings defaults', () => {
    const store = createPreferencesStore(initial);
    const state = store.getState();

    expect(state.density).toBe('comfortable');
    expect(state.indentSize).toBe(2);
    expect(state.autosaveEnabled).toBe(true);
    expect(state.autosaveDelayMs).toBe(DEFAULT_AUTOSAVE_DELAY);
    expect(state.reducedMotion).toBe(false);
  });

  it('accepts explicit editor preferences', () => {
    const store = createPreferencesStore({
      ...initial,
      density: 'compact',
      indentSize: 4,
      autosaveEnabled: false,
      autosaveDelayMs: 1500,
      reducedMotion: true,
    });

    expect(store.getState()).toMatchObject({
      density: 'compact',
      indentSize: 4,
      autosaveEnabled: false,
      autosaveDelayMs: 1500,
      reducedMotion: true,
    });
  });

  it('clamps the autosave delay to the documented bounds', () => {
    const store = createPreferencesStore(initial);

    store.getState().setAutosaveDelay(50);
    expect(store.getState().autosaveDelayMs).toBe(AUTOSAVE_DELAY.min);

    store.getState().setAutosaveDelay(60_000);
    expect(store.getState().autosaveDelayMs).toBe(AUTOSAVE_DELAY.max);

    store.getState().setAutosaveDelay(Number.NaN);
    expect(store.getState().autosaveDelayMs).toBe(AUTOSAVE_DELAY.defaultValue);
  });

  it('adopts a persisted settings record, including its theme', () => {
    const store = createPreferencesStore(initial);
    const settings = {
      ...createDefaultSettings(),
      theme: 'light' as const,
      density: 'compact' as const,
      indentSize: 4 as const,
      autosaveEnabled: false,
      autosaveDelayMs: 1200,
      reducedMotion: true,
    };

    store.getState().applySettings(settings);

    expect(store.getState()).toMatchObject({
      themePreference: 'light',
      density: 'compact',
      indentSize: 4,
      autosaveEnabled: false,
      autosaveDelayMs: 1200,
      reducedMotion: true,
    });
    // The resolved theme follows the stored preference against the OS setting.
    expect(['dark', 'light']).toContain(store.getState().resolvedTheme);
  });

  it('writes preferences into a settings record without losing other fields', () => {
    const store = createPreferencesStore(initial);
    store.getState().setDensity('compact');
    store.getState().setIndentSize(4);
    store.getState().setAutosaveEnabled(false);
    store.getState().setAutosaveDelay(2000);

    const base = {
      ...createDefaultSettings(),
      onboardedAt: '2026-10-24T09:00:00.000Z',
      seedVersion: 1,
    };
    const settings = store.getState().toSettings(base);

    expect(settings).toMatchObject({
      density: 'compact',
      indentSize: 4,
      autosaveEnabled: false,
      autosaveDelayMs: 2000,
      onboardedAt: '2026-10-24T09:00:00.000Z',
      seedVersion: 1,
    });
    // The theme mirrors into the settings record too.
    expect(settings.theme).toBe('dark');
  });

  it('updates the theme pairs together', () => {
    const store = createPreferencesStore(initial);

    store.getState().setTheme('system', 'light');

    expect(store.getState().themePreference).toBe('system');
    expect(store.getState().resolvedTheme).toBe('light');
  });
});
