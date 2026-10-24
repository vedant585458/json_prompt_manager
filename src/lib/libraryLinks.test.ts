import { describe, expect, it } from 'vitest';

import {
  LIBRARY_FILTER_LABELS,
  LIBRARY_FILTERS,
  libraryFilterHref,
  readLibraryFilter,
} from '@/lib/libraryLinks';

describe('library links', () => {
  it('keeps the default view on a clean URL', () => {
    expect(libraryFilterHref('all')).toBe('/library');
  });

  it('encodes every other filter as a query parameter', () => {
    for (const filter of LIBRARY_FILTERS.filter((value) => value !== 'all')) {
      expect(libraryFilterHref(filter)).toBe(`/library?filter=${filter}`);
      expect(readLibraryFilter(libraryFilterHref(filter).split('?')[1] ?? '')).toBe(filter);
    }
  });

  it('labels every filter, so no shortcut is anonymous', () => {
    for (const filter of LIBRARY_FILTERS) {
      expect(LIBRARY_FILTER_LABELS[filter].length).toBeGreaterThan(0);
    }
  });

  it('falls back to the full library for unknown or empty values', () => {
    expect(readLibraryFilter('')).toBe('all');
    expect(readLibraryFilter('?filter=nope')).toBe('all');
    expect(readLibraryFilter('?filter=')).toBe('all');
    expect(readLibraryFilter('?sort=name')).toBe('all');
  });

  it('accepts a search string with or without the leading question mark', () => {
    expect(readLibraryFilter('?filter=favorites')).toBe('favorites');
    expect(readLibraryFilter('filter=favorites')).toBe('favorites');
  });
});
