/**
 * IndexedDB connection management (TASK-006).
 *
 * Responsibilities:
 * - capability probe for IndexedDB availability (used by the ephemeral mode);
 * - opening `promptforge` at the current schema version, running migrations in
 *   the `versionchange` transaction, and refusing to touch a newer database;
 * - recording `dbSchemaVersion`/`seedVersion` in the `meta` store;
 * - verifying the opened schema actually matches what this build expects.
 */

import { deleteDB, openDB, unwrap, type IDBPDatabase } from 'idb';

import {
  CorruptDataError,
  MigrationError,
  StorageUnavailableError,
  mapStorageError,
  withStorageErrors,
} from '@/data/db/errors';
import { MIGRATIONS, applyMigrations, missingStores, type Migration } from '@/data/db/migrations';
import {
  DB_NAME,
  DB_SCHEMA_VERSION,
  PROBE_DB_NAME,
  SINGLETON_KEY,
  STORE,
  STORE_NAMES,
  expectedIndexes,
  type MetaRow,
  type PromptForgeDB,
  type StoreName,
} from '@/data/db/schema';

export interface OpenDatabaseOptions {
  readonly name?: string;
  readonly version?: number;
  /** Overridable for tests and for the recovery screen. */
  readonly migrations?: readonly Migration[];
  readonly onBlocked?: () => void;
  readonly onBlocking?: () => void;
  /** Skip the post-open integrity check (only for fixtures). */
  readonly skipIntegrityCheck?: boolean;
}

export interface PromptForgeDatabase {
  readonly name: string;
  readonly version: number;
  readonly db: IDBPDatabase<PromptForgeDB>;
  /** Descriptions of the migrations applied during this open, if any. */
  readonly appliedMigrations: readonly string[];
  close: () => void;
}

/** Synchronous environment check; does not touch storage. */
export function isIndexedDbAvailable(): boolean {
  return typeof globalThis.indexedDB !== 'undefined' && globalThis.indexedDB !== null;
}

function assertAvailable(): void {
  if (!isIndexedDbAvailable()) {
    throw new StorageUnavailableError(
      'IndexedDB is not available in this environment. PromptForge will run in ephemeral demo mode.',
    );
  }
}

/**
 * Reads the bookkeeping row and rewrites it with the schema version just
 * opened, preserving the seed version so upgrades never re-seed.
 */
async function writeMetaRow(db: IDBPDatabase<PromptForgeDB>, version: number): Promise<void> {
  const transaction = db.transaction(STORE.meta, 'readwrite');
  const existing = await transaction.store.get(SINGLETON_KEY);
  const row: MetaRow = {
    key: SINGLETON_KEY,
    dbSchemaVersion: version,
    seedVersion: existing?.seedVersion ?? 0,
  };
  await transaction.store.put(row);
  await transaction.done;
}

/**
 * Confirms every expected object store and index exists.
 *
 * A database can be structurally wrong (interrupted upgrade, external deletion)
 * without any operation failing yet; failing here produces one clear
 * `CorruptDataError` instead of scattered `NotFoundError`s later.
 */
export async function assertSchemaIntegrity(db: IDBPDatabase<PromptForgeDB>): Promise<void> {
  const missing = missingStores(db);
  if (missing.length > 0) {
    throw new CorruptDataError(
      `The PromptForge database is missing ${missing.length} object store${
        missing.length === 1 ? '' : 's'
      }: ${missing.join(', ')}.`,
    );
  }

  const expected = expectedIndexes();

  for (const store of STORE_NAMES) {
    const transaction = db.transaction(store, 'readonly');
    // Raw store: `idb` narrows index names per store, which a union cannot express.
    const raw = unwrap(transaction.store);
    const missingIndexes = expected[store].filter((name) => !raw.indexNames.contains(name));
    await transaction.done;

    if (missingIndexes.length > 0) {
      throw new CorruptDataError(
        `The "${store}" store is missing index${missingIndexes.length === 1 ? '' : 'es'}: ${missingIndexes.join(', ')}.`,
      );
    }
  }
}

/**
 * Opens (creating or upgrading) the PromptForge database.
 *
 * Failures are typed:
 * - `MigrationError('newer-database')` when the stored database is newer than
 *   this build — writes must stop rather than corrupt data;
 * - `MigrationError('failed')` when a migration throws (the versionchange
 *   transaction aborts, leaving the previous version intact);
 * - `StorageUnavailableError` when IndexedDB cannot be opened at all;
 * - `CorruptDataError` when the resulting schema is incomplete.
 */
export async function openPromptForgeDatabase(
  options: OpenDatabaseOptions = {},
): Promise<PromptForgeDatabase> {
  assertAvailable();

  const name = options.name ?? DB_NAME;
  const version = options.version ?? DB_SCHEMA_VERSION;
  const migrations = options.migrations ?? MIGRATIONS;
  let appliedMigrations: string[] = [];
  // The upgrade callback cannot reject the open request itself: throwing aborts
  // the versionchange transaction and idb reports a generic `AbortError`. The
  // original failure is kept so the caller sees `MigrationError`.
  let upgradeError: unknown;

  let db: IDBPDatabase<PromptForgeDB>;
  try {
    db = await openDB<PromptForgeDB>(name, version, {
      upgrade(database, oldVersion, newVersion, transaction) {
        // `idb` caches a `done` promise for the wrapped versionchange
        // transaction. When the upgrade aborts, that promise rejects and
        // nothing awaits it — the open request carries the failure instead —
        // which surfaces as an unhandled rejection. Mark it as handled; the
        // open rejection stays the single source of truth for callers.
        void transaction.done.catch(() => undefined);
        try {
          appliedMigrations = applyMigrations(
            { database, transaction },
            { fromVersion: oldVersion, toVersion: newVersion ?? version, migrations },
          );
        } catch (error) {
          upgradeError = error;
          throw error;
        }
      },
      blocked() {
        options.onBlocked?.();
      },
      blocking() {
        options.onBlocking?.();
        db?.close();
      },
      terminated() {
        options.onBlocked?.();
      },
    });
  } catch (error) {
    throw mapStorageError(upgradeError ?? error, `database.open(${name})`);
  }

  try {
    await withStorageErrors(`database.meta(${name})`, () => writeMetaRow(db, version));
    if (!options.skipIntegrityCheck) {
      await assertSchemaIntegrity(db);
    }
  } catch (error) {
    db.close();
    throw mapStorageError(error, `database.verify(${name})`);
  }

  return {
    name,
    version: db.version,
    db,
    appliedMigrations,
    close: () => db.close(),
  };
}

/** Deletes the database; used by tests, the reset flow, and repairs. */
export async function deletePromptForgeDatabase(name: string = DB_NAME): Promise<void> {
  assertAvailable();
  await withStorageErrors(`database.delete(${name})`, () => deleteDB(name));
}

/* -------------------------------------------------------------------------- */
/* Capability probe                                                          */
/* -------------------------------------------------------------------------- */

export type StorageProbeResult =
  | { readonly available: true }
  | { readonly available: false; readonly error: StorageUnavailableError };

interface ProbeDB {
  probe: { key: string; value: { id: string; at: number } };
}

/**
 * Proves that storage works end to end: open, write, read, delete.
 *
 * Used before the app decides between durable and ephemeral mode (TASK-007).
 * Never throws — the result tells the caller what to do.
 */
export async function probeStorage(name: string = PROBE_DB_NAME): Promise<StorageProbeResult> {
  if (!isIndexedDbAvailable()) {
    return {
      available: false,
      error: new StorageUnavailableError('IndexedDB is not available in this browser.'),
    };
  }

  try {
    const db = await openDB<ProbeDB>(name, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('probe')) {
          database.createObjectStore('probe', { keyPath: 'id' });
        }
      },
    });

    await db.put('probe', { id: 'probe', at: Date.now() });
    const written = await db.get('probe', 'probe');
    db.close();

    if (!written) {
      throw new CorruptDataError('Storage accepted a write but returned nothing when read back.');
    }

    await deleteDB(name);
    return { available: true };
  } catch (error) {
    const mapped = mapStorageError(error, 'storage.probe');
    return {
      available: false,
      error:
        mapped instanceof StorageUnavailableError
          ? mapped
          : new StorageUnavailableError(mapped.message, { cause: error }),
    };
  }
}

/** Raised for callers that only care whether they may start writing. */
export async function assertStorageAvailable(): Promise<void> {
  const result = await probeStorage();
  if (!result.available) throw result.error;
}

/** Store names, for diagnostics and for the recovery screen's explanation. */
export function storeNames(): readonly StoreName[] {
  return STORE_NAMES;
}

/**
 * True when the stored database is newer than this build.
 *
 * The open call already fails with `MigrationError('newer-database')`; this
 * helper exists so the recovery screen can classify an existing error without
 * string matching.
 */
export function isNewerDatabaseError(error: unknown): error is MigrationError {
  return error instanceof MigrationError && error.reason === 'newer-database';
}
