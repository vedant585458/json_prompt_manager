import { describe, expect, it } from 'vitest';

import { createPreferencesStore, getInitialPreferences } from '@/store/preferences';
import { THEME_STORAGE_KEY } from '@/styles/theme';
import { mockMatchMedia } from '@/test/matchMedia';

describe('getInitialPreferences', () => {
  it('follows the OS when nothing is stored', () => {
    mockMatchMedia(false);
    expect(getInitialPreferences()).toEqual({
      themePreference: 'system',
      resolvedTheme: 'light',
    });
  });

  it('honours a persisted explicit preference over the OS', () => {
    mockMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    expect(getInitialPreferences()).toEqual({ themePreference: 'dark', resolvedTheme: 'dark' });
  });

  it('ignores an invalid persisted value', () => {
    mockMatchMedia(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');

    expect(getInitialPreferences()).toEqual({
      themePreference: 'system',
      resolvedTheme: 'dark',
    });
  });
});

describe('createPreferencesStore', () => {
  it('exposes the injected initial state', () => {
    const store = createPreferencesStore({ themePreference: 'light', resolvedTheme: 'light' });

    expect(store.getState().themePreference).toBe('light');
    expect(store.getState().resolvedTheme).toBe('light');
  });

  it('updates both preference and resolved theme together', () => {
    const store = createPreferencesStore({ themePreference: 'system', resolvedTheme: 'dark' });

    store.getState().setTheme('light', 'light');

    expect(store.getState().themePreference).toBe('light');
    expect(store.getState().resolvedTheme).toBe('light');
  });
});
