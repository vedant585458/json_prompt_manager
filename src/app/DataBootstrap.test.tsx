import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { bootData, type BootOutcome } from '@/app/dataBoot';
import { DataBootstrap } from '@/app/DataBootstrap';
import {
  createInMemoryRepositories,
  type Repositories,
  type StorageBootResult,
  type StorageMode,
} from '@/data';
import { createDataStore, type DataStore } from '@/store/dataStore';
import { createPreferencesStore } from '@/store/preferencesStore';
import { useStorageRecovery } from '@/store/storageRecoveryContext';

function storageResult(
  repositories: Repositories,
  mode: StorageMode = 'durable',
  notice: string | null = null,
): () => Promise<StorageBootResult> {
  return async () => ({ repositories, mode, notice });
}

function bootWith(
  repositories: Repositories,
  mode: StorageMode = 'durable',
  notice: string | null = null,
) {
  const preferences = createPreferencesStore({ themePreference: 'system', resolvedTheme: 'dark' });
  return (store: DataStore): Promise<BootOutcome> =>
    bootData({ store, preferences, openStorage: storageResult(repositories, mode, notice) });
}

describe('DataBootstrap', () => {
  it('shows an honest loading state while booting', () => {
    const store = createDataStore();

    render(
      <DataBootstrap store={store} boot={() => new Promise<BootOutcome>(() => undefined)}>
        <p>Library content</p>
      </DataBootstrap>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Opening your library');
    expect(screen.getByText(/Nothing leaves this device/)).toBeInTheDocument();
    expect(screen.queryByText('Library content')).not.toBeInTheDocument();
  });

  it('renders children once durable storage is ready, with no banner', async () => {
    const repositories = await createInMemoryRepositories();
    const store = createDataStore();

    render(
      <DataBootstrap store={store} boot={bootWith(repositories)}>
        <p>Library content</p>
      </DataBootstrap>,
    );

    expect(await screen.findByText('Library content')).toBeInTheDocument();
    expect(store.getState().status).toBe('ready');
    expect(store.getState().prompts).toHaveLength(1);
    expect(screen.queryByText(/Ephemeral mode/)).not.toBeInTheDocument();

    await repositories.close();
  });

  it('labels ephemeral mode and says changes are not saved', async () => {
    const repositories = await createInMemoryRepositories();
    const store = createDataStore();
    const notice =
      'IndexedDB is not available in this browser. Changes you make now are kept in memory only and disappear when you reload; nothing is being saved.';

    render(
      <DataBootstrap store={store} boot={bootWith(repositories, 'ephemeral', notice)}>
        <p>Library content</p>
      </DataBootstrap>,
    );

    expect(await screen.findByText('Library content')).toBeInTheDocument();
    expect(screen.getByText('Ephemeral mode — changes are not saved')).toBeInTheDocument();
    expect(screen.getByText(/disappear when you reload/)).toBeInTheDocument();
    expect(store.getState().mode).toBe('ephemeral');

    await repositories.close();
  });

  it('shows a recovery screen when the boot itself fails, and retries', async () => {
    const user = userEvent.setup();
    const store = createDataStore();
    const repositories = await createInMemoryRepositories();
    const success = bootWith(repositories);
    const boot = vi
      .fn<(target: DataStore) => Promise<BootOutcome>>()
      .mockRejectedValueOnce(new Error('IndexedDB was blocked'))
      .mockImplementation(success);

    render(
      <DataBootstrap store={store} boot={boot}>
        <p>Library content</p>
      </DataBootstrap>,
    );

    expect(await screen.findByText('PromptForge could not open your library')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/nothing was read or written/i)).toBeInTheDocument();
    expect(screen.getByText(/IndexedDB was blocked/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Library content')).toBeInTheDocument();
    expect(boot).toHaveBeenCalledTimes(2);

    await repositories.close();
  });

  it('shows a load failure when hydration fails after the database opened', async () => {
    const repositories = await createInMemoryRepositories();
    const store = createDataStore();
    await repositories.close();

    render(
      <DataBootstrap
        store={store}
        // Seeding is stubbed so the failure under test is hydration itself.
        boot={(target) =>
          bootData({
            store: target,
            openStorage: storageResult(repositories),
            seed: async () => ({
              seeded: false,
              version: 1,
              previousVersion: 1,
              created: { folders: 0, collections: 0, prompts: 0, templates: 0 },
            }),
          })
        }
      >
        <p>Library content</p>
      </DataBootstrap>,
    );

    expect(await screen.findByText('Your library could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Library content')).not.toBeInTheDocument();

    // Retrying hydration (not the whole boot) is the offered action.
    await waitFor(() => expect(store.getState().status).toBe('error'));
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

/** Renders what the save bar would see, so the published recovery is observable. */
function RecoveryProbe() {
  const recovery = useStorageRecovery();
  return <p>{recovery ? `recovery:${String(recovery.canRetry)}` : 'recovery:none'}</p>;
}

describe('DataBootstrap — storage recovery for the save bar', () => {
  it('publishes a re-open action in ephemeral mode', async () => {
    const repositories = await createInMemoryRepositories();
    const store = createDataStore();

    render(
      <DataBootstrap store={store} boot={bootWith(repositories, 'ephemeral', 'No storage.')}>
        <RecoveryProbe />
      </DataBootstrap>,
    );

    expect(await screen.findByText('recovery:true')).toBeInTheDocument();
  });

  it('publishes nothing in durable mode', async () => {
    const repositories = await createInMemoryRepositories();
    const store = createDataStore();

    render(
      <DataBootstrap store={store} boot={bootWith(repositories)}>
        <RecoveryProbe />
      </DataBootstrap>,
    );

    expect(await screen.findByText('recovery:none')).toBeInTheDocument();
  });

  it('re-runs the boot sequence when the published retry is used', async () => {
    const user = userEvent.setup();
    const repositories = await createInMemoryRepositories();
    const store = createDataStore();
    const boot = vi.fn(bootWith(repositories, 'ephemeral', 'No storage.'));

    function RetryProbe() {
      const recovery = useStorageRecovery();
      return <button onClick={recovery?.retry}>reconnect</button>;
    }

    render(
      <DataBootstrap store={store} boot={boot}>
        <RetryProbe />
      </DataBootstrap>,
    );

    await user.click(await screen.findByRole('button', { name: 'reconnect' }));
    await waitFor(() => expect(boot).toHaveBeenCalledTimes(2));
  });
});
