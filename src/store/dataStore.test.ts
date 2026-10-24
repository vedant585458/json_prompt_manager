import { describe, expect, it } from 'vitest';

import {
  createInMemoryRepositories,
  RecordNotFoundError,
  StaleWriteError,
  StorageError,
  StorageUnavailableError,
  type Repositories,
} from '@/data';
import { createDataStore, describeDataError, type DataStore } from '@/store/dataStore';
import { createDefaultSettings, createPrompt as createPromptEntity } from '@/domain/factories';

/** Clock that advances one second per read, so ordering is observable. */
function createClock(start = '2026-10-24T09:00:00.000Z', stepMs = 1000) {
  let current = new Date(start).getTime();
  return () => {
    const value = new Date(current);
    current += stepMs;
    return value;
  };
}

function createIds() {
  let counter = 0;
  return () => `id-${++counter}`;
}

interface Harness {
  readonly repositories: Repositories;
  readonly store: DataStore;
}

async function createHarness(
  seed?: (repositories: Repositories) => Promise<void>,
): Promise<Harness> {
  const repositories = await createInMemoryRepositories();
  if (seed) await seed(repositories);

  const store = createDataStore({ now: createClock(), newId: createIds() });
  store.getState().attach(repositories, 'durable');
  await store.getState().hydrate();

  return { repositories, store };
}

describe('dataStore hydration', () => {
  it('reads every repository into state', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.prompts.create(createPromptEntity({ title: 'Existing prompt' }));
    });

    expect(store.getState().status).toBe('ready');
    expect(store.getState().mode).toBe('durable');
    expect(store.getState().prompts).toHaveLength(1);
    expect(store.getState().prompts[0]?.title).toBe('Existing prompt');

    await repositories.close();
  });

  it('reports a typed failure without throwing', async () => {
    const repositories = await createInMemoryRepositories();
    await repositories.close();

    const store = createDataStore();
    store.getState().attach(repositories, 'durable');
    await expect(store.getState().hydrate()).resolves.toBeUndefined();

    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toMatch(/closed/i);
  });

  it('closes the connection it replaces when re-attached', async () => {
    const first = await createInMemoryRepositories();
    const second = await createInMemoryRepositories();
    const store = createDataStore();

    store.getState().attach(first, 'durable');
    await store.getState().hydrate();
    store.getState().attach(second, 'ephemeral');
    await store.getState().hydrate();

    expect(store.getState().mode).toBe('ephemeral');
    await expect(first.settings.get()).rejects.toMatchObject({ code: 'unavailable' });
    await expect(second.settings.get()).resolves.toBeNull();

    await second.close();
  });

  it('refuses to touch storage before attach', async () => {
    const store = createDataStore();

    await expect(store.getState().addPrompt({ title: 'Too early' })).rejects.toBeInstanceOf(
      StorageUnavailableError,
    );
    expect(store.getState().error).toMatch(/not ready yet/i);
  });
});

describe('dataStore prompt mutations', () => {
  it('persists a new prompt and records creation activity', async () => {
    const { repositories, store } = await createHarness();

    const prompt = await store.getState().addPrompt({
      title: 'Summarise a changelog',
      description: 'Turns release notes into a short summary.',
      tags: [' Release ', 'release', 'Docs'],
    });

    expect(prompt.version).toBe(1);
    expect(prompt.tags).toEqual(['release', 'docs']);

    // The repository is the source of truth, not the in-memory copy.
    await expect(repositories.prompts.get(prompt.id)).resolves.toMatchObject({
      title: 'Summarise a changelog',
      version: 1,
    });
    expect(store.getState().prompts).toHaveLength(1);

    const activity = await repositories.activity.list();
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      type: 'created',
      promptId: prompt.id,
      promptTitle: 'Summarise a changelog',
    });
    expect(store.getState().busy).toBe(false);

    await repositories.close();
  });

  it('persists an edit, advances the version, and refreshes from the write result', async () => {
    const { repositories, store } = await createHarness();
    const prompt = await store.getState().addPrompt({ title: 'Draft' });

    const updated = await store.getState().editPrompt(prompt.id, {
      title: 'Refined draft',
      status: 'active',
      tags: ['writing'],
    });

    expect(updated.version).toBe(2);
    expect(updated.updatedAt > prompt.updatedAt).toBe(true);
    expect(updated.title).toBe('Refined draft');
    expect(updated.status).toBe('active');

    await expect(repositories.prompts.get(prompt.id)).resolves.toMatchObject({
      title: 'Refined draft',
      status: 'active',
      version: 2,
    });

    const activity = await repositories.activity.list();
    expect(activity[0]).toMatchObject({ type: 'updated', promptId: prompt.id });
    // Newest first, so the edited prompt leads the library.
    expect(store.getState().prompts[0]?.id).toBe(prompt.id);

    await repositories.close();
  });

  it('rejects an edit for a prompt that no longer exists', async () => {
    const { repositories, store } = await createHarness();

    await expect(store.getState().editPrompt('missing', { title: 'Nope' })).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );
    expect(store.getState().error).toMatch(/no longer exists/);
    expect(store.getState().busy).toBe(false);

    await repositories.close();
  });

  it('archives, restores, and deletes with the matching activity types', async () => {
    const { repositories, store } = await createHarness();
    const prompt = await store.getState().addPrompt({ title: 'Seasonal notice' });

    const archived = await store.getState().archivePrompt(prompt.id);
    expect(archived.archived).toBe(true);
    await expect(repositories.prompts.get(prompt.id)).resolves.toMatchObject({ archived: true });

    const restored = await store.getState().unarchivePrompt(prompt.id);
    expect(restored.archived).toBe(false);

    await store.getState().deletePrompt(prompt.id);
    await expect(repositories.prompts.get(prompt.id)).resolves.toBeNull();
    expect(store.getState().prompts).toHaveLength(0);

    const activity = await repositories.activity.list();
    expect(activity.map((event) => event.type)).toEqual([
      'deleted',
      'updated',
      'archived',
      'created',
    ]);
    // The title is snapshotted so the timeline stays readable after deletion.
    expect(activity[0]?.promptTitle).toBe('Seasonal notice');

    await repositories.close();
  });

  it('deleting a missing prompt is idempotent and still recorded honestly', async () => {
    const { repositories, store } = await createHarness();

    await expect(store.getState().deletePrompt('gone')).resolves.toBeUndefined();

    const activity = await repositories.activity.list();
    expect(activity[0]?.summary).toMatch(/no longer existed/);

    await repositories.close();
  });

  it('blocks an out-of-date writer after a store edit', async () => {
    const { repositories, store } = await createHarness();
    const prompt = await store.getState().addPrompt({ title: 'Versioned' });
    await store.getState().editPrompt(prompt.id, { title: 'Versioned, edited' });

    // The stale in-memory copy can no longer overwrite storage.
    await expect(
      repositories.prompts.update(
        { ...prompt, title: 'Stale overwrite', version: prompt.version + 1 },
        { expectedVersion: prompt.version },
      ),
    ).rejects.toBeInstanceOf(StaleWriteError);

    await expect(repositories.prompts.get(prompt.id)).resolves.toMatchObject({
      title: 'Versioned, edited',
      version: 2,
    });

    await repositories.close();
  });
});

describe('dataStore snapshots', () => {
  it('creates sequential manual revisions and records each one', async () => {
    const { repositories, store } = await createHarness();
    const prompt = await store.getState().addPrompt({ title: 'Snapshot me' });

    const first = await store.getState().snapshotPrompt(prompt.id, 'Before rewrite');
    const second = await store.getState().snapshotPrompt(prompt.id);

    expect(first.revisionNumber).toBe(1);
    expect(first.kind).toBe('manual');
    expect(first.label).toBe('Before rewrite');
    expect(second.revisionNumber).toBe(2);
    expect(second.label).toBeNull();
    expect(second.contentSnapshot).toEqual(prompt.content);

    await expect(repositories.revisions.listByPrompt(prompt.id)).resolves.toHaveLength(2);

    const activity = await repositories.activity.list();
    expect(activity[0]).toMatchObject({ type: 'snapshot', promptId: prompt.id });
    expect(activity[0]?.summary).toContain('v2');

    await repositories.close();
  });
});

describe('dataStore organisation and settings', () => {
  it('keeps folders and collections in name order', async () => {
    const { repositories, store } = await createHarness();

    await store.getState().addFolder('Zebra');
    await store.getState().addFolder('alpha');
    await store.getState().addCollection('Beta', 'Second in the alphabet');

    expect(store.getState().folders.map((folder) => folder.name)).toEqual(['alpha', 'Zebra']);
    expect(store.getState().collections[0]).toMatchObject({
      name: 'Beta',
      description: 'Second in the alphabet',
    });
    await expect(repositories.folders.list()).resolves.toHaveLength(2);

    await repositories.close();
  });

  it('saves settings and records a settings activity event', async () => {
    const { repositories, store } = await createHarness();
    const settings = {
      ...createDefaultSettings(),
      theme: 'light' as const,
      indentSize: 4 as const,
    };

    await store.getState().saveSettings(settings);

    expect(store.getState().settings).toMatchObject({ theme: 'light', indentSize: 4 });
    await expect(repositories.settings.get()).resolves.toMatchObject({ theme: 'light' });
    expect((await repositories.activity.list())[0]?.type).toBe('settings');

    await repositories.close();
  });
});

describe('dataStore failure handling', () => {
  it('surfaces repository failures, keeps the busy flag honest, and rethrows', async () => {
    const { repositories, store } = await createHarness();
    await repositories.close();

    const failure = await store
      .getState()
      .addPrompt({ title: 'Will fail' })
      .catch((error) => error);

    expect(failure).toBeInstanceOf(StorageUnavailableError);
    expect(store.getState().busy).toBe(false);
    expect(store.getState().error).not.toBeNull();
    expect(store.getState().prompts).toHaveLength(0);
  });

  it('clears the error on the next successful action', async () => {
    const { repositories, store } = await createHarness();
    await expect(store.getState().editPrompt('missing', {})).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );
    expect(store.getState().error).not.toBeNull();

    await store.getState().addPrompt({ title: 'Recovered' });
    expect(store.getState().error).toBeNull();

    await repositories.close();
  });

  it('keeps the change when only the activity entry fails', async () => {
    const { repositories, store } = await createHarness();
    const append = repositories.activity.append;
    repositories.activity.append = async () => {
      throw new StorageError('quota-exceeded', 'The activity log is full.');
    };

    const prompt = await store.getState().addPrompt({ title: 'Saved without activity' });

    expect(store.getState().prompts).toHaveLength(1);
    expect(store.getState().error).toMatch(/saved, but its activity entry could not be recorded/);
    await expect(repositories.prompts.get(prompt.id)).resolves.toMatchObject({
      title: 'Saved without activity',
    });

    repositories.activity.append = append;
    await repositories.close();
  });
});

describe('describeDataError', () => {
  it('uses the message of typed and plain errors', () => {
    expect(describeDataError(new StorageError('unknown', 'Boom.'))).toBe('Boom.');
    expect(describeDataError(new Error('Plain failure.'))).toBe('Plain failure.');
    expect(describeDataError('a string')).toMatch(/unknown reason/);
    expect(describeDataError(undefined)).toMatch(/unknown reason/);
  });
});
