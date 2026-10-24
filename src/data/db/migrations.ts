/**
 * Ordered, idempotent schema migrations (TASK-006).
 *
 * IndexedDB only lets a schema change inside a `versionchange` transaction, so
 * the runner is written to execute inside `openDB({ upgrade })`. That
 * transaction is the atomic unit: if any step throws, the browser rolls the
 * whole upgrade back and the database stays at its previous version.
 *
 * Each step re-checks what already exists. That keeps a partially applied
 * upgrade recoverable and makes re-running a step a no-op.
 */

import { unwrap, type IDBPDatabase, type IDBPTransaction } from 'idb';

import { MigrationError } from '@/data/db/errors';
import {
  DB_SCHEMA_VERSION,
  KEY_PATHS,
  STORE,
  V1_STORES,
  V2_INDEXES,
  type IndexDefinition,
  type PromptForgeDB,
  type StoreName,
} from '@/data/db/schema';

export interface MigrationContext {
  readonly database: IDBPDatabase<PromptForgeDB>;
  readonly transaction: IDBPTransaction<PromptForgeDB, StoreName[], 'versionchange'>;
  readonly fromVersion: number;
  readonly toVersion: number;
}

export interface Migration {
  /** Target version; migrations are applied in ascending order. */
  readonly version: number;
  readonly description: string;
  readonly apply: (context: MigrationContext) => void;
}

function ensureStore(
  context: MigrationContext,
  name: StoreName,
  indexes: readonly IndexDefinition[],
): void {
  const { database, transaction } = context;

  if (!database.objectStoreNames.contains(name)) {
    database.createObjectStore(name, { keyPath: KEY_PATHS[name] });
  }

  // The raw object store is used for index creation: `idb` narrows index names
  // to the literal set of one store, which does not survive a union of stores.
  const store = unwrap(transaction.objectStore(name));
  for (const index of indexes) {
    if (store.indexNames.contains(index.name)) continue;
    const keyPath = Array.isArray(index.keyPath) ? [...index.keyPath] : index.keyPath;
    store.createIndex(index.name, keyPath, index.unique ? { unique: true } : undefined);
  }
}

/** v1 — the layout from `tasks.md` §6.3. */
const migration1: Migration = {
  version: 1,
  description: 'Create the eleven object stores and their v1 indexes',
  apply: (context) => {
    for (const store of V1_STORES) {
      ensureStore(context, store.name, store.indexes);
    }
  },
};

/** v2 — the status index used by library filters (TASK-011). */
const migration2: Migration = {
  version: 2,
  description: 'Add the prompts.status index',
  apply: (context) => {
    for (const { store, index } of V2_INDEXES) {
      ensureStore(context, store, [index]);
    }
  },
};

/** All migrations, in ascending version order. */
export const MIGRATIONS: readonly Migration[] = [migration1, migration2];

/**
 * Validates that the migration list is strictly ascending, unique, and starts
 * at version 1 with no gaps.
 */
export function validateMigrations(migrations: readonly Migration[]): void {
  let expectedVersion = 1;

  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version !== expectedVersion) {
      throw new MigrationError(
        'failed',
        `Migration list is invalid: expected version ${expectedVersion}, found ${migration.version}.`,
      );
    }
    expectedVersion += 1;
  }

  if (migrations.length === 0) {
    throw new MigrationError('failed', 'Migration list is empty.');
  }
}

/** Migrations that still need to run for `fromVersion → toVersion`. */
export function pendingMigrations(
  migrations: readonly Migration[],
  fromVersion: number,
  toVersion: number,
): Migration[] {
  return migrations
    .filter((migration) => migration.version > fromVersion && migration.version <= toVersion)
    .sort((left, right) => left.version - right.version);
}

export interface ApplyMigrationsOptions {
  readonly fromVersion: number;
  readonly toVersion?: number;
  readonly migrations?: readonly Migration[];
}

/**
 * Applies every pending migration inside the current upgrade transaction.
 *
 * Returns the descriptions of the migrations that ran, which the caller logs or
 * surfaces in the recovery screen. Throws `MigrationError` on any failure; the
 * caller must let the transaction abort.
 */
export function applyMigrations(
  context: Omit<MigrationContext, 'fromVersion' | 'toVersion'>,
  options: ApplyMigrationsOptions,
): string[] {
  const migrations = options.migrations ?? MIGRATIONS;
  const toVersion = options.toVersion ?? DB_SCHEMA_VERSION;

  validateMigrations(migrations);

  if (toVersion > (migrations.at(-1)?.version ?? 0)) {
    throw new MigrationError(
      'failed',
      `Database version ${toVersion} is newer than the highest migration (${migrations.at(-1)?.version ?? 0}).`,
    );
  }

  const pending = pendingMigrations(migrations, options.fromVersion, toVersion);
  const applied: string[] = [];

  for (const migration of pending) {
    try {
      migration.apply({
        ...context,
        fromVersion: options.fromVersion,
        toVersion,
      });
      applied.push(`v${migration.version}: ${migration.description}`);
    } catch (error) {
      throw new MigrationError(
        'failed',
        `Migration v${migration.version} (${migration.description}) failed; the database was left unchanged.`,
        { cause: error },
      );
    }
  }

  // Defensive check: after every step the layout must match the target version.
  const missing = missingStores(context.database);
  if (missing.length > 0) {
    throw new MigrationError(
      'failed',
      `Migration finished but these object stores are missing: ${missing.join(', ')}.`,
    );
  }

  return applied;
}

/** Object stores this build expects but the database does not have. */
export function missingStores(database: IDBPDatabase<PromptForgeDB>): string[] {
  return [
    STORE.prompts,
    STORE.revisions,
    STORE.folders,
    STORE.collections,
    STORE.templates,
    STORE.testCases,
    STORE.schemas,
    STORE.snippets,
    STORE.activity,
    STORE.settings,
    STORE.meta,
  ].filter((name) => !database.objectStoreNames.contains(name));
}
