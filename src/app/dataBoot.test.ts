import { describe, expect, it } from 'vitest';

import { bootData } from '@/app/dataBoot';
import {
  createInMemoryRepositories,
  type Repositories,
  type StorageBootResult,
  type StorageMode,
} from '@/data';
import { createDataStore } from '@/store/dataStore';
import { createPreferencesStore } from '@/store/preferencesStore';

function storageResult(
  repositories: Repositories,
  mode: StorageMode = 'durable',
  notice: string | null = null,
): () => Promise<StorageBootResult> {
  return async () => ({ repositories, mode, notice });
}

function createStores() {
  return {
    store: createDataStore(),
    preferences: createPreferencesStore({ themePreference: 'system', resolvedTheme: 'dark' }),
  };
}

describe('bootData', () => {
  it('opens storage, seeds, hydrates, and adopts persisted preferences', async () => {
    const repositories = await createInMemoryRepositories();
    const { store, preferences } = createStores();

    const outcome = await bootData({
      store,
      preferences,
      openStorage: storageResult(repositories),
    });

    expect(outcome.mode).toBe('durable');
    expect(outcome.notice).toBeNull();
    expect(outcome.seed.seeded).toBe(true);
    expect(outcome.seed.created.prompts).toBe(1);

    expect(store.getState().status).toBe('ready');
    expect(store.getState().mode).toBe('durable');
    expect(store.getState().prompts).toHaveLength(1);
    expect(store.getState().settings?.seedVersion).toBe(1);
    expect(store.getState().folders).toHaveLength(1);

    // The settings record wins over the pre-boot defaults.
    expect(preferences.getState().themePreference).toBe('system');
    expect(preferences.getState().density).toBe('comfortable');

    await repositories.close();
  });

  it('seeds exactly once across boots of the same database', async () => {
    const repositories = await createInMemoryRepositories();

    const first = createStores();
    await bootData({ ...first, openStorage: storageResult(repositories) });

    const second = createStores();
    const outcome = await bootData({ ...second, openStorage: storageResult(repositories) });

    expect(outcome.seed.seeded).toBe(false);
    expect(outcome.seed.previousVersion).toBe(1);
    expect(second.store.getState().prompts).toHaveLength(1);
    expect(second.store.getState().templates).toHaveLength(2);

    await repositories.close();
  });

  it('passes the ephemeral notice through to the caller', async () => {
    const repositories = await createInMemoryRepositories();
    const { store } = createStores();

    const outcome = await bootData({
      store,
      openStorage: storageResult(repositories, 'ephemeral', 'Changes are not saved.'),
    });

    expect(outcome.mode).toBe('ephemeral');
    expect(outcome.notice).toBe('Changes are not saved.');
    expect(store.getState().mode).toBe('ephemeral');

    await repositories.close();
  });

  it('closes the connection and rethrows when seeding fails', async () => {
    const repositories = await createInMemoryRepositories();
    const { store } = createStores();
    const failure = new Error('seed exploded');

    await expect(
      bootData({
        store,
        openStorage: storageResult(repositories),
        seed: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);

    // The connection was released, so a retry can open a clean one.
    await expect(repositories.settings.get()).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('reports a hydration failure on the store rather than rejecting the boot', async () => {
    const repositories = await createInMemoryRepositories();
    const { store } = createStores();
    await repositories.close();

    const outcome = await bootData({
      store,
      openStorage: storageResult(repositories),
      seed: async () => ({
        seeded: false,
        version: 1,
        previousVersion: 1,
        created: { folders: 0, collections: 0, prompts: 0, templates: 0 },
      }),
    });

    expect(outcome.mode).toBe('durable');
    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toMatch(/closed/i);
  });
});
