/**
 * Library deep-link contract (TASK-010).
 *
 * The dashboard's numbers are shortcuts into the library, so the shape of those
 * links lives in one place instead of being spelled out per component. TASK-011
 * reads the same list back, which is why unknown or missing values must fall
 * back to the default view rather than offering a filter the library cannot
 * honour.
 */

export const LIBRARY_FILTERS = [
  'all',
  'active',
  'draft',
  'deprecated',
  'favorites',
  'archived',
  'collections',
  'snapshots',
] as const;

export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

/** Human labels for the filtered views the dashboard can link to. */
export const LIBRARY_FILTER_LABELS: Record<LibraryFilter, string> = {
  all: 'All prompts',
  active: 'Active prompts',
  draft: 'Draft prompts',
  deprecated: 'Deprecated prompts',
  favorites: 'Favorites',
  archived: 'Archived',
  collections: 'Collections',
  snapshots: 'Snapshots',
};

/** `all` keeps the URL clean; every other filter is a query parameter. */
export function libraryFilterHref(filter: LibraryFilter): string {
  return filter === 'all' ? '/library' : `/library?filter=${filter}`;
}

/**
 * Reads a filter out of a raw query string.
 *
 * Unrecognised values return `all` rather than an error: a hand-typed or stale
 * URL should still show the library instead of an empty screen.
 */
export function readLibraryFilter(search: string): LibraryFilter {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const value = params.get('filter');
  return LIBRARY_FILTERS.find((filter) => filter === value) ?? 'all';
}
