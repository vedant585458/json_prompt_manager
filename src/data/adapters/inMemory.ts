/**
 * In-memory repositories (TASK-006).
 *
 * Used by tests, by the ephemeral demo mode when IndexedDB is unavailable, and
 * by the parity contract suite. Records are cloned in and out so behaviour
 * matches a real database: callers cannot mutate stored state by holding a
 * reference.
 */

import {
  DuplicateRecordError,
  InvalidWriteError,
  RecordNotFoundError,
  StorageUnavailableError,
  StaleWriteError,
} from '@/data/db/errors';
import { DB_SCHEMA_VERSION } from '@/data/db/schema';
import type {
  DatabaseMeta,
  EntityRepository,
  PromptQuery,
  Repositories,
} from '@/data/repositories/contracts';
import {
  assertStoredEntity,
  assertStoredPrompt,
  assertStoredRevision,
  cloneRecord,
  matchesPromptQuery,
  sortActivity,
  sortByName,
  sortPrompts,
  sortRevisions,
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

export interface InMemorySeed {
  readonly prompts?: readonly Prompt[];
  readonly revisions?: readonly PromptRevision[];
  readonly folders?: readonly Folder[];
  readonly collections?: readonly Collection[];
  readonly templates?: readonly PromptTemplate[];
  readonly testCases?: readonly TestCase[];
  readonly schemas?: readonly PromptSchema[];
  readonly snippets?: readonly Snippet[];
  readonly activity?: readonly ActivityEvent[];
  readonly settings?: Settings | null;
  readonly meta?: DatabaseMeta;
}

/** A repository whose records only need a valid `id` at write time. */
function createEntityRepository<T extends { id: string }>(
  store: string,
  sort: (items: T[]) => T[],
  initial: readonly T[] = [],
): EntityRepository<T> {
  const rows = new Map<string, T>(initial.map((item) => [item.id, cloneRecord(item)]));

  return {
    list: async () => sort([...rows.values()].map(cloneRecord)),

    get: async (id) => {
      const found = rows.get(id);
      return found ? cloneRecord(found) : null;
    },

    create: async (entity) => {
      assertStoredEntity(entity, store);
      if (rows.has(entity.id)) {
        throw new DuplicateRecordError(
          `A record with id "${entity.id}" already exists in "${store}".`,
        );
      }
      rows.set(entity.id, cloneRecord(entity));
      return cloneRecord(entity);
    },

    update: async (entity) => {
      assertStoredEntity(entity, store);
      if (!rows.has(entity.id)) {
        throw new RecordNotFoundError(`No record with id "${entity.id}" in "${store}".`);
      }
      rows.set(entity.id, cloneRecord(entity));
      return cloneRecord(entity);
    },

    delete: async (id) => {
      rows.delete(id);
    },
  };
}

export function createInMemoryRepositories(seed: InMemorySeed = {}): Repositories {
  const promptRows = new Map<string, Prompt>(
    (seed.prompts ?? []).map((prompt) => [prompt.id, cloneRecord(prompt)]),
  );
  const revisionRows = new Map<string, PromptRevision>(
    (seed.revisions ?? []).map((revision) => [revision.id, cloneRecord(revision)]),
  );
  const activityRows = new Map<string, ActivityEvent>(
    (seed.activity ?? []).map((event) => [event.id, cloneRecord(event)]),
  );

  let settings: Settings | null = seed.settings ? cloneRecord(seed.settings) : null;
  let meta: DatabaseMeta = seed.meta
    ? { ...seed.meta }
    : { dbSchemaVersion: DB_SCHEMA_VERSION, seedVersion: 0 };

  const testCasesRepository = createEntityRepository<TestCase>(
    'testCases',
    (items) => sortByName(items, (t) => t.name),
    seed.testCases,
  );

  /** Removes each prompt with its dependents; callers validate first. */
  async function deleteCascade(ids: readonly string[]): Promise<void> {
    const testCases = await testCasesRepository.list();

    for (const id of ids) {
      for (const testCase of testCases) {
        if (testCase.promptId === id) await testCasesRepository.delete(testCase.id);
      }
      for (const [revisionId, revision] of revisionRows) {
        if (revision.promptId === id) revisionRows.delete(revisionId);
      }
      promptRows.delete(id);
    }
  }

  let closed = false;
  const assertOpen = (): void => {
    if (closed) {
      throw new StorageUnavailableError('These repositories were closed.');
    }
  };

  return {
    prompts: {
      list: async () => {
        assertOpen();
        return sortPrompts([...promptRows.values()].map(cloneRecord));
      },

      query: async (criteria: PromptQuery = {}) => {
        assertOpen();
        const matches = [...promptRows.values()].filter((prompt) =>
          matchesPromptQuery(prompt, criteria),
        );
        return sortPrompts(matches.map(cloneRecord));
      },

      get: async (id) => {
        assertOpen();
        const found = promptRows.get(id);
        return found ? cloneRecord(found) : null;
      },

      create: async (prompt) => {
        assertOpen();
        assertStoredPrompt(prompt);
        if (promptRows.has(prompt.id)) {
          throw new DuplicateRecordError(`A prompt with id "${prompt.id}" already exists.`);
        }
        promptRows.set(prompt.id, cloneRecord(prompt));
        return cloneRecord(prompt);
      },

      update: async (prompt, options) => {
        assertOpen();
        assertStoredPrompt(prompt);
        const stored = promptRows.get(prompt.id);
        if (!stored) {
          throw new RecordNotFoundError(`No prompt with id "${prompt.id}".`);
        }
        if (stored.version !== options.expectedVersion) {
          throw new StaleWriteError(prompt.id, options.expectedVersion, stored.version);
        }
        if (prompt.version !== options.expectedVersion + 1) {
          throw new InvalidWriteError(
            `Prompt ${prompt.id} must be saved with version ${options.expectedVersion + 1}, received ${prompt.version}.`,
          );
        }
        promptRows.set(prompt.id, cloneRecord(prompt));
        return cloneRecord(prompt);
      },

      updateMany: async (writes) => {
        assertOpen();

        // Validate every write before touching the map, which is what the
        // IndexedDB adapter gets from aborting its transaction.
        for (const write of writes) {
          assertStoredPrompt(write.prompt);
          const stored = promptRows.get(write.prompt.id);
          if (!stored) {
            throw new RecordNotFoundError(`No prompt with id "${write.prompt.id}".`);
          }
          if (stored.version !== write.expectedVersion) {
            throw new StaleWriteError(write.prompt.id, write.expectedVersion, stored.version);
          }
          if (write.prompt.version !== write.expectedVersion + 1) {
            throw new InvalidWriteError(
              `Prompt ${write.prompt.id} must be saved with version ${write.expectedVersion + 1}, received ${write.prompt.version}.`,
            );
          }
        }

        for (const write of writes) promptRows.set(write.prompt.id, cloneRecord(write.prompt));
        return writes.map((write) => cloneRecord(write.prompt));
      },

      delete: async (id) => {
        assertOpen();
        promptRows.delete(id);
      },

      deleteCascade: async (id) => {
        assertOpen();
        await deleteCascade([id]);
      },

      deleteManyCascade: async (ids) => {
        assertOpen();
        await deleteCascade(ids);
      },
    },

    revisions: {
      listByPrompt: async (promptId) => {
        assertOpen();
        const matches = [...revisionRows.values()].filter(
          (revision) => revision.promptId === promptId,
        );
        return sortRevisions(matches.map(cloneRecord));
      },

      get: async (id) => {
        assertOpen();
        const found = revisionRows.get(id);
        return found ? cloneRecord(found) : null;
      },

      create: async (revision) => {
        assertOpen();
        assertStoredRevision(revision);
        if (revisionRows.has(revision.id)) {
          throw new DuplicateRecordError(`A revision with id "${revision.id}" already exists.`);
        }
        const clash = [...revisionRows.values()].some(
          (existing) =>
            existing.promptId === revision.promptId &&
            existing.revisionNumber === revision.revisionNumber,
        );
        if (clash) {
          throw new DuplicateRecordError(
            `Prompt ${revision.promptId} already has revision ${revision.revisionNumber}.`,
          );
        }
        revisionRows.set(revision.id, cloneRecord(revision));
        return cloneRecord(revision);
      },

      deleteMany: async (ids) => {
        assertOpen();
        for (const id of ids) revisionRows.delete(id);
      },

      deleteByPrompt: async (promptId) => {
        assertOpen();
        for (const [id, revision] of revisionRows) {
          if (revision.promptId === promptId) revisionRows.delete(id);
        }
      },

      countByPrompt: async (promptId) => {
        assertOpen();
        return [...revisionRows.values()].filter((revision) => revision.promptId === promptId)
          .length;
      },
    },

    folders: createEntityRepository<Folder>(
      'folders',
      (items) => sortByName(items, (f) => f.name),
      seed.folders,
    ),

    collections: createEntityRepository<Collection>(
      'collections',
      (items) => sortByName(items, (c) => c.name),
      seed.collections,
    ),

    templates: createEntityRepository<PromptTemplate>(
      'templates',
      (items) => sortByName(items, (t) => t.name),
      seed.templates,
    ),

    testCases: testCasesRepository,

    schemas: createEntityRepository<PromptSchema>(
      'schemas',
      (items) => sortByName(items, (s) => s.name),
      seed.schemas,
    ),

    snippets: createEntityRepository<Snippet>(
      'snippets',
      (items) => sortByName(items, (s) => s.name),
      seed.snippets,
    ),

    activity: {
      append: async (event) => {
        assertOpen();
        assertStoredEntity(event, 'activity');
        if (activityRows.has(event.id)) {
          throw new DuplicateRecordError(`Activity event "${event.id}" already exists.`);
        }
        activityRows.set(event.id, cloneRecord(event));
      },

      list: async (limit) => {
        assertOpen();
        const sorted = sortActivity([...activityRows.values()]);
        return (limit === undefined ? sorted : sorted.slice(0, Math.max(0, limit))).map(
          cloneRecord,
        );
      },

      prune: async (limit) => {
        assertOpen();
        const sorted = sortActivity([...activityRows.values()]);
        const doomed = sorted.slice(Math.max(0, limit));
        for (const event of doomed) activityRows.delete(event.id);
        return doomed.length;
      },

      clear: async () => {
        assertOpen();
        activityRows.clear();
      },
    },

    settings: {
      get: async () => {
        assertOpen();
        return settings ? cloneRecord(settings) : null;
      },

      save: async (next) => {
        assertOpen();
        settings = cloneRecord(next);
        return cloneRecord(next);
      },
    },

    meta: {
      get: async () => {
        assertOpen();
        return { ...meta };
      },

      getSeedVersion: async () => {
        assertOpen();
        return meta.seedVersion;
      },

      setSeedVersion: async (version) => {
        assertOpen();
        if (!Number.isInteger(version) || version < 0) {
          throw new InvalidWriteError(
            `Seed version must be a non-negative integer, got ${version}.`,
          );
        }
        meta = { dbSchemaVersion: meta.dbSchemaVersion, seedVersion: version };
      },
    },

    close: async () => {
      closed = true;
    },
  };
}
