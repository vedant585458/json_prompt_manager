/**
 * Storage bootstrap (TASK-007).
 *
 * Chooses between the durable IndexedDB adapter and the in-memory adapter, and
 * keeps that choice inside the data layer so no component can depend on a
 * concrete adapter (ADR-39). Every outcome is honest: the returned `notice`
 * says exactly why persistence is unavailable, and `mode: 'ephemeral'` means
 * nothing written this session will survive a reload.
 */

import { createInMemoryRepositories } from '@/data/adapters/inMemory';
import { StorageError, StorageUnavailableError } from '@/data/db/errors';
import { probeStorage, type StorageProbeResult } from '@/data/db/indexedDb';
import { createIndexedDbRepositories } from '@/data/repositories/indexedDb';
import type { Repositories } from '@/data/repositories/contracts';

export type StorageMode = 'durable' | 'ephemeral';

export interface StorageBootResult {
  readonly mode: StorageMode;
  readonly repositories: Repositories;
  /**
   * Plain-language explanation for ephemeral mode, ready to render in the app
   * banner. `null` in durable mode.
   */
  readonly notice: string | null;
}

export interface OpenStorageOptions {
  /** Overrides the database name (tests, and the recovery flow). */
  readonly name?: string;
  /** Injected for tests; defaults to the real capability probe. */
  readonly probe?: () => Promise<StorageProbeResult>;
  readonly openDurable?: (name?: string) => Promise<Repositories>;
  readonly openEphemeral?: () => Promise<Repositories>;
}

const EPHEMERAL_CONSEQUENCE =
  'Changes you make now are kept in memory only and disappear when you reload; nothing is being saved.';

function describe(error: unknown): string {
  if (error instanceof StorageError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Unknown storage failure.';
}

/**
 * Opens the best available storage.
 *
 * Durable storage is tried first. If the capability probe fails, or the
 * database cannot be opened (corrupt layout, a newer build's database, a denied
 * origin), the app still boots — on the in-memory adapter, with a notice.
 * Only a failure of the in-memory adapter itself escapes, which would be a bug.
 */
export async function openStorage(options: OpenStorageOptions = {}): Promise<StorageBootResult> {
  const probe = options.probe ?? (() => probeStorage());
  const openDurable =
    options.openDurable ??
    ((name?: string) => createIndexedDbRepositories(name === undefined ? {} : { name }));
  const openEphemeral = options.openEphemeral ?? (() => createInMemoryRepositories());

  let availability: StorageProbeResult;
  try {
    availability = await probe();
  } catch (error) {
    availability = {
      available: false,
      error: new StorageUnavailableError('Storage could not be checked in this browser.', {
        cause: error,
      }),
    };
  }

  if (availability.available) {
    try {
      return { mode: 'durable', repositories: await openDurable(options.name), notice: null };
    } catch (error) {
      return {
        mode: 'ephemeral',
        repositories: await openEphemeral(),
        notice: `Durable storage could not be opened (${describe(error)}). ${EPHEMERAL_CONSEQUENCE}`,
      };
    }
  }

  return {
    mode: 'ephemeral',
    repositories: await openEphemeral(),
    notice: `IndexedDB is not available in this browser. ${EPHEMERAL_CONSEQUENCE}`,
  };
}
