// `auto` installs the full IndexedDB API (IDBRequest, IDBKeyRange, ...),
// which jsdom does not provide; the factory itself is replaced per test.
import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { openDB, type DBSchema } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CorruptDataError, QuotaExceededError, StorageUnavailableError } from '@/data/db/errors';
import {
  deletePromptForgeDatabase,
  isIndexedDbAvailable,
  isNewerDatabaseError,
  openPromptForgeDatabase,
  probeStorage,
} from '@/data/db/indexedDb';
import { DB_NAME, DB_SCHEMA_VERSION, STORE, STORE_NAMES, expectedIndexes } from '@/data/db/schema';
import { createIndexedDbRepositories } from '@/data/repositories/indexedDb';
import { describeRepositoryContract } from '@/data/repositories/contract';
import { toPromptRow } from '@/data/repositories/shared';
import { createPrompt } from '@/domain/factories';

// A fresh factory per test isolates databases without cross-test cleanup.
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describeRepositoryContract(
  'indexeddb',
  async () =>
    await createIndexedDbRepositories({
      // A unique name per repositories instance keeps the contract hermetic.
      name: `${DB_NAME}-contract-${Math.random().toString(36).slice(2, 10)}`,
    }),
);

describe('IndexedDB schema', () => {
  it('creates every store and index from the specification', async () => {
    const connection = await openPromptForgeDatabase();
    const db = connection.db;

    expect([...db.objectStoreNames].sort()).toEqual([...STORE_NAMES].sort());

    const expected = expectedIndexes();
    for (const store of STORE_NAMES) {
      const transaction = db.transaction(store, 'readonly');
      const names = [...transaction.store.indexNames].sort();
      await transaction.done;
      expect(names, `indexes on ${store}`).toEqual([...expected[store]].sort());
    }

    expect(db.version).toBe(DB_SCHEMA_VERSION);
    connection.close();
  });

  it('marks the revision number index as unique', async () => {
    const connection = await openPromptForgeDatabase();
    const transaction = connection.db.transaction(STORE.revisions, 'readonly');
    const index = transaction.store.index('promptId_revisionNumber');

    expect(index.unique).toBe(true);
    expect(index.keyPath).toEqual(['promptId', 'revisionNumber']);
    await transaction.done;
    connection.close();
  });

  it('records the schema version in the meta store', async () => {
    const connection = await openPromptForgeDatabase();
    const meta = await connection.db.get(STORE.meta, 'app');

    expect(meta).toEqual({
      key: 'app',
      dbSchemaVersion: DB_SCHEMA_VERSION,
      seedVersion: 0,
    });
    connection.close();
  });

  it('maps boolean flags to indexable numeric mirrors', async () => {
    const repos = await createIndexedDbRepositories();
    const prompt = createPrompt(
      { title: 'Archived prompt', archived: true, favorite: true },
      { now: () => new Date('2026-01-01T00:00:00.000Z'), newId: () => 'flag-1' },
    );
    await repos.prompts.create(prompt);

    await expect(repos.prompts.query({ archived: true })).resolves.toHaveLength(1);
    await expect(repos.prompts.query({ favorite: true })).resolves.toHaveLength(1);
    await expect(repos.prompts.query({ pinned: true })).resolves.toHaveLength(0);

    await repos.close();
  });
});

/** Just enough of a schema to create a deliberately incomplete database. */
interface PartialSchema extends DBSchema {
  prompts: { key: string; value: { id: string } };
}

describe('IndexedDB failure handling', () => {
  it('refuses to open a database created by a newer build', async () => {
    const connection = await openPromptForgeDatabase();
    connection.close();

    const failure = await openPromptForgeDatabase({ version: 1 }).catch((error: unknown) => error);
    // IndexedDB itself rejects the lower version; it must surface as typed.
    expect(isNewerDatabaseError(failure)).toBe(true);
  });

  it('turns a quota failure into a typed error with no unhandled rejection', async () => {
    const repos = await createIndexedDbRepositories({ name: 'promptforge-quota' });
    const prompt = createPrompt(
      { title: 'Too big' },
      { now: () => new Date(0), newId: () => 'big' },
    );

    // The browser raises this when the origin runs out of space; emulate it at
    // the same boundary (the object store's write call) so the mapping path is
    // exercised end to end rather than asserted in isolation.
    const quotaFailure = () => {
      throw new DOMException('Quota exceeded.', 'QuotaExceededError');
    };
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(quotaFailure);
    const add = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(quotaFailure);

    const failure = await repos.prompts.create(prompt).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(QuotaExceededError);
    expect((failure as QuotaExceededError).code).toBe('quota-exceeded');

    // Nothing was stored, and the repositories object stays usable afterwards.
    put.mockRestore();
    add.mockRestore();
    await expect(repos.prompts.get(prompt.id)).resolves.toBeNull();
    await repos.close();
  });

  it('stops with a typed error when IndexedDB disappears', async () => {
    vi.stubGlobal('indexedDB', undefined);

    const failure = await createIndexedDbRepositories().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(StorageUnavailableError);

    await expect(openPromptForgeDatabase()).rejects.toBeInstanceOf(StorageUnavailableError);
    await expect(probeStorage('promptforge-gone')).resolves.toMatchObject({ available: false });
  });

  it('detects a structurally incomplete database', async () => {
    const name = 'promptforge-incomplete';

    // A database at the current version but with only one store: nothing will
    // upgrade it, so the integrity check has to catch it.
    const raw = await openDB<PartialSchema>(name, DB_SCHEMA_VERSION, {
      upgrade(database) {
        database.createObjectStore(STORE.prompts, { keyPath: 'id' });
      },
    });
    raw.close();

    await expect(openPromptForgeDatabase({ name })).rejects.toBeInstanceOf(CorruptDataError);
  });

  it('reports corrupted records instead of returning them', async () => {
    const repos = await createIndexedDbRepositories();
    // Close the public surface and write a malformed row through the raw DB.
    const connection = await openPromptForgeDatabase();
    await connection.db.put(STORE.prompts, { id: 'bad', title: 42 } as never);

    await expect(repos.prompts.get('bad')).rejects.toBeInstanceOf(CorruptDataError);
    await expect(repos.prompts.list()).rejects.toBeInstanceOf(CorruptDataError);

    connection.close();
    await repos.close();
  });

  it('probes storage end to end and reports absence', async () => {
    await expect(probeStorage('promptforge-probe-test')).resolves.toEqual({ available: true });

    vi.stubGlobal('indexedDB', undefined);
    const unavailable = await probeStorage('promptforge-probe-missing');

    expect(unavailable.available).toBe(false);
    if (unavailable.available) return;
    expect(unavailable.error).toBeInstanceOf(StorageUnavailableError);
    expect(isIndexedDbAvailable()).toBe(false);
  });
});

describe('IndexedDB lifecycle', () => {
  it('preserves data and the seed version across reopens', async () => {
    const name = 'promptforge-reopen';
    const first = await openPromptForgeDatabase({ name });
    const prompt = createPrompt(
      { title: 'Survivor' },
      { now: () => new Date('2026-01-01T00:00:00.000Z'), newId: () => 'survivor' },
    );
    await first.db.put(STORE.prompts, toPromptRow(prompt));
    await first.db.put(STORE.meta, { key: 'app', dbSchemaVersion: 1, seedVersion: 4 });
    first.close();

    const second = await openPromptForgeDatabase({ name });
    expect(second.appliedMigrations).toEqual([]);
    await expect(second.db.get(STORE.prompts, 'survivor')).resolves.toMatchObject({
      title: 'Survivor',
    });
    await expect(second.db.get(STORE.meta, 'app')).resolves.toEqual({
      key: 'app',
      dbSchemaVersion: DB_SCHEMA_VERSION,
      seedVersion: 4,
    });
    second.close();
  });

  it('deletes the database on request', async () => {
    const name = 'promptforge-delete';
    const connection = await openPromptForgeDatabase({ name });
    connection.close();

    await deletePromptForgeDatabase(name);

    // Reopening recreates it from scratch: both migrations run again.
    const recreated = await openPromptForgeDatabase({ name });
    expect(recreated.appliedMigrations).toHaveLength(2);
    recreated.close();
  });
});
