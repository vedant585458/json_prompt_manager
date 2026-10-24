import { describe, expect, it } from 'vitest';

import {
  applyResolvedTheme,
  isThemePreference,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  writeThemePreference,
  type ThemePreference,
} from '@/styles/theme';

function createStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe('theme preference validation', () => {
  it('accepts only the supported preferences', () => {
    expect(THEME_PREFERENCES).toEqual(['system', 'dark', 'light']);
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('DARK')).toBe(false);
    expect(isThemePreference('')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
    expect(isThemePreference(1)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('follows the OS preference for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('honours an explicit preference regardless of the OS', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });
});

describe('readThemePreference', () => {
  it('defaults to system without storage or a stored value', () => {
    expect(readThemePreference(null)).toBe('system');
    expect(readThemePreference(undefined)).toBe('system');
    expect(readThemePreference(createStorage())).toBe('system');
  });

  it('returns a valid stored preference', () => {
    expect(readThemePreference(createStorage({ [THEME_STORAGE_KEY]: 'light' }))).toBe('light');
    expect(readThemePreference(createStorage({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark');
  });

  it('falls back to system for corrupt or unknown values', () => {
    expect(readThemePreference(createStorage({ [THEME_STORAGE_KEY]: 'sepia' }))).toBe('system');
    expect(readThemePreference(createStorage({ [THEME_STORAGE_KEY]: '{"theme":"dark"}' }))).toBe(
      'system',
    );
  });

  it('does not throw when storage access fails', () => {
    const broken = {
      getItem: () => {
        throw new Error('storage blocked');
      },
      setItem: () => undefined,
    };
    expect(readThemePreference(broken)).toBe('system');
  });
});

describe('writeThemePreference', () => {
  it('persists a valid preference and reports success', () => {
    const storage = createStorage();
    expect(writeThemePreference(storage, 'dark')).toBe(true);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('reports failure without throwing when storage is unavailable', () => {
    expect(writeThemePreference(null, 'light')).toBe(false);
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    expect(writeThemePreference(broken, 'light')).toBe(false);
  });
});

describe('applyResolvedTheme', () => {
  it('writes the theme attribute and color-scheme to the root element', () => {
    const root = document.createElement('html');

    applyResolvedTheme(root, 'light');
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.style.colorScheme).toBe('light');

    applyResolvedTheme(root, 'dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
  });
});

describe('systemPrefersDark', () => {
  it('defaults to dark when no media query is available', () => {
    expect(systemPrefersDark(null)).toBe(true);
  });

  it('reads the provided media query result', () => {
    const preference = (matches: boolean) => ({ matches });
    expect(systemPrefersDark(preference(false))).toBe(false);
    expect(systemPrefersDark(preference(true))).toBe(true);
  });
});

describe('theme preference type coverage', () => {
  it('keeps the preference union exhaustive', () => {
    const preferences: ThemePreference[] = ['system', 'dark', 'light'];
    expect(preferences.map((preference) => resolveTheme(preference, true))).toEqual([
      'dark',
      'dark',
      'light',
    ]);
  });
});
