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
import { RuleViolationError } from '@/domain/errors';
import {
  createCollection,
  createDefaultSettings,
  createFolder,
  createPrompt as createPromptEntity,
  createRevision,
  createTestCase,
} from '@/domain/factories';

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

/* -------------------------------------------------------------------------- */
/* TASK-012 — prompt and container lifecycle                                   */
/* -------------------------------------------------------------------------- */

const seededNow = () => new Date('2026-10-20T09:00:00.000Z');

function folderEntity(id: string, name: string, parentId: string | null = null) {
  return createFolder({ name, parentId }, { now: seededNow, newId: () => id });
}

function collectionEntity(id: string, name: string) {
  return createCollection({ name }, { now: seededNow, newId: () => id });
}

function promptEntity(id: string, title: string, overrides: Record<string, unknown> = {}) {
  return createPromptEntity({ title, ...overrides }, { now: seededNow, newId: () => id });
}

describe('dataStore prompt lifecycle', () => {
  it('duplicates a prompt under a "(copy)" title with a fresh id', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.prompts.create(
        promptEntity('source', 'Invoice parser', {
          tags: ['finance'],
          collectionIds: ['kit'],
          content: {
            ...promptEntity('template', 'Invoice parser').content,
            objective: 'Read an invoice and return line items.',
          },
        }),
      );
    });

    const copy = await store.getState().duplicatePrompt('source');

    expect(copy.id).not.toBe('source');
    expect(copy.title).toBe('Invoice parser (copy)');
    expect(copy.version).toBe(1);
    expect(copy.createdAt).toBe(copy.updatedAt);
    expect(copy.tags).toEqual(['finance']);
    expect(copy.collectionIds).toEqual(['kit']);
    expect(copy.content.objective).toBe('Read an invoice and return line items.');
    expect(
      store
        .getState()
        .prompts.map((prompt) => prompt.id)
        .sort(),
    ).toEqual(['source', copy.id].sort());
    expect(store.getState().activity[0]?.summary).toBe('Duplicated "Invoice parser"');

    await repositories.close();
  });

  it('numbers later copies instead of reusing a title', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.prompts.create(promptEntity('source', 'Triage'));
    });

    const first = await store.getState().duplicatePrompt('source');
    const second = await store.getState().duplicatePrompt('source');
    const third = await store.getState().duplicatePrompt('source');

    expect([first.title, second.title, third.title]).toEqual([
      'Triage (copy)',
      'Triage (copy 2)',
      'Triage (copy 3)',
    ]);
    expect(new Set([first.id, second.id, third.id]).size).toBe(3);

    await repositories.close();
  });

  it('keeps a duplicate independent of its source', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.prompts.create(
        promptEntity('source', 'Independent', {
          content: {
            ...promptEntity('template', 'Independent').content,
            instructions: ['One', 'Two'],
          },
        }),
      );
    });

    const copy = await store.getState().duplicatePrompt('source');

    await store.getState().editPrompt(copy.id, {
      title: 'Changed copy',
      content: { ...copy.content, instructions: ['Only the copy'] },
    });

    const source = store.getState().prompts.find((prompt) => prompt.id === 'source');
    expect(source?.title).toBe('Independent');
    expect(source?.content.instructions).toEqual(['One', 'Two']);
    await expect(repositories.prompts.get('source')).resolves.toMatchObject({
      content: { instructions: ['One', 'Two'] },
    });

    await repositories.close();
  });

  it('deletes a prompt together with its revisions and test cases', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.prompts.create(promptEntity('doomed', 'Doomed'));
      await repos.prompts.create(promptEntity('kept', 'Kept'));
      await repos.revisions.create(
        createRevision(
          promptEntity('doomed', 'Doomed'),
          { revisionNumber: 1, kind: 'manual' },
          { now: seededNow, newId: () => 'rev-1' },
        ),
      );
      await repos.revisions.create(
        createRevision(
          promptEntity('kept', 'Kept'),
          { revisionNumber: 1, kind: 'manual' },
          { now: seededNow, newId: () => 'rev-2' },
        ),
      );
      await repos.testCases.create(
        createTestCase(
          { promptId: 'doomed', name: 'Case A' },
          { now: seededNow, newId: () => 'tc-1' },
        ),
      );
      await repos.testCases.create(
        createTestCase(
          { promptId: 'kept', name: 'Case B' },
          { now: seededNow, newId: () => 'tc-2' },
        ),
      );
    });

    await store.getState().deletePrompt('doomed');

    expect(store.getState().prompts.map((prompt) => prompt.id)).toEqual(['kept']);
    expect(store.getState().revisions.map((revision) => revision.id)).toEqual(['rev-2']);
    expect(store.getState().testCases.map((testCase) => testCase.id)).toEqual(['tc-2']);
    await expect(repositories.prompts.get('doomed')).resolves.toBeNull();
    await expect(repositories.revisions.listByPrompt('doomed')).resolves.toEqual([]);
    await expect(repositories.testCases.get('tc-1')).resolves.toBeNull();
    expect(store.getState().activity[0]?.summary).toBe('Deleted "Doomed"');

    await repositories.close();
  });

  it('moves a prompt into a folder and records where it went', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.folders.create(folderEntity('finance', 'Finance'));
      await repos.prompts.create(promptEntity('p1', 'Receipts'));
    });

    const moved = await store.getState().movePrompt('p1', 'finance');

    expect(moved.folderId).toBe('finance');
    expect(store.getState().activity[0]?.summary).toBe('Moved "Receipts" to Finance');

    const back = await store.getState().movePrompt('p1', null);
    expect(back.folderId).toBeNull();

    await repositories.close();
  });

  it('refuses to move a prompt into a folder that does not exist', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.prompts.create(promptEntity('p1', 'Receipts'));
    });

    await expect(store.getState().movePrompt('p1', 'ghost')).rejects.toBeInstanceOf(
      RuleViolationError,
    );
    expect(store.getState().prompts[0]?.folderId).toBeNull();
    await expect(repositories.prompts.get('p1')).resolves.toMatchObject({ folderId: null });

    await repositories.close();
  });
});

describe('dataStore organization', () => {
  it('creates nested folders and rejects a duplicate name among siblings', async () => {
    const { repositories, store } = await createHarness();

    const parent = await store.getState().addFolder('Work');
    const child = await store.getState().addFolder('Drafts', parent.id);
    expect(child.parentId).toBe(parent.id);

    await expect(store.getState().addFolder('  drafts  ', parent.id)).rejects.toBeInstanceOf(
      RuleViolationError,
    );
    expect(store.getState().folders).toHaveLength(2);

    // The same name is fine under a different parent.
    const other = await store.getState().addFolder('Drafts');
    expect(other.parentId).toBeNull();

    await repositories.close();
  });

  it('rejects nesting deeper than the documented limit', async () => {
    const { repositories, store } = await createHarness();
    let parentId: string | null = null;

    for (let depth = 1; depth <= 5; depth += 1) {
      const folder: { id: string } = await store.getState().addFolder(`Level ${depth}`, parentId);
      parentId = folder.id;
    }

    await expect(store.getState().addFolder('Too deep', parentId)).rejects.toMatchObject({
      message: expect.stringMatching(/at most 5 levels/),
    });
    expect(store.getState().folders).toHaveLength(5);

    await repositories.close();
  });

  it('renames a folder and records the new name', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.folders.create(folderEntity('work', 'Work'));
    });

    const saved = await store.getState().updateFolder('work', { name: 'Client work' });

    expect(saved.name).toBe('Client work');
    expect(store.getState().folders[0]?.name).toBe('Client work');
    expect(store.getState().activity[0]?.summary).toBe('Renamed folder "Work" to "Client work"');

    await repositories.close();
  });

  it('refuses to move a folder inside its own subtree', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.folders.create(folderEntity('work', 'Work'));
      await repos.folders.create(folderEntity('drafts', 'Drafts', 'work'));
      await repos.folders.create(folderEntity('ideas', 'Ideas', 'drafts'));
    });

    await expect(
      store.getState().updateFolder('work', { parentId: 'ideas' }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/cannot be moved inside itself/),
    });

    const work = store.getState().folders.find((folder) => folder.id === 'work');
    expect(work?.parentId).toBeNull();
    await expect(repositories.folders.get('work')).resolves.toMatchObject({ parentId: null });

    await repositories.close();
  });

  it('deletes a folder by moving its prompts and child folders to the parent', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.folders.create(folderEntity('work', 'Work'));
      await repos.folders.create(folderEntity('drafts', 'Drafts', 'work'));
      await repos.folders.create(folderEntity('ideas', 'Ideas', 'drafts'));
      await repos.prompts.create(promptEntity('in-drafts', 'In drafts', { folderId: 'drafts' }));
      await repos.prompts.create(promptEntity('in-work', 'In work', { folderId: 'work' }));
      await repos.prompts.create(promptEntity('outside', 'Outside'));
    });

    const result = await store.getState().deleteFolder('drafts');

    expect(result).toEqual({ promptsMoved: 1, foldersMoved: 1 });
    expect(
      store
        .getState()
        .folders.map((folder) => folder.id)
        .sort(),
    ).toEqual(['ideas', 'work']);
    expect(store.getState().folders.find((folder) => folder.id === 'ideas')?.parentId).toBe('work');
    expect(store.getState().prompts.find((prompt) => prompt.id === 'in-drafts')?.folderId).toBe(
      'work',
    );
    expect(store.getState().prompts.find((prompt) => prompt.id === 'in-work')?.folderId).toBe(
      'work',
    );
    expect(store.getState().prompts.find((prompt) => prompt.id === 'outside')?.folderId).toBeNull();
    await expect(repositories.prompts.get('in-drafts')).resolves.toMatchObject({
      folderId: 'work',
    });
    expect(store.getState().activity[0]?.summary).toBe(
      'Deleted folder "Drafts" — 1 prompt moved to Work',
    );

    await repositories.close();
  });

  it('moves prompts to the top level when a root folder is deleted', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.folders.create(folderEntity('work', 'Work'));
      await repos.prompts.create(promptEntity('p1', 'Filed', { folderId: 'work' }));
    });

    await store.getState().deleteFolder('work');

    expect(store.getState().prompts[0]?.folderId).toBeNull();
    expect(store.getState().activity[0]?.summary).toMatch(/moved to the top level/);

    await repositories.close();
  });

  it('reports a failed cascade and re-reads storage instead of faking success', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.folders.create(folderEntity('work', 'Work'));
      await repos.folders.create(folderEntity('drafts', 'Drafts', 'work'));
      await repos.prompts.create(promptEntity('p1', 'Filed', { folderId: 'drafts' }));
    });

    repositories.folders.delete = async () => {
      throw new StorageUnavailableError('The database is locked.');
    };

    await expect(store.getState().deleteFolder('drafts')).rejects.toBeInstanceOf(StorageError);

    expect(store.getState().error).toMatch(/locked/);
    // The prompt move was already written, so the store shows the real state.
    expect(store.getState().prompts.find((prompt) => prompt.id === 'p1')?.folderId).toBe('work');
    expect(
      store
        .getState()
        .folders.map((folder) => folder.id)
        .sort(),
    ).toEqual(['drafts', 'work']);

    await repositories.close();
  });

  it('deletes a collection by removing membership only', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.collections.create(collectionEntity('kit', 'Starter kit'));
      await repos.prompts.create(promptEntity('p1', 'Member', { collectionIds: ['kit'] }));
      await repos.prompts.create(promptEntity('p2', 'Also a member', { collectionIds: ['kit'] }));
    });

    const result = await store.getState().deleteCollection('kit');

    expect(result).toEqual({ promptsDetached: 2 });
    expect(store.getState().collections).toEqual([]);
    expect(store.getState().prompts).toHaveLength(2);
    expect(store.getState().prompts.every((prompt) => prompt.collectionIds.length === 0)).toBe(
      true,
    );
    await expect(repositories.prompts.get('p1')).resolves.toMatchObject({ collectionIds: [] });
    expect(store.getState().activity[0]?.summary).toBe(
      'Deleted collection "Starter kit" — 2 prompts kept, membership removed',
    );

    await repositories.close();
  });

  it('renames a collection and rejects a duplicate name', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.collections.create(collectionEntity('one', 'Kit'));
      await repos.collections.create(collectionEntity('two', 'Replies'));
    });

    const saved = await store.getState().updateCollection('two', {
      name: 'Support replies',
      description: ' Canned answers ',
    });
    expect(saved).toMatchObject({ name: 'Support replies', description: 'Canned answers' });

    await expect(store.getState().updateCollection('two', { name: 'kit' })).rejects.toBeInstanceOf(
      RuleViolationError,
    );

    await repositories.close();
  });
});

describe('dataStore favorites, pins, and bulk writes (TASK-013)', () => {
  async function seedThree(repos: Repositories) {
    await repos.prompts.create(promptEntity('p1', 'Alpha', { tags: ['finance', 'support'] }));
    await repos.prompts.create(promptEntity('p2', 'Bravo', { tags: ['support'] }));
    await repos.prompts.create(promptEntity('p3', 'Charlie', { tags: [] }));
  }

  it('flips favorite and pin, writing through to storage', async () => {
    const { repositories, store } = await createHarness(seedThree);

    const favorited = await store.getState().toggleFavorite('p1');
    const pinned = await store.getState().togglePin('p1');

    expect(favorited.favorite).toBe(true);
    expect(pinned.pinned).toBe(true);
    await expect(repositories.prompts.get('p1')).resolves.toMatchObject({
      favorite: true,
      pinned: true,
    });
    expect(store.getState().activity.map((event) => event.summary)).toEqual([
      'Pinned "Alpha"',
      'Favorited "Alpha"',
    ]);

    const unfavorited = await store.getState().toggleFavorite('p1');
    expect(unfavorited.favorite).toBe(false);
    await expect(repositories.prompts.get('p1')).resolves.toMatchObject({ favorite: false });

    await repositories.close();
  });

  it('rejects a toggle for a prompt that no longer exists', async () => {
    const { repositories, store } = await createHarness(seedThree);

    await expect(store.getState().toggleFavorite('missing')).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );

    await repositories.close();
  });

  it('applies a favorite to exactly the selected prompts and reports prior values', async () => {
    const { repositories, store } = await createHarness(seedThree);

    const result = await store.getState().setFavorite(['p1', 'p3'], true);

    expect(result.prompts.map((prompt) => prompt.id).sort()).toEqual(['p1', 'p3']);
    expect(result.previous.map((prompt) => prompt.favorite)).toEqual([false, false]);
    expect(
      store
        .getState()
        .prompts.filter((prompt) => prompt.favorite)
        .map((prompt) => prompt.id)
        .sort(),
    ).toEqual(['p1', 'p3']);
    await expect(repositories.prompts.get('p2')).resolves.toMatchObject({ favorite: false });
    expect(store.getState().activity[0]?.summary).toBe('Favorited 2 prompts');

    await repositories.close();
  });

  it('archives and restores a selection', async () => {
    const { repositories, store } = await createHarness(seedThree);

    const archived = await store.getState().setArchived(['p2'], true);
    expect(archived.prompts[0]).toMatchObject({ id: 'p2', archived: true });
    expect(store.getState().activity[0]?.summary).toBe('Archived 1 prompt');

    const restored = await store.getState().setArchived(['p2'], false);
    expect(restored.prompts[0]).toMatchObject({ id: 'p2', archived: false });
    expect(store.getState().activity[0]?.summary).toBe('Restored 1 prompt from the archive');

    await repositories.close();
  });

  it('adds and removes tags in one pass', async () => {
    const { repositories, store } = await createHarness(seedThree);

    await store.getState().editTags(['p1', 'p3'], { add: [' Priority ', 'finance'] });
    await expect(repositories.prompts.get('p3')).resolves.toMatchObject({
      tags: ['priority', 'finance'],
    });
    await expect(repositories.prompts.get('p1')).resolves.toMatchObject({
      tags: ['finance', 'support', 'priority'],
    });

    await store.getState().editTags(['p1', 'p2'], { remove: ['support'] });
    await expect(repositories.prompts.get('p1')).resolves.toMatchObject({
      tags: ['finance', 'priority'],
    });
    await expect(repositories.prompts.get('p2')).resolves.toMatchObject({ tags: [] });

    await repositories.close();
  });

  it('renames a tag everywhere and merges it into an existing one', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.prompts.create(promptEntity('p1', 'Alpha', { tags: ['invoice', 'finance'] }));
      await repos.prompts.create(promptEntity('p2', 'Bravo', { tags: ['invoice'] }));
      await repos.prompts.create(promptEntity('p3', 'Charlie', { tags: ['finance'] }));
    });

    const result = await store.getState().renameTag('invoice', ' Finance ');
    expect(result).toEqual({ updated: 2 });

    const p1 = await repositories.prompts.get('p1');
    const p2 = await repositories.prompts.get('p2');
    expect(p1?.tags).toEqual(['finance']);
    expect(p2?.tags).toEqual(['finance']);
    expect(store.getState().activity[0]?.summary).toBe(
      'Renamed tag "#invoice" to "#finance" on 2 prompts',
    );

    await repositories.close();
  });

  it('rejects renaming a tag to nothing', async () => {
    const { repositories, store } = await createHarness(seedThree);

    await expect(store.getState().renameTag('support', '   ')).rejects.toBeInstanceOf(
      RuleViolationError,
    );

    await repositories.close();
  });

  it('deletes a tag from every prompt that carries it', async () => {
    const { repositories, store } = await createHarness(seedThree);

    const result = await store.getState().deleteTag('support');
    expect(result).toEqual({ updated: 2 });
    expect(store.getState().prompts.find((prompt) => prompt.id === 'p1')?.tags).toEqual([
      'finance',
    ]);
    expect(store.getState().activity[0]?.summary).toBe('Removed tag "#support" from 2 prompts');

    await repositories.close();
  });

  it('restores the reversible fields without touching later edits', async () => {
    const { repositories, store } = await createHarness(seedThree);

    const previous = await store.getState().setArchived(['p1', 'p2'], true);
    await store.getState().editPrompt('p1', { title: 'Alpha renamed' });

    const restored = await store.getState().restorePrompts(previous.previous);
    expect(restored).toBe(2);

    const p1 = await repositories.prompts.get('p1');
    expect(p1).toMatchObject({ title: 'Alpha renamed', archived: false, favorite: false });
    await expect(repositories.prompts.get('p2')).resolves.toMatchObject({ archived: false });

    await repositories.close();
  });

  it('deletes a selection with its revisions and test cases, and brings it back', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      const prompt = promptEntity('p1', 'Alpha');
      await repos.prompts.create(prompt);
      await repos.prompts.create(promptEntity('p2', 'Bravo'));
      await repos.revisions.create(
        createRevision(
          prompt,
          { revisionNumber: 1, kind: 'manual' },
          {
            now: seededNow,
            newId: () => 'rev-1',
          },
        ),
      );
      await repos.testCases.create(
        createTestCase(
          { promptId: 'p1', name: 'Case one' },
          { now: seededNow, newId: () => 'case-1' },
        ),
      );
    });

    const target = store.getState().prompts.find((prompt) => prompt.id === 'p1');
    expect(target).toBeDefined();

    const deleted = await store.getState().deletePrompts(['p1']);
    expect(deleted.prompts.map((prompt) => prompt.id)).toEqual(['p1']);
    expect(deleted.revisions).toHaveLength(1);
    expect(deleted.testCases).toHaveLength(1);
    await expect(repositories.prompts.get('p1')).resolves.toBeNull();
    await expect(repositories.revisions.listByPrompt('p1')).resolves.toEqual([]);
    expect(store.getState().testCases).toEqual([]);
    expect(store.getState().activity[0]?.summary).toBe('Deleted 1 prompt');

    const restored = await store.getState().restoreDeletedPrompts(deleted);
    expect(restored).toBe(1);
    await expect(repositories.prompts.get('p1')).resolves.toMatchObject({ title: 'Alpha' });
    await expect(repositories.revisions.listByPrompt('p1')).resolves.toHaveLength(1);
    expect(store.getState().testCases).toHaveLength(1);
    expect(store.getState().activity[0]?.summary).toBe('Restored 1 prompt');

    await repositories.close();
  });

  it('leaves every row unchanged when a bulk write fails', async () => {
    const { repositories, store } = await createHarness(seedThree);

    repositories.prompts.updateMany = async () => {
      throw new StorageUnavailableError('The database is locked.');
    };

    await expect(store.getState().setFavorite(['p1', 'p2', 'p3'], true)).rejects.toThrow(
      'The database is locked.',
    );

    expect(store.getState().prompts.every((prompt) => !prompt.favorite)).toBe(true);
    expect(store.getState().error).toBe('The database is locked.');
    expect(store.getState().activity).toEqual([]);

    const stored = await repositories.prompts.list();
    expect(stored.every((prompt) => !prompt.favorite)).toBe(true);

    await repositories.close();
  });

  it('keeps a failed bulk delete visible and undoable in storage', async () => {
    const { repositories, store } = await createHarness(seedThree);

    repositories.prompts.deleteManyCascade = async () => {
      throw new StorageUnavailableError('The database is locked.');
    };

    await expect(store.getState().deletePrompts(['p1', 'p2'])).rejects.toThrow(
      'The database is locked.',
    );

    expect(store.getState().prompts).toHaveLength(3);
    await expect(repositories.prompts.get('p1')).resolves.not.toBeNull();
    expect(store.getState().activity).toEqual([]);

    await repositories.close();
  });

  it('surfaces a failed undo without losing the change it was undoing', async () => {
    const { repositories, store } = await createHarness(seedThree);

    const change = await store.getState().setArchived(['p1', 'p2'], true);
    repositories.prompts.updateMany = async () => {
      throw new StorageUnavailableError('The database is locked.');
    };

    await expect(store.getState().restorePrompts(change.previous)).rejects.toThrow(
      'The database is locked.',
    );

    // The archive is intact, so Undo stays meaningful: retrying after the
    // storage recovers restores both rows.
    const stored = await repositories.prompts.list();
    expect(stored.filter((prompt) => prompt.archived).map((prompt) => prompt.id)).toEqual([
      'p1',
      'p2',
    ]);
    expect(store.getState().prompts.filter((prompt) => prompt.archived)).toHaveLength(2);

    await repositories.close();
  });

  it('surfaces a failed restore of deleted prompts', async () => {
    const { repositories, store } = await createHarness(seedThree);

    const deleted = await store.getState().deletePrompts(['p3']);
    repositories.prompts.create = async () => {
      throw new StorageUnavailableError('The database is locked.');
    };

    await expect(store.getState().restoreDeletedPrompts(deleted)).rejects.toThrow(
      'The database is locked.',
    );
    await expect(repositories.prompts.get('p3')).resolves.toBeNull();
    expect(store.getState().prompts).toHaveLength(2);

    await repositories.close();
  });
});

describe('dataStore test cases (TASK-022)', () => {
  async function seedPrompt(repositories: Repositories): Promise<void> {
    await repositories.prompts.create(createPromptEntity({ title: 'Triage' }));
  }

  it('creates a case scoped to one prompt and keeps it across a rehydrate', async () => {
    const { repositories, store } = await createHarness(seedPrompt);
    const promptId = store.getState().prompts[0]!.id;

    const created = await store.getState().addTestCase({
      promptId,
      name: '  Billing  ',
      inputValues: { ticket: 'Billing' },
      expectedStructure: null,
    });

    expect(created.name).toBe('Billing');
    expect(created.promptId).toBe(promptId);
    expect(created.inputValues).toEqual({ ticket: 'Billing' });
    expect(store.getState().testCases).toHaveLength(1);

    // The record is in storage, so a fresh store sees it after hydration.
    await store.getState().hydrate();
    expect(store.getState().testCases.map((testCase) => testCase.id)).toEqual([created.id]);

    await repositories.close();
  });

  it('rejects a duplicate name within the prompt but allows it on another prompt', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.prompts.create(createPromptEntity({ title: 'One' }));
      await repos.prompts.create(createPromptEntity({ title: 'Two' }));
    });
    const [first, second] = store.getState().prompts;

    await store.getState().addTestCase({ promptId: first!.id, name: 'Billing' });

    await expect(
      store.getState().addTestCase({ promptId: first!.id, name: 'billing' }),
    ).rejects.toBeInstanceOf(RuleViolationError);

    await expect(
      store.getState().addTestCase({ promptId: second!.id, name: 'Billing' }),
    ).resolves.toMatchObject({ promptId: second!.id });

    expect(store.getState().testCases).toHaveLength(2);

    await repositories.close();
  });

  it('rejects a missing or over-long name and a missing prompt', async () => {
    const { repositories, store } = await createHarness(seedPrompt);
    const promptId = store.getState().prompts[0]!.id;

    await expect(store.getState().addTestCase({ promptId, name: '   ' })).rejects.toBeInstanceOf(
      RuleViolationError,
    );

    await expect(
      store.getState().addTestCase({ promptId, name: 'x'.repeat(121) }),
    ).rejects.toBeInstanceOf(RuleViolationError);

    await expect(
      store.getState().addTestCase({ promptId: 'missing', name: 'Billing' }),
    ).rejects.toBeInstanceOf(RecordNotFoundError);

    expect(store.getState().testCases).toEqual([]);

    await repositories.close();
  });

  it('renames a case and replaces its values, touching updatedAt', async () => {
    const { repositories, store } = await createHarness(seedPrompt);
    const promptId = store.getState().prompts[0]!.id;
    const created = await store.getState().addTestCase({
      promptId,
      name: 'Billing',
      inputValues: { ticket: 'Billing' },
    });

    const renamed = await store.getState().updateTestCase(created.id, {
      name: 'Billing refund',
      inputValues: { ticket: 'Billing', priority: 1 },
    });

    expect(renamed.id).toBe(created.id);
    expect(renamed.name).toBe('Billing refund');
    expect(renamed.inputValues).toEqual({ ticket: 'Billing', priority: 1 });
    expect(renamed.createdAt).toBe(created.createdAt);
    expect(renamed.updatedAt > created.updatedAt).toBe(true);
    expect(store.getState().testCases).toHaveLength(1);

    await repositories.close();
  });

  it('keeps untouched fields on a partial edit and refuses a duplicate rename', async () => {
    const { repositories, store } = await createHarness(seedPrompt);
    const promptId = store.getState().prompts[0]!.id;
    const one = await store.getState().addTestCase({ promptId, name: 'One' });
    const two = await store.getState().addTestCase({ promptId, name: 'Two' });

    await expect(store.getState().updateTestCase(two.id, { name: 'ONE' })).rejects.toBeInstanceOf(
      RuleViolationError,
    );

    const renamed = await store.getState().updateTestCase(one.id, { name: 'Renamed' });
    expect(renamed.inputValues).toEqual({});

    await repositories.close();
  });

  it('duplicates a case without sharing its values', async () => {
    const { repositories, store } = await createHarness(seedPrompt);
    const promptId = store.getState().prompts[0]!.id;
    const source = await store.getState().addTestCase({
      promptId,
      name: 'Billing',
      inputValues: { ticket: 'Billing' },
    });

    const copy = await store.getState().duplicateTestCase(source.id);
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe('Billing (copy)');
    expect(copy.inputValues).toEqual({ ticket: 'Billing' });

    const updated = await store.getState().updateTestCase(copy.id, {
      inputValues: { ticket: 'changed' },
    });
    expect(updated.inputValues).toEqual({ ticket: 'changed' });
    expect(store.getState().testCases.find((c) => c.id === source.id)!.inputValues).toEqual({
      ticket: 'Billing',
    });

    const third = await store.getState().duplicateTestCase(source.id);
    expect(third.name).toBe('Billing (copy 2)');

    await repositories.close();
  });

  it('deletes one case without touching its siblings or the prompt', async () => {
    const { repositories, store } = await createHarness(seedPrompt);
    const promptId = store.getState().prompts[0]!.id;
    const one = await store.getState().addTestCase({ promptId, name: 'One' });
    const two = await store.getState().addTestCase({ promptId, name: 'Two' });

    await store.getState().deleteTestCase(one.id);

    expect(store.getState().testCases.map((c) => c.id)).toEqual([two.id]);
    await expect(repositories.testCases.get(one.id)).resolves.toBeNull();
    expect(store.getState().prompts).toHaveLength(1);

    await expect(store.getState().deleteTestCase(one.id)).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );

    await repositories.close();
  });
});
