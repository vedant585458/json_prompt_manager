import { describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '@/data/adapters/inMemory';
import { DB_SCHEMA_VERSION } from '@/data/db/schema';
import { StorageError } from '@/data/db/errors';
import { describeRepositoryContract } from '@/data/repositories/contract';
import { createPrompt } from '@/domain/factories';

describeRepositoryContract('in-memory', async () => createInMemoryRepositories());

describe('in-memory adapter specifics', () => {
  it('accepts seed data, including settings and meta', async () => {
    const prompt = createPrompt(
      { title: 'Seeded' },
      { now: () => new Date('2026-01-01T00:00:00.000Z'), newId: () => 'seed-1' },
    );
    const repos = createInMemoryRepositories({
      prompts: [prompt],
      meta: { dbSchemaVersion: DB_SCHEMA_VERSION, seedVersion: 7 },
      settings: {
        theme: 'dark',
        reducedMotion: true,
        indentSize: 2,
        autosaveEnabled: false,
        autosaveDelayMs: 900,
        density: 'comfortable',
        onboardedAt: null,
        seedVersion: 7,
      },
    });

    await expect(repos.prompts.list()).resolves.toEqual([prompt]);
    await expect(repos.meta.getSeedVersion()).resolves.toBe(7);
    await expect(repos.settings.get()).resolves.toMatchObject({ theme: 'dark' });

    await repos.close();
  });

  it('refuses every operation after close', async () => {
    const repos = createInMemoryRepositories();
    await repos.close();

    await expect(repos.prompts.list()).rejects.toBeInstanceOf(StorageError);
    await expect(repos.prompts.list()).rejects.toMatchObject({ code: 'unavailable' });
    await expect(repos.close()).resolves.toBeUndefined();
  });
});
