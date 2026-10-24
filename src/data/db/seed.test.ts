import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInMemoryRepositories } from '@/data/adapters/inMemory';
import { SEED_IDS, SEED_VERSION, seedDatabase } from '@/data/db/seed';
import { createIndexedDbRepositories } from '@/data/repositories/indexedDb';
import type { Repositories } from '@/data/repositories/contracts';
import { createDefaultSettings } from '@/domain/factories';

const dependencies = {
  now: () => new Date('2026-10-24T09:00:00.000Z'),
  newId: () => 'generated-id',
};

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openInMemory(): Promise<Repositories> {
  return await createInMemoryRepositories();
}

describe('seedDatabase', () => {
  it('seeds the starter library on first run', async () => {
    const repositories = await openInMemory();

    const result = await seedDatabase(repositories, dependencies);

    expect(result).toEqual({
      seeded: true,
      version: SEED_VERSION,
      previousVersion: 0,
      created: { folders: 1, collections: 1, prompts: 1, templates: 2 },
    });

    const prompts = await repositories.prompts.list();
    expect(prompts).toHaveLength(1);
    const welcome = prompts[0];
    expect(welcome).toMatchObject({
      id: SEED_IDS.welcomePrompt,
      title: 'Welcome to PromptForge',
      status: 'active',
      pinned: true,
      folderId: SEED_IDS.folderGettingStarted,
      collectionIds: [SEED_IDS.collectionStarterKit],
      tags: ['welcome', 'guide'],
      version: 1,
    });
    expect(welcome?.content.context.description).toContain('stored locally in IndexedDB');
    expect(welcome?.content.variables.map((variable) => variable.name)).toEqual(['audience']);

    const folders = await repositories.folders.list();
    expect(folders.map((folder) => folder.id)).toEqual([SEED_IDS.folderGettingStarted]);

    const collections = await repositories.collections.list();
    expect(collections.map((collection) => collection.id)).toEqual([SEED_IDS.collectionStarterKit]);

    const templates = await repositories.templates.list();
    expect(templates.map((template) => template.id).sort()).toEqual([
      SEED_IDS.templateReviewResponse,
      SEED_IDS.templateStructuredExtraction,
    ]);
    expect(templates.every((template) => template.isBuiltIn)).toBe(true);
    expect(templates.map((template) => template.category).sort()).toEqual([
      'Extraction',
      'Writing',
    ]);

    const settings = await repositories.settings.get();
    expect(settings).toMatchObject({
      theme: 'system',
      density: 'comfortable',
      indentSize: 2,
      autosaveEnabled: true,
      seedVersion: SEED_VERSION,
      onboardedAt: null,
    });

    expect(await repositories.meta.getSeedVersion()).toBe(SEED_VERSION);
    // The seed is shipped content, not user activity.
    expect(await repositories.activity.list()).toEqual([]);

    await repositories.close();
  });

  it('does nothing on the second run', async () => {
    const repositories = await openInMemory();
    await seedDatabase(repositories, dependencies);

    const before = {
      prompts: await repositories.prompts.list(),
      templates: await repositories.templates.list(),
    };

    const second = await seedDatabase(repositories, dependencies);

    expect(second).toEqual({
      seeded: false,
      version: SEED_VERSION,
      previousVersion: SEED_VERSION,
      created: { folders: 0, collections: 0, prompts: 0, templates: 0 },
    });
    expect(await repositories.prompts.list()).toEqual(before.prompts);
    expect(await repositories.templates.list()).toEqual(before.templates);
    expect(await repositories.meta.getSeedVersion()).toBe(SEED_VERSION);

    await repositories.close();
  });

  it('is version-gated: a newer stored seed skips everything', async () => {
    const repositories = await openInMemory();
    await repositories.meta.setSeedVersion(SEED_VERSION + 1);

    const result = await seedDatabase(repositories, dependencies);

    expect(result.seeded).toBe(false);
    expect(result.previousVersion).toBe(SEED_VERSION + 1);
    expect(await repositories.prompts.list()).toEqual([]);
    expect(await repositories.folders.list()).toEqual([]);
    expect(await repositories.templates.list()).toEqual([]);
    expect(await repositories.settings.get()).toBeNull();

    await repositories.close();
  });

  it('resumes a partially applied seed without duplicating rows', async () => {
    const repositories = await openInMemory();
    await seedDatabase(repositories, dependencies);

    // Simulate an interrupted seed: one row missing, version not yet written.
    await repositories.templates.delete(SEED_IDS.templateReviewResponse);
    await repositories.meta.setSeedVersion(0);

    const result = await seedDatabase(repositories, dependencies);

    expect(result.seeded).toBe(true);
    expect(result.created).toEqual({ folders: 0, collections: 0, prompts: 0, templates: 1 });
    expect(await repositories.templates.list()).toHaveLength(2);
    expect(await repositories.prompts.list()).toHaveLength(1);
    expect(await repositories.meta.getSeedVersion()).toBe(SEED_VERSION);

    await repositories.close();
  });

  it('keeps user settings and only advances their seed version', async () => {
    const repositories = await openInMemory();
    await repositories.settings.save({
      ...createDefaultSettings(),
      theme: 'light',
      density: 'compact',
      indentSize: 4,
      seedVersion: 0,
    });

    await seedDatabase(repositories, dependencies);

    expect(await repositories.settings.get()).toMatchObject({
      theme: 'light',
      density: 'compact',
      indentSize: 4,
      seedVersion: SEED_VERSION,
    });

    await repositories.close();
  });

  it('does not overwrite an edited welcome prompt', async () => {
    const repositories = await openInMemory();
    await seedDatabase(repositories, dependencies);

    const welcome = await repositories.prompts.get(SEED_IDS.welcomePrompt);
    expect(welcome).not.toBeNull();
    if (!welcome) return;

    await repositories.prompts.update(
      { ...welcome, title: 'My own welcome', version: welcome.version + 1 },
      { expectedVersion: welcome.version },
    );
    await repositories.meta.setSeedVersion(0);

    await seedDatabase(repositories, dependencies);

    expect(await repositories.prompts.get(SEED_IDS.welcomePrompt)).toMatchObject({
      title: 'My own welcome',
    });

    await repositories.close();
  });
});

describe('seedDatabase (IndexedDB)', () => {
  it('seeds once and stays idempotent across reopens', async () => {
    const name = 'promptforge-seed-durable';
    const first = await createIndexedDbRepositories({ name });

    const seeded = await seedDatabase(first, dependencies);
    expect(seeded.created).toEqual({ folders: 1, collections: 1, prompts: 1, templates: 2 });
    await first.close();

    const second = await createIndexedDbRepositories({ name });
    const again = await seedDatabase(second, dependencies);

    expect(again.seeded).toBe(false);
    expect(await second.prompts.list()).toHaveLength(1);
    expect(await second.templates.list()).toHaveLength(2);
    expect(await second.meta.getSeedVersion()).toBe(SEED_VERSION);
    expect((await second.prompts.get(SEED_IDS.welcomePrompt))?.version).toBe(1);

    await second.close();
  });
});
