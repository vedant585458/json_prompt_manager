import { describe, expect, it } from 'vitest';

import {
  EMPTY_LIBRARY_STATE,
  SEARCH_MAX_LENGTH,
  editedAfter,
  hasActiveFilters,
  readLibraryState,
  toggleTag,
  writeLibraryState,
} from '@/routes/library/libraryQuery';

describe('readLibraryState', () => {
  it('returns the defaults for an empty query', () => {
    expect(readLibraryState('')).toEqual(EMPTY_LIBRARY_STATE);
    expect(readLibraryState('?')).toEqual(EMPTY_LIBRARY_STATE);
  });

  it('reads every supported parameter', () => {
    const state = readLibraryState(
      '?q=%20invoice%20&folder=folder-1&tag=finance&tag=legal&collection=c1&status=active' +
        '&validation=unparsable&archived=1&favorites=1&snapshots=1&incollection=1&edited=30d' +
        '&sort=title&view=list',
    );

    expect(state).toMatchObject({
      q: 'invoice',
      folder: 'folder-1',
      unfiled: false,
      tags: ['finance', 'legal'],
      collection: 'c1',
      status: 'active',
      validation: 'unparsable',
      archived: true,
      favorites: true,
      snapshots: true,
      hasCollection: true,
      edited: '30d',
      sort: 'title',
      view: 'list',
    });
  });

  it('understands the unfiled sentinel', () => {
    expect(readLibraryState('?folder=unfiled')).toMatchObject({ folder: null, unfiled: true });
  });

  it('falls back for unknown values instead of failing', () => {
    const state = readLibraryState('?sort=price&status=retired&validation=maybe&edited=ever');

    expect(state).toMatchObject({
      sort: 'updated',
      status: 'all',
      validation: 'all',
      edited: 'any',
    });
    expect(state.view).toBeNull();
  });

  it('maps the dashboard filter shorthand onto explicit filters', () => {
    expect(readLibraryState('?filter=favorites').favorites).toBe(true);
    expect(readLibraryState('?filter=archived').archived).toBe(true);
    expect(readLibraryState('?filter=collections').hasCollection).toBe(true);
    expect(readLibraryState('?filter=snapshots').snapshots).toBe(true);
    expect(readLibraryState('?filter=active').status).toBe('active');
    expect(readLibraryState('?filter=all')).toEqual(EMPTY_LIBRARY_STATE);
  });

  it('lets explicit parameters win over the shorthand', () => {
    expect(readLibraryState('?filter=active&status=draft').status).toBe('draft');
  });

  it('normalizes tags and caps the search text', () => {
    const state = readLibraryState(`?tag=Finance&tag=finance&q=${'x'.repeat(400)}`);
    expect(state.tags).toEqual(['finance']);
    expect(state.q).toHaveLength(SEARCH_MAX_LENGTH);
  });
});

describe('writeLibraryState', () => {
  it('writes nothing for the default state', () => {
    expect(writeLibraryState(EMPTY_LIBRARY_STATE)).toBe('');
  });

  it('omits defaults and writes changed values', () => {
    const query = writeLibraryState({
      ...EMPTY_LIBRARY_STATE,
      q: 'json schema',
      tags: ['finance', 'legal'],
      status: 'draft',
      sort: 'title',
      view: 'list',
    });

    expect(query).toBe('q=json+schema&tag=finance&tag=legal&status=draft&sort=title&view=list');
  });

  it('never writes the dashboard shorthand', () => {
    const query = writeLibraryState({ ...EMPTY_LIBRARY_STATE, archived: true });
    expect(query).toBe('archived=1');
    expect(query).not.toContain('filter=');
  });

  it('round-trips every field', () => {
    const state = {
      ...EMPTY_LIBRARY_STATE,
      q: 'support',
      folder: 'folder-2',
      tags: ['a', 'b'],
      collection: 'c2',
      status: 'deprecated' as const,
      validation: 'parsable' as const,
      archived: true,
      favorites: true,
      snapshots: true,
      hasCollection: true,
      edited: '90d' as const,
      sort: 'created' as const,
      view: 'grid' as const,
    };

    expect(readLibraryState(writeLibraryState(state))).toEqual(state);
  });

  it('round-trips the unfiled filter', () => {
    const state = { ...EMPTY_LIBRARY_STATE, unfiled: true };
    expect(writeLibraryState(state)).toBe('folder=unfiled');
    expect(readLibraryState(writeLibraryState(state))).toEqual(state);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the default state and true for any narrowing filter', () => {
    expect(hasActiveFilters(EMPTY_LIBRARY_STATE)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_LIBRARY_STATE, q: 'x' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_LIBRARY_STATE, archived: true })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_LIBRARY_STATE, tags: ['a'] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_LIBRARY_STATE, edited: '7d' })).toBe(true);
    // A view choice is not a filter.
    expect(hasActiveFilters({ ...EMPTY_LIBRARY_STATE, view: 'list' })).toBe(false);
  });
});

describe('editedAfter', () => {
  const now = new Date('2026-10-24T12:00:00.000Z');

  it('returns undefined for any time', () => {
    expect(editedAfter(EMPTY_LIBRARY_STATE, now)).toBeUndefined();
  });

  it('subtracts the range in days', () => {
    expect(editedAfter({ ...EMPTY_LIBRARY_STATE, edited: '7d' }, now)).toBe(
      '2026-10-17T12:00:00.000Z',
    );
    expect(editedAfter({ ...EMPTY_LIBRARY_STATE, edited: 'year' }, now)).toBe(
      '2025-10-24T12:00:00.000Z',
    );
  });
});

describe('toggleTag', () => {
  it('adds and removes a tag, keeping the list normalized', () => {
    const withTag = toggleTag(EMPTY_LIBRARY_STATE, 'Finance');
    expect(withTag.tags).toEqual(['finance']);
    expect(toggleTag(withTag, 'finance').tags).toEqual([]);
  });
});
