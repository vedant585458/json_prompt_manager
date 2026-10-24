/**
 * Application bootstrap (TASK-007).
 *
 * One place, one order: open storage → attach repositories → seed exactly once
 * → hydrate the stores → adopt persisted preferences. Keeping this out of the
 * component makes the whole sequence testable without rendering React.
 */

import {
  openStorage as openStorageDefault,
  seedDatabase as seedDatabaseDefault,
  type Repositories,
  type SeedResult,
  type StorageBootResult,
  type StorageMode,
} from '@/data';
import { useDataStore, type DataStore } from '@/store/dataStore';
import { usePreferencesStore, type PreferencesStore } from '@/store/preferencesStore';

export interface BootOutcome {
  readonly mode: StorageMode;
  /** Why persistence is unavailable; `null` in durable mode. */
  readonly notice: string | null;
  readonly seed: SeedResult;
}

export interface BootDataOptions {
  readonly store?: DataStore;
  readonly preferences?: PreferencesStore;
  readonly openStorage?: () => Promise<StorageBootResult>;
  readonly seed?: (repositories: Repositories) => Promise<SeedResult>;
}

/**
 * Boots the data layer.
 *
 * Rejects only when seeding or hydration could not run at all (for example a
 * database that opened but failed on first write). The opened connection is
 * closed before rethrowing so a retry starts clean.
 */
export async function bootData(options: BootDataOptions = {}): Promise<BootOutcome> {
  const store = options.store ?? useDataStore;
  const preferences = options.preferences ?? usePreferencesStore;
  const openStorage = options.openStorage ?? (() => openStorageDefault());
  const seed = options.seed ?? ((repositories: Repositories) => seedDatabaseDefault(repositories));

  const storage = await openStorage();
  store.getState().attach(storage.repositories, storage.mode);

  try {
    const seedResult = await seed(storage.repositories);
    await store.getState().hydrate();

    const settings = store.getState().settings;
    if (settings) preferences.getState().applySettings(settings);

    return { mode: storage.mode, notice: storage.notice, seed: seedResult };
  } catch (error) {
    await storage.repositories.close().catch(() => undefined);
    throw error;
  }
}
