import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MigrationError, StorageUnavailableError } from '@/data/db/errors';
import { createInMemoryRepositories } from '@/data/adapters/inMemory';
import { openStorage } from '@/data/storage';

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('openStorage', () => {
  it('uses durable storage when the probe succeeds', async () => {
    const result = await openStorage({ name: 'promptforge-storage-durable' });

    expect(result.mode).toBe('durable');
    expect(result.notice).toBeNull();

    await result.repositories.settings.save({
      theme: 'dark',
      reducedMotion: false,
      indentSize: 2,
      autosaveEnabled: true,
      autosaveDelayMs: 900,
      density: 'comfortable',
      onboardedAt: null,
      seedVersion: 0,
    });
    await expect(result.repositories.settings.get()).resolves.toMatchObject({ theme: 'dark' });

    await result.repositories.close();
  });

  it('falls back to in-memory storage when IndexedDB is missing', async () => {
    vi.stubGlobal('indexedDB', undefined);

    const result = await openStorage();

    expect(result.mode).toBe('ephemeral');
    expect(result.notice).toMatch(/IndexedDB is not available/);
    expect(result.notice).toMatch(/nothing is being saved/);

    // The fallback is a working store, not a stub.
    const repositories = result.repositories;
    await repositories.settings.save({
      theme: 'light',
      reducedMotion: false,
      indentSize: 4,
      autosaveEnabled: false,
      autosaveDelayMs: 1200,
      density: 'compact',
      onboardedAt: null,
      seedVersion: 0,
    });
    await expect(repositories.settings.get()).resolves.toMatchObject({ theme: 'light' });

    await repositories.close();
  });

  it('falls back to in-memory storage when the database cannot be opened', async () => {
    const failure = new MigrationError('newer-database', 'This database is newer than this build.');
    const openEphemeral = vi.fn(async () => createInMemoryRepositories());

    const result = await openStorage({
      probe: async () => ({ available: true }),
      openDurable: async () => {
        throw failure;
      },
      openEphemeral,
    });

    expect(openEphemeral).toHaveBeenCalledTimes(1);
    expect(result.mode).toBe('ephemeral');
    expect(result.notice).toContain('Durable storage could not be opened');
    expect(result.notice).toContain('This database is newer than this build.');
    expect(result.notice).toMatch(/disappear when you reload/);

    await result.repositories.close();
  });

  it('treats a throwing probe as unavailable rather than crashing boot', async () => {
    const result = await openStorage({
      probe: async () => {
        throw new Error('security policy denied storage');
      },
    });

    expect(result.mode).toBe('ephemeral');
    expect(result.notice).toMatch(/IndexedDB is not available/);
    await expect(result.repositories.prompts.list()).resolves.toEqual([]);

    await result.repositories.close();
  });

  it('does not silently promote an ephemeral store to durable', async () => {
    const result = await openStorage({
      probe: async () => ({ available: false, error: new StorageUnavailableError('nope') }),
    });

    expect(result.mode).toBe('ephemeral');
    await result.repositories.close();
  });
});
