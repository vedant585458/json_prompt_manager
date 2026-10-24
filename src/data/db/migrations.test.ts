import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MigrationError } from '@/data/db/errors';
import { isNewerDatabaseError, openPromptForgeDatabase } from '@/data/db/indexedDb';
import {
  MIGRATIONS,
  applyMigrations,
  pendingMigrations,
  validateMigrations,
  type Migration,
} from '@/data/db/migrations';
import { DB_SCHEMA_VERSION, STORE, expectedIndexes } from '@/data/db/schema';
import { toPromptRow } from '@/data/repositories/shared';
import { createPrompt } from '@/domain/factories';

const deps = { now: () => new Date('2026-10-24T09:41:07.123Z'), newId: () => 'id-1' };

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function indexNames(name: string, store: 'prompts'): Promise<string[]> {
  const connection = await openPromptForgeDatabase({ name });
  const transaction = connection.db.transaction(store, 'readonly');
  const names = [...transaction.store.indexNames].sort();
  await transaction.done;
  connection.close();
  return names;
}

describe('migration definitions', () => {
  it('exposes one migration per schema version, ascending from 1', () => {
    expect(validateMigrations(MIGRATIONS)).toBeUndefined();
    expect(MIGRATIONS.map((migration) => migration.version)).toEqual([1, 2]);
    expect(MIGRATIONS.at(-1)?.version).toBe(DB_SCHEMA_VERSION);
  });

  it('rejects empty, gapped, and out-of-order lists', () => {
    expect(() => validateMigrations([])).toThrow(MigrationError);

    const gap: Migration[] = [
      MIGRATIONS[0] as Migration,
      { ...(MIGRATIONS[1] as Migration), version: 3 },
    ];
    expect(() => validateMigrations(gap)).toThrow(/expected version 2/);

    const unordered: Migration[] = [MIGRATIONS[1] as Migration, MIGRATIONS[0] as Migration];
    expect(() => validateMigrations(unordered)).toThrow(MigrationError);
  });

  it('selects only the migrations still to run', () => {
    expect(pendingMigrations(MIGRATIONS, 0, 2).map((migration) => migration.version)).toEqual([
      1, 2,
    ]);
    expect(pendingMigrations(MIGRATIONS, 1, 2).map((migration) => migration.version)).toEqual([2]);
    expect(pendingMigrations(MIGRATIONS, 2, 2)).toEqual([]);
  });

  it('refuses a target version beyond the highest migration', async () => {
    await expect(
      openPromptForgeDatabase({ name: 'promptforge-beyond', version: 9, migrations: MIGRATIONS }),
    ).rejects.toBeInstanceOf(MigrationError);
  });
});

describe('migration chain', () => {
  it('runs v0 → v2 on a fresh database', async () => {
    const connection = await openPromptForgeDatabase({ name: 'promptforge-fresh' });

    expect(connection.version).toBe(DB_SCHEMA_VERSION);
    expect(connection.appliedMigrations).toEqual([
      `v1: ${MIGRATIONS[0]?.description}`,
      `v2: ${MIGRATIONS[1]?.description}`,
    ]);
    connection.close();

    expect(await indexNames('promptforge-fresh', STORE.prompts)).toEqual(
      [...expectedIndexes().prompts].sort(),
    );
  });

  it('is idempotent: reopening applies nothing and keeps working', async () => {
    const first = await openPromptForgeDatabase({ name: 'promptforge-idempotent' });
    first.close();

    const second = await openPromptForgeDatabase({ name: 'promptforge-idempotent' });
    expect(second.appliedMigrations).toEqual([]);
    expect(second.version).toBe(DB_SCHEMA_VERSION);
    second.close();

    const third = await openPromptForgeDatabase({ name: 'promptforge-idempotent' });
    expect(third.appliedMigrations).toEqual([]);
    third.close();
  });

  it('upgrades a v1 database to v2 without losing rows or the seed version', async () => {
    const name = 'promptforge-upgrade';
    const v1 = await openPromptForgeDatabase({
      name,
      version: 1,
      migrations: [MIGRATIONS[0] as Migration],
      skipIntegrityCheck: true,
    });

    const prompt = createPrompt({ title: 'Kept across upgrade' }, deps);
    await v1.db.put(STORE.prompts, toPromptRow(prompt));
    await v1.db.put(STORE.meta, { key: 'app', dbSchemaVersion: 1, seedVersion: 6 });
    expect([...v1.db.transaction(STORE.prompts, 'readonly').store.indexNames]).not.toContain(
      'status',
    );
    v1.close();

    const v2 = await openPromptForgeDatabase({ name });
    expect(v2.appliedMigrations).toEqual([`v2: ${MIGRATIONS[1]?.description}`]);

    const transaction = v2.db.transaction(STORE.prompts, 'readonly');
    expect([...transaction.store.indexNames]).toContain('status');
    await transaction.done;

    await expect(v2.db.get(STORE.prompts, prompt.id)).resolves.toMatchObject({
      title: 'Kept across upgrade',
    });
    await expect(v2.db.get(STORE.meta, 'app')).resolves.toEqual({
      key: 'app',
      dbSchemaVersion: DB_SCHEMA_VERSION,
      seedVersion: 6,
    });
    v2.close();
  });

  it('records the new schema version in meta without resetting the seed', async () => {
    const name = 'promptforge-meta';
    const first = await openPromptForgeDatabase({ name });
    await first.db.put(STORE.meta, { key: 'app', dbSchemaVersion: 1, seedVersion: 2 });
    first.close();

    const second = await openPromptForgeDatabase({ name });
    await expect(second.db.get(STORE.meta, 'app')).resolves.toMatchObject({
      dbSchemaVersion: DB_SCHEMA_VERSION,
      seedVersion: 2,
    });
    second.close();
  });

  it('aborts atomically when a migration fails', async () => {
    const name = 'promptforge-failing';
    const failing: Migration[] = [
      MIGRATIONS[0] as Migration,
      {
        version: 2,
        description: 'explode',
        apply: () => {
          throw new Error('boom');
        },
      },
    ];

    const failure = await openPromptForgeDatabase({ name, migrations: failing }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(MigrationError);
    expect((failure as MigrationError).reason).toBe('failed');

    // The aborted upgrade left nothing behind: a normal open creates v2 cleanly.
    const recovered = await openPromptForgeDatabase({ name });
    expect(recovered.appliedMigrations).toHaveLength(2);
    recovered.close();
  });

  it('refuses to open a database created by a newer build', async () => {
    const name = 'promptforge-newer';
    const current = await openPromptForgeDatabase({ name });
    current.close();

    const failure = await openPromptForgeDatabase({ name, version: 1 }).catch(
      (error: unknown) => error,
    );

    expect(isNewerDatabaseError(failure)).toBe(true);
    expect((failure as MigrationError).message).toMatch(/newer PromptForge build/);
  });

  it('reports incomplete schemas as migration failures', async () => {
    const incomplete: Migration[] = [
      {
        version: 1,
        description: 'partial',
        apply: ({ database }) => {
          if (!database.objectStoreNames.contains(STORE.prompts)) {
            database.createObjectStore(STORE.prompts, { keyPath: 'id' });
          }
        },
      },
      { version: 2, description: 'no-op', apply: () => undefined },
    ];

    await expect(
      openPromptForgeDatabase({ name: 'promptforge-partial', migrations: incomplete }),
    ).rejects.toBeInstanceOf(MigrationError);
  });
});

describe('applyMigrations guardrails', () => {
  it('requires the migration list to reach the target version', () => {
    expect(() =>
      applyMigrations(
        // The guard runs before any database work, so a stub context is enough.
        {
          database: { objectStoreNames: [] } as never,
          transaction: {} as never,
        },
        { fromVersion: 0, toVersion: 3, migrations: MIGRATIONS },
      ),
    ).toThrow(/newer than the highest migration/);
  });
});
