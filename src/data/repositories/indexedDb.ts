/**
 * IndexedDB repositories (TASK-006).
 *
 * Each method runs inside a transaction and reports failures as typed
 * `StorageError`s. Reads validate the shape of stored records, so a corrupted
 * row surfaces as `CorruptDataError` instead of undefined behaviour downstream.
 */

import type { IDBPDatabase } from 'idb';

import {
  InvalidWriteError,
  RecordNotFoundError,
  StaleWriteError,
  withStorageErrors,
} from '@/data/db/errors';
import {
  openPromptForgeDatabase,
  type OpenDatabaseOptions,
  type PromptForgeDatabase,
} from '@/data/db/indexedDb';
import {
  DB_SCHEMA_VERSION,
  SINGLETON_KEY,
  STORE,
  flag,
  type PromptForgeDB,
  type MetaRow,
  type PromptRow,
  type SettingsRow,
  type TemplateRow,
} from '@/data/db/schema';
import type {
  DatabaseMeta,
  EntityRepository,
  PromptQuery,
  PromptWrite,
  Repositories,
} from '@/data/repositories/contracts';
import {
  assertStoredEntity,
  assertStoredPrompt,
  assertStoredRevision,
  fromPromptRow,
  fromTemplateRow,
  matchesPromptQuery,
  sortActivity,
  sortByName,
  sortPrompts,
  sortRevisions,
  toPromptRow,
  toTemplateRow,
} from '@/data/repositories/shared';
import type {
  ActivityEvent,
  Collection,
  Folder,
  Prompt,
  PromptRevision,
  PromptSchema,
  PromptTemplate,
  Settings,
  Snippet,
  TestCase,
} from '@/domain/types';

type Database = IDBPDatabase<PromptForgeDB>;
type SimpleStore = 'folders' | 'collections' | 'schemas' | 'snippets' | 'testCases';

/** Repository over a store whose rows equal the entity. */
function createEntityRepository<T extends { id: string }>(
  db: Database,
  store: SimpleStore,
  sort: (items: T[]) => T[],
): EntityRepository<T> {
  const read = (rows: unknown[]): T[] => rows.map((row) => assertStoredEntity(row, store) as T);

  return {
    list: () =>
      withStorageErrors(`${store}.list`, async () => {
        const rows = await db.getAll(store);
        return sort(read(rows).map((item) => structuredClone(item)));
      }),

    get: (id) =>
      withStorageErrors(`${store}.get`, async () => {
        const row = await db.get(store, id);
        return row ? (structuredClone(assertStoredEntity(row, store)) as T) : null;
      }),

    create: (entity) =>
      withStorageErrors(`${store}.create`, async () => {
        assertStoredEntity(entity, store);
        // The store union cannot be narrowed by the generic entity type; the
        // caller binds one store to one entity type, and the value is checked
        // above, so this is the only place a cast is needed.
        await db.add(store, entity as never);
        return structuredClone(entity);
      }),

    update: (entity) =>
      withStorageErrors(`${store}.update`, async () => {
        assertStoredEntity(entity, store);
        const existing = await db.get(store, entity.id);
        if (!existing) {
          throw new RecordNotFoundError(`No record with id "${entity.id}" in "${store}".`);
        }
        await db.put(store, entity as never);
        return structuredClone(entity);
      }),

    delete: (id) =>
      withStorageErrors(`${store}.delete`, async () => {
        await db.delete(store, id);
      }),
  };
}

async function createPromptRepository(db: Database) {
  const fromRows = (rows: readonly PromptRow[]): Prompt[] => sortPrompts(rows.map(fromPromptRow));

  return {
    list: () =>
      withStorageErrors('prompts.list', async () => {
        const rows = await db.getAll(STORE.prompts);
        rows.forEach(assertStoredPrompt);
        return fromRows(rows);
      }),

    query: (criteria: PromptQuery = {}) =>
      withStorageErrors('prompts.query', async () => {
        // Pick the most selective index available, then filter the rest.
        let rows: PromptRow[];

        if (criteria.archived !== undefined) {
          rows = await db.getAllFromIndex(STORE.prompts, 'archived', flag(criteria.archived));
        } else if (criteria.favorite !== undefined) {
          rows = await db.getAllFromIndex(STORE.prompts, 'favorite', flag(criteria.favorite));
        } else if (criteria.pinned !== undefined) {
          rows = await db.getAllFromIndex(STORE.prompts, 'pinned', flag(criteria.pinned));
        } else if (criteria.status !== undefined) {
          rows = await db.getAllFromIndex(STORE.prompts, 'status', criteria.status);
        } else if (criteria.updatedAfter !== undefined || criteria.updatedBefore !== undefined) {
          rows = await db.getAllFromIndex(
            STORE.prompts,
            'updatedAt',
            IDBKeyRange.bound(
              criteria.updatedAfter ?? '\u0000',
              criteria.updatedBefore ?? '\uffff',
            ),
          );
        } else if (criteria.folderId !== undefined && criteria.folderId !== null) {
          rows = await db.getAllFromIndex(STORE.prompts, 'folderId', criteria.folderId);
        } else {
          rows = await db.getAll(STORE.prompts);
        }

        rows.forEach(assertStoredPrompt);
        return sortPrompts(
          rows.map(fromPromptRow).filter((prompt) => matchesPromptQuery(prompt, criteria)),
        );
      }),

    get: (id: string) =>
      withStorageErrors('prompts.get', async () => {
        const row = await db.get(STORE.prompts, id);
        return row ? assertStoredPrompt(fromPromptRow(row)) : null;
      }),

    create: (prompt: Prompt) =>
      withStorageErrors('prompts.create', async () => {
        assertStoredPrompt(prompt);
        await db.add(STORE.prompts, toPromptRow(prompt));
        return prompt;
      }),

    update: (prompt: Prompt, options: { expectedVersion: number }) =>
      withStorageErrors('prompts.update', async () => {
        assertStoredPrompt(prompt);

        const transaction = db.transaction(STORE.prompts, 'readwrite');
        const stored = await transaction.store.get(prompt.id);

        const reject = async (error: Error): Promise<never> => {
          transaction.abort();
          await transaction.done.catch(() => undefined);
          throw error;
        };

        if (!stored) {
          return reject(new RecordNotFoundError(`No prompt with id "${prompt.id}".`));
        }
        if (stored.version !== options.expectedVersion) {
          return reject(new StaleWriteError(prompt.id, options.expectedVersion, stored.version));
        }
        if (prompt.version !== options.expectedVersion + 1) {
          return reject(
            new InvalidWriteError(
              `Prompt ${prompt.id} must be saved with version ${options.expectedVersion + 1}, received ${prompt.version}.`,
            ),
          );
        }

        await transaction.store.put(toPromptRow(prompt));
        await transaction.done;
        return prompt;
      }),

    updateMany: (writes: readonly PromptWrite[]) =>
      withStorageErrors('prompts.updateMany', async () => {
        if (writes.length === 0) return [];

        writes.forEach((write) => assertStoredPrompt(write.prompt));

        const transaction = db.transaction(STORE.prompts, 'readwrite');
        const saved: Prompt[] = [];

        const reject = async (error: Error): Promise<never> => {
          transaction.abort();
          await transaction.done.catch(() => undefined);
          throw error;
        };

        for (const write of writes) {
          const stored = await transaction.store.get(write.prompt.id);
          if (!stored) {
            return reject(new RecordNotFoundError(`No prompt with id "${write.prompt.id}".`));
          }
          if (stored.version !== write.expectedVersion) {
            return reject(
              new StaleWriteError(write.prompt.id, write.expectedVersion, stored.version),
            );
          }
          if (write.prompt.version !== write.expectedVersion + 1) {
            return reject(
              new InvalidWriteError(
                `Prompt ${write.prompt.id} must be saved with version ${write.expectedVersion + 1}, received ${write.prompt.version}.`,
              ),
            );
          }

          await transaction.store.put(toPromptRow(write.prompt));
          saved.push(write.prompt);
        }

        await transaction.done;
        return saved;
      }),

    delete: (id: string) =>
      withStorageErrors('prompts.delete', async () => {
        await db.delete(STORE.prompts, id);
      }),

    deleteCascade: (id: string) =>
      withStorageErrors('prompts.deleteCascade', async () => {
        // One transaction across the three stores. If any delete fails the
        // transaction aborts, so a half-deleted prompt cannot be left behind.
        const transaction = db.transaction(
          [STORE.prompts, STORE.revisions, STORE.testCases],
          'readwrite',
        );
        const revisionStore = transaction.objectStore(STORE.revisions);
        const testCaseStore = transaction.objectStore(STORE.testCases);

        const [revisionKeys, testCaseKeys] = await Promise.all([
          revisionStore.index('promptId').getAllKeys(id),
          testCaseStore.index('promptId').getAllKeys(id),
        ]);

        await Promise.all([
          ...revisionKeys.map((key) => revisionStore.delete(key)),
          ...testCaseKeys.map((key) => testCaseStore.delete(key)),
          transaction.objectStore(STORE.prompts).delete(id),
        ]);
        await transaction.done;
      }),

    deleteManyCascade: (ids: readonly string[]) =>
      withStorageErrors('prompts.deleteManyCascade', async () => {
        if (ids.length === 0) return;

        // One transaction for every prompt in the batch, so a failed bulk
        // delete cannot leave half the selection removed.
        const transaction = db.transaction(
          [STORE.prompts, STORE.revisions, STORE.testCases],
          'readwrite',
        );
        const promptStore = transaction.objectStore(STORE.prompts);
        const revisionStore = transaction.objectStore(STORE.revisions);
        const testCaseStore = transaction.objectStore(STORE.testCases);

        for (const id of ids) {
          const [revisionKeys, testCaseKeys] = await Promise.all([
            revisionStore.index('promptId').getAllKeys(id),
            testCaseStore.index('promptId').getAllKeys(id),
          ]);

          await Promise.all([
            ...revisionKeys.map((key) => revisionStore.delete(key)),
            ...testCaseKeys.map((key) => testCaseStore.delete(key)),
            promptStore.delete(id),
          ]);
        }

        await transaction.done;
      }),
  };
}

async function createRevisionRepository(db: Database) {
  return {
    listByPrompt: (promptId: string) =>
      withStorageErrors('revisions.listByPrompt', async () => {
        const rows = await db.getAllFromIndex(STORE.revisions, 'promptId', promptId);
        rows.forEach(assertStoredRevision);
        return sortRevisions(rows);
      }),

    get: (id: string) =>
      withStorageErrors('revisions.get', async () => {
        const row = await db.get(STORE.revisions, id);
        return row ? assertStoredRevision(row) : null;
      }),

    create: (revision: PromptRevision) =>
      withStorageErrors('revisions.create', async () => {
        assertStoredRevision(revision);
        // The unique compound index rejects duplicate revision numbers.
        await db.add(STORE.revisions, revision);
        return revision;
      }),

    deleteMany: (ids: readonly string[]) =>
      withStorageErrors('revisions.deleteMany', async () => {
        if (ids.length === 0) return;
        // One transaction: a prune either removes the whole planned set or none
        // of it, so the count the dialog reported is the count that happened.
        const transaction = db.transaction(STORE.revisions, 'readwrite');
        await Promise.all(ids.map((id) => transaction.store.delete(id)));
        await transaction.done;
      }),

    deleteByPrompt: (promptId: string) =>
      withStorageErrors('revisions.deleteByPrompt', async () => {
        const transaction = db.transaction(STORE.revisions, 'readwrite');
        const keys = await transaction.store.index('promptId').getAllKeys(promptId);
        await Promise.all(keys.map((key) => transaction.store.delete(key)));
        await transaction.done;
      }),

    countByPrompt: (promptId: string) =>
      withStorageErrors('revisions.countByPrompt', async () => {
        return db.countFromIndex(STORE.revisions, 'promptId', promptId);
      }),
  };
}

async function createActivityRepository(db: Database) {
  return {
    append: (event: ActivityEvent) =>
      withStorageErrors('activity.append', async () => {
        assertStoredEntity(event, 'activity');
        await db.add(STORE.activity, event);
      }),

    list: (limit?: number) =>
      withStorageErrors('activity.list', async () => {
        const rows = await db.getAll(STORE.activity);
        rows.forEach((row) => assertStoredEntity(row, 'activity'));
        const sorted = sortActivity(rows);
        return limit === undefined ? sorted : sorted.slice(0, Math.max(0, limit));
      }),

    prune: (limit: number) =>
      withStorageErrors('activity.prune', async () => {
        const rows = await db.getAll(STORE.activity);
        const doomed = sortActivity(rows).slice(Math.max(0, limit));

        if (doomed.length === 0) return 0;

        const transaction = db.transaction(STORE.activity, 'readwrite');
        await Promise.all(doomed.map((event) => transaction.store.delete(event.id)));
        await transaction.done;
        return doomed.length;
      }),

    clear: () =>
      withStorageErrors('activity.clear', async () => {
        await db.clear(STORE.activity);
      }),
  };
}

async function createSettingsRepository(db: Database) {
  return {
    get: () =>
      withStorageErrors('settings.get', async () => {
        const row = await db.get(STORE.settings, SINGLETON_KEY);
        if (!row) return null;
        const { key: _key, ...settings } = row;
        return settings;
      }),

    save: (settings: Settings) =>
      withStorageErrors('settings.save', async () => {
        const row: SettingsRow = { ...settings, key: SINGLETON_KEY };
        await db.put(STORE.settings, row);
        return settings;
      }),
  };
}

async function createMetaRepository(db: Database) {
  const read = async (): Promise<MetaRow | undefined> => db.get(STORE.meta, SINGLETON_KEY);

  return {
    get: async (): Promise<DatabaseMeta | null> => {
      const row = await withStorageErrors('meta.get', read);
      return row ? { dbSchemaVersion: row.dbSchemaVersion, seedVersion: row.seedVersion } : null;
    },

    getSeedVersion: async (): Promise<number> => {
      const row = await withStorageErrors('meta.getSeedVersion', read);
      return row?.seedVersion ?? 0;
    },

    setSeedVersion: (version: number) =>
      withStorageErrors('meta.setSeedVersion', async () => {
        if (!Number.isInteger(version) || version < 0) {
          throw new InvalidWriteError(
            `Seed version must be a non-negative integer, got ${version}.`,
          );
        }
        const transaction = db.transaction(STORE.meta, 'readwrite');
        const existing = await transaction.store.get(SINGLETON_KEY);
        const row: MetaRow = {
          key: SINGLETON_KEY,
          dbSchemaVersion: existing?.dbSchemaVersion ?? DB_SCHEMA_VERSION,
          seedVersion: version,
        };
        await transaction.store.put(row);
        await transaction.done;
      }),
  };
}

async function createTemplateRepository(db: Database) {
  const read = (rows: readonly TemplateRow[]): PromptTemplate[] =>
    sortByName(
      rows.map((row) => {
        assertStoredEntity(row, 'templates');
        return fromTemplateRow(row);
      }),
      (template) => template.name,
    );

  return {
    list: () =>
      withStorageErrors('templates.list', async () => {
        return read(await db.getAll(STORE.templates));
      }),

    get: (id: string) =>
      withStorageErrors('templates.get', async () => {
        const row = await db.get(STORE.templates, id);
        return row ? fromTemplateRow(row) : null;
      }),

    create: (template: PromptTemplate) =>
      withStorageErrors('templates.create', async () => {
        assertStoredEntity(template, 'templates');
        await db.add(STORE.templates, toTemplateRow(template));
        return template;
      }),

    update: (template: PromptTemplate) =>
      withStorageErrors('templates.update', async () => {
        assertStoredEntity(template, 'templates');
        const existing = await db.get(STORE.templates, template.id);
        if (!existing) {
          throw new RecordNotFoundError(`No template with id "${template.id}".`);
        }
        await db.put(STORE.templates, toTemplateRow(template));
        return template;
      }),

    delete: (id: string) =>
      withStorageErrors('templates.delete', async () => {
        await db.delete(STORE.templates, id);
      }),
  };
}

export interface IndexedDbRepositoryOptions extends OpenDatabaseOptions {
  /** Reuse an already-open connection (tests, recovery screen). */
  readonly connection?: PromptForgeDatabase;
}

/**
 * Opens the database (unless a connection is supplied) and returns repositories
 * bound to it. `close` releases the connection; calling it twice is safe.
 */
export async function createIndexedDbRepositories(
  options: IndexedDbRepositoryOptions = {},
): Promise<Repositories> {
  const connection = options.connection ?? (await openPromptForgeDatabase(options));
  const db = connection.db;

  let closed = false;

  const repositories: Repositories = {
    prompts: await createPromptRepository(db),
    revisions: await createRevisionRepository(db),
    folders: createEntityRepository<Folder>(db, 'folders', (items) =>
      sortByName(items, (folder) => folder.name),
    ),
    collections: createEntityRepository<Collection>(db, 'collections', (items) =>
      sortByName(items, (collection) => collection.name),
    ),
    templates: await createTemplateRepository(db),
    testCases: createEntityRepository<TestCase>(db, 'testCases', (items) =>
      sortByName(items, (testCase) => testCase.name),
    ),
    schemas: createEntityRepository<PromptSchema>(db, 'schemas', (items) =>
      sortByName(items, (schema) => schema.name),
    ),
    snippets: createEntityRepository<Snippet>(db, 'snippets', (items) =>
      sortByName(items, (snippet) => snippet.name),
    ),
    activity: await createActivityRepository(db),
    settings: await createSettingsRepository(db),
    meta: await createMetaRepository(db),
    close: async () => {
      if (closed) return;
      closed = true;
      if (!options.connection) connection.close();
    },
  };

  return repositories;
}

/** Sorted activity is also needed by TASK-025; re-exported for convenience. */
export { sortActivity };
