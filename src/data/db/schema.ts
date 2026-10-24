/**
 * IndexedDB schema (TASK-006).
 *
 * One database, eleven object stores, and the indexes the library, history, and
 * activity views need. Rows are the domain entities plus a few numeric mirrors,
 * because IndexedDB cannot index booleans (`docs/PERSISTENCE.md` §3).
 */

import type { DBSchema } from 'idb';

import type {
  ActivityEvent,
  Collection,
  Folder,
  Prompt,
  PromptRevision,
  PromptSchema,
  PromptStatus,
  PromptTemplate,
  Settings,
  Snippet,
  TestCase,
} from '@/domain/types';

export const DB_NAME = 'promptforge';
export const PROBE_DB_NAME = 'promptforge-probe';

/**
 * Current database version.
 *
 * v1 — the layout from `tasks.md` §6.3.
 * v2 — adds the `prompts.status` index used by library status filters.
 */
export const DB_SCHEMA_VERSION = 2;

/** Both singleton stores (`settings`, `meta`) use this key. */
export const SINGLETON_KEY = 'app';

export const STORE = {
  prompts: 'prompts',
  revisions: 'revisions',
  folders: 'folders',
  collections: 'collections',
  templates: 'templates',
  testCases: 'testCases',
  schemas: 'schemas',
  snippets: 'snippets',
  activity: 'activity',
  settings: 'settings',
  meta: 'meta',
} as const;

export type StoreName = (typeof STORE)[keyof typeof STORE];

export const STORE_NAMES: readonly StoreName[] = Object.values(STORE);

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Prompts gain numeric mirrors for the three boolean flags.
 *
 * IndexedDB skips index entries whose key is not a valid key type, so a boolean
 * `archived` index would silently match nothing. The flags are derived values:
 * the booleans stay authoritative, the adapter recomputes the mirrors on write.
 */
export interface PromptRow extends Prompt {
  readonly archivedFlag: 0 | 1;
  readonly favoriteFlag: 0 | 1;
  readonly pinnedFlag: 0 | 1;
}

export function flag(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

/** Templates mirror `isBuiltIn` for the same reason as prompts. */
export interface TemplateRow extends PromptTemplate {
  readonly builtInFlag: 0 | 1;
}

/** Settings are stored as one row so reads are a single key lookup. */
export interface SettingsRow extends Settings {
  readonly key: typeof SINGLETON_KEY;
}

/** Bookkeeping row: schema version (written by migrations) and seed version. */
export interface MetaRow {
  readonly key: typeof SINGLETON_KEY;
  readonly dbSchemaVersion: number;
  readonly seedVersion: number;
}

/* -------------------------------------------------------------------------- */
/* Typed schema                                                               */
/* -------------------------------------------------------------------------- */

export interface PromptForgeDB extends DBSchema {
  prompts: {
    key: string;
    value: PromptRow;
    indexes: {
      updatedAt: string;
      folderId: string;
      archived: 0 | 1;
      favorite: 0 | 1;
      pinned: 0 | 1;
      status: PromptStatus;
    };
  };
  revisions: {
    key: string;
    value: PromptRevision;
    indexes: {
      promptId: string;
      promptId_revisionNumber: [string, number];
    };
  };
  folders: { key: string; value: Folder };
  collections: { key: string; value: Collection };
  templates: {
    key: string;
    value: TemplateRow;
    indexes: { isBuiltIn: 0 | 1 };
  };
  testCases: {
    key: string;
    value: TestCase;
    indexes: { promptId: string };
  };
  schemas: { key: string; value: PromptSchema };
  snippets: { key: string; value: Snippet };
  activity: {
    key: string;
    value: ActivityEvent;
    indexes: { createdAt: string };
  };
  settings: { key: string; value: SettingsRow };
  meta: { key: string; value: MetaRow };
}

/* -------------------------------------------------------------------------- */
/* Declarative store definitions                                             */
/* -------------------------------------------------------------------------- */

/** Key path for each store. */
export const KEY_PATHS: Readonly<Record<StoreName, string>> = {
  prompts: 'id',
  revisions: 'id',
  folders: 'id',
  collections: 'id',
  templates: 'id',
  testCases: 'id',
  schemas: 'id',
  snippets: 'id',
  activity: 'id',
  settings: 'key',
  meta: 'key',
};

export interface IndexDefinition {
  readonly name: string;
  readonly keyPath: string | readonly string[];
  readonly unique?: boolean;
}

export interface StoreDefinition {
  readonly name: StoreName;
  readonly indexes: readonly IndexDefinition[];
}

/**
 * Stores and indexes as of v1 (the layout in `tasks.md` §6.3).
 *
 * Index names match the specification; three of them point at numeric mirrors
 * (`archived` → `archivedFlag`) because booleans are not indexable.
 */
export const V1_STORES: readonly StoreDefinition[] = [
  {
    name: STORE.prompts,
    indexes: [
      { name: 'updatedAt', keyPath: 'updatedAt' },
      { name: 'folderId', keyPath: 'folderId' },
      { name: 'archived', keyPath: 'archivedFlag' },
      { name: 'favorite', keyPath: 'favoriteFlag' },
      { name: 'pinned', keyPath: 'pinnedFlag' },
    ],
  },
  {
    name: STORE.revisions,
    indexes: [
      { name: 'promptId', keyPath: 'promptId' },
      {
        name: 'promptId_revisionNumber',
        keyPath: ['promptId', 'revisionNumber'],
        unique: true,
      },
    ],
  },
  { name: STORE.folders, indexes: [] },
  { name: STORE.collections, indexes: [] },
  { name: STORE.templates, indexes: [{ name: 'isBuiltIn', keyPath: 'builtInFlag' }] },
  { name: STORE.testCases, indexes: [{ name: 'promptId', keyPath: 'promptId' }] },
  { name: STORE.schemas, indexes: [] },
  { name: STORE.snippets, indexes: [] },
  { name: STORE.activity, indexes: [{ name: 'createdAt', keyPath: 'createdAt' }] },
  { name: STORE.settings, indexes: [] },
  { name: STORE.meta, indexes: [] },
];

/** Indexes introduced after v1, applied by the matching migration. */
export const V2_INDEXES: readonly { store: StoreName; index: IndexDefinition }[] = [
  { store: STORE.prompts, index: { name: 'status', keyPath: 'status' } },
];

/** Every index this build expects, grouped by store — used by integrity checks. */
export function expectedIndexes(): Record<StoreName, string[]> {
  const expected = Object.fromEntries(STORE_NAMES.map((name) => [name, [] as string[]])) as Record<
    StoreName,
    string[]
  >;

  for (const store of V1_STORES) {
    expected[store.name] = store.indexes.map((index) => index.name);
  }
  for (const { store, index } of V2_INDEXES) {
    expected[store] = [...expected[store], index.name];
  }

  return expected;
}
