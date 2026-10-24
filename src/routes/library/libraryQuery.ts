/**
 * Library URL state (TASK-011).
 *
 * The URL is the single source of truth for what the library is showing. Every
 * control writes to it, every render reads from it, and the browser's back and
 * forward buttons therefore work without extra bookkeeping. The parsing here is
 * deliberately forgiving: a hand-edited or stale link falls back to the default
 * view rather than an empty screen, and unknown values are ignored.
 *
 * `?filter=` is the shorthand the dashboard links with (ADR-57). It is read as
 * a starting point and then written back as explicit parameters, so the two
 * surfaces cannot drift apart.
 */

import { readLibraryFilter } from '@/lib/libraryLinks';
import { isLibraryView, type LibraryView } from '@/lib/viewPreference';
import { normalizeTags } from '@/domain/invariants';
import type { PromptStatus } from '@/domain/types';
import type { PromptSort } from '@/store/selectors';

export const SORT_OPTIONS: ReadonlyArray<{ readonly value: PromptSort; readonly label: string }> = [
  { value: 'updated', label: 'Recently edited' },
  { value: 'created', label: 'Newest first' },
  { value: 'title', label: 'Title A–Z' },
];

export const STATUS_OPTIONS: ReadonlyArray<{
  readonly value: PromptStatus | 'all';
  readonly label: string;
}> = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'deprecated', label: 'Deprecated' },
];

export const VALIDATION_OPTIONS: ReadonlyArray<{
  readonly value: 'all' | 'parsable' | 'unparsable';
  readonly label: string;
}> = [
  { value: 'all', label: 'Any document' },
  { value: 'parsable', label: 'Parses' },
  { value: 'unparsable', label: 'Will not parse' },
];

export const EDITED_OPTIONS: ReadonlyArray<{
  readonly value: 'any' | '7d' | '30d' | '90d' | 'year';
  readonly label: string;
}> = [
  { value: 'any', label: 'Any time' },
  { value: '7d', label: 'Past 7 days' },
  { value: '30d', label: 'Past 30 days' },
  { value: '90d', label: 'Past 90 days' },
  { value: 'year', label: 'Past year' },
];

const EDITED_DAYS: Readonly<Record<string, number>> = { '7d': 7, '30d': 30, '90d': 90, year: 365 };

export const SORT_VALUES = ['updated', 'created', 'title'] as const;
export const STATUS_VALUES = ['all', 'active', 'draft', 'deprecated'] as const;
export const VALIDATION_VALUES = ['all', 'parsable', 'unparsable'] as const;
export const EDITED_VALUES = ['any', '7d', '30d', '90d', 'year'] as const;

/** Which create/edit dialog the library should open (TASK-012). */
export const LIBRARY_DIALOGS = ['prompt', 'folder', 'collection'] as const;

export type LibraryDialog = (typeof LIBRARY_DIALOGS)[number];

export function isLibraryDialog(value: unknown): value is LibraryDialog {
  return LIBRARY_DIALOGS.some((dialog) => dialog === value);
}

/** Long enough for a real query, short enough to keep a link shareable. */
export const SEARCH_MAX_LENGTH = 120;

/**
 * How long typing settles before the URL changes.
 *
 * Long enough that a burst of keystrokes writes one history entry, short enough
 * that the next word is already filtered when it is typed.
 */
export const SEARCH_DEBOUNCE_MS = 250;

export interface LibraryState {
  readonly q: string;
  /** All folders when `null`; the `unfiled` flag selects prompts without one. */
  readonly folder: string | null;
  readonly unfiled: boolean;
  readonly tags: readonly string[];
  readonly collection: string | null;
  readonly status: PromptStatus | 'all';
  readonly validation: 'all' | 'parsable' | 'unparsable';
  readonly archived: boolean;
  readonly favorites: boolean;
  readonly snapshots: boolean;
  /** "In any collection", the dashboard's Collections shortcut. */
  readonly hasCollection: boolean;
  readonly edited: 'any' | '7d' | '30d' | '90d' | 'year';
  readonly sort: PromptSort;
  /** `null` when the URL does not pin a view; the stored preference decides. */
  readonly view: LibraryView | null;
  /**
   * A create dialog requested by a command or a link (`?new=prompt`). It lives
   * in the URL so the palette's "New prompt" works from any screen and a
   * refresh cannot resurrect a dialog that was already closed.
   */
  readonly dialog: LibraryDialog | null;
}

export const EMPTY_LIBRARY_STATE: LibraryState = {
  q: '',
  folder: null,
  unfiled: false,
  tags: [],
  collection: null,
  status: 'all',
  validation: 'all',
  archived: false,
  favorites: false,
  snapshots: false,
  hasCollection: false,
  edited: 'any',
  sort: 'updated',
  view: null,
  dialog: null,
};

function paramsOf(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

/** `?filter=` is translated into the explicit filters it stands for. */
function withFilterAlias(state: LibraryState, search: string): LibraryState {
  const filter = readLibraryFilter(search);

  switch (filter) {
    case 'active':
      return { ...state, status: 'active' };
    case 'draft':
      return { ...state, status: 'draft' };
    case 'deprecated':
      return { ...state, status: 'deprecated' };
    case 'favorites':
      return { ...state, favorites: true };
    case 'archived':
      return { ...state, archived: true };
    case 'collections':
      return { ...state, hasCollection: true };
    case 'snapshots':
      return { ...state, snapshots: true };
    default:
      return state;
  }
}

function isArchivedFlag(value: string | null): boolean {
  return value === '1';
}

/** Reads the library state from a raw search string (with or without `?`). */
export function readLibraryState(search: string): LibraryState {
  const params = paramsOf(search);
  const base = withFilterAlias(EMPTY_LIBRARY_STATE, search);

  const folderParam = params.get('folder');
  const folder = folderParam === null || folderParam === 'unfiled' ? null : folderParam;

  const sortParam = params.get('sort');
  const sort = SORT_VALUES.find((value) => value === sortParam) ?? 'updated';

  const statusParam = params.get('status');
  const status =
    statusParam === null
      ? base.status
      : (STATUS_VALUES.find((value) => value === statusParam) ?? 'all');

  const validationParam = params.get('validation');
  const validation = VALIDATION_VALUES.find((value) => value === validationParam) ?? 'all';

  const editedParam = params.get('edited');
  const edited = EDITED_VALUES.find((value) => value === editedParam) ?? 'any';

  const viewParam = params.get('view');
  const view = isLibraryView(viewParam) ? viewParam : null;

  const dialogParam = params.get('new');
  const dialog = isLibraryDialog(dialogParam) ? dialogParam : null;

  const collection = params.get('collection');

  return {
    ...base,
    q: (params.get('q') ?? '').trim().slice(0, SEARCH_MAX_LENGTH),
    folder,
    unfiled: folderParam === 'unfiled',
    tags: normalizeTags(params.getAll('tag')),
    collection: collection === null || collection.length === 0 ? null : collection,
    status,
    validation,
    // Flags can only add to the shorthand, never cancel it: an explicit `0`
    // is not a thing the library writes, and treating absence as "off" would
    // silently drop the filter the user arrived with.
    archived: base.archived || isArchivedFlag(params.get('archived')),
    favorites: base.favorites || isArchivedFlag(params.get('favorites')),
    snapshots: base.snapshots || isArchivedFlag(params.get('snapshots')),
    hasCollection: base.hasCollection || isArchivedFlag(params.get('incollection')),
    edited,
    sort,
    view,
    dialog,
  };
}

/**
 * Serializes state back into a query string.
 *
 * Defaults are omitted so the common URL stays short, and `filter` is never
 * written — the explicit parameters are the only vocabulary after the first
 * interaction.
 */
export function writeLibraryState(state: LibraryState): string {
  const params = new URLSearchParams();

  if (state.q.length > 0) params.set('q', state.q);
  if (state.folder !== null) params.set('folder', state.folder);
  if (state.unfiled) params.set('folder', 'unfiled');
  for (const tag of state.tags) params.append('tag', tag);
  if (state.collection !== null) params.set('collection', state.collection);
  if (state.status !== 'all') params.set('status', state.status);
  if (state.validation !== 'all') params.set('validation', state.validation);
  if (state.archived) params.set('archived', '1');
  if (state.favorites) params.set('favorites', '1');
  if (state.snapshots) params.set('snapshots', '1');
  if (state.hasCollection) params.set('incollection', '1');
  if (state.edited !== 'any') params.set('edited', state.edited);
  if (state.sort !== 'updated') params.set('sort', state.sort);
  if (state.view !== null) params.set('view', state.view);
  if (state.dialog !== null) params.set('new', state.dialog);

  return params.toString();
}

/** Whether anything is narrowing the list; drives "Clear filters" and the count. */
export function hasActiveFilters(state: LibraryState): boolean {
  return (
    state.q.length > 0 ||
    state.folder !== null ||
    state.unfiled ||
    state.tags.length > 0 ||
    state.collection !== null ||
    state.status !== 'all' ||
    state.validation !== 'all' ||
    state.archived ||
    state.favorites ||
    state.snapshots ||
    state.hasCollection ||
    state.edited !== 'any'
  );
}

/** ISO cut-off for the "edited" range, or `undefined` for any time. */
export function editedAfter(state: LibraryState, now: Date): string | undefined {
  const days = EDITED_DAYS[state.edited];
  if (days === undefined) return undefined;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Every control resets the view; these are the ones shown as removable chips. */
export function toggleTag(state: LibraryState, tag: string): LibraryState {
  const tags = state.tags.includes(tag)
    ? state.tags.filter((existing) => existing !== tag)
    : normalizeTags([...state.tags, tag]);

  return { ...state, tags };
}
