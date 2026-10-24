import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIBRARY_VIEW,
  LIBRARY_VIEW_STORAGE_KEY,
  isLibraryView,
  readLibraryView,
  writeLibraryView,
} from '@/lib/viewPreference';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    dump: () => Object.fromEntries(data),
  };
}

describe('library view preference', () => {
  it('defaults to the grid when nothing is stored', () => {
    expect(readLibraryView(fakeStorage())).toBe('grid');
    expect(DEFAULT_LIBRARY_VIEW).toBe('grid');
  });

  it('reads back what was written', () => {
    const storage = fakeStorage();
    expect(writeLibraryView('list', storage)).toBe(true);
    expect(storage.dump()[LIBRARY_VIEW_STORAGE_KEY]).toBe('list');
    expect(readLibraryView(storage)).toBe('list');
  });

  it('ignores unknown values', () => {
    expect(readLibraryView(fakeStorage({ [LIBRARY_VIEW_STORAGE_KEY]: 'masonry' }))).toBe('grid');
  });

  it('tolerates missing or throwing storage', () => {
    expect(readLibraryView(null)).toBe('grid');
    expect(writeLibraryView('list', null)).toBe(false);

    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };

    expect(readLibraryView(broken)).toBe('grid');
    expect(writeLibraryView('grid', broken)).toBe(false);
  });

  it('guards the view union', () => {
    expect(isLibraryView('grid')).toBe(true);
    expect(isLibraryView('list')).toBe(true);
    expect(isLibraryView('table')).toBe(false);
    expect(isLibraryView(null)).toBe(false);
  });
});
