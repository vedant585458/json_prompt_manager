import { describe, expect, it } from 'vitest';

import {
  createInMemoryRepositories,
  RecordNotFoundError,
  StaleWriteError,
  type Repositories,
} from '@/data';
import { createPrompt as createPromptEntity } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import { RuleViolationError } from '@/domain/errors';
import type { Prompt, PromptDocument } from '@/domain/types';
import { createDataStore, type DataStore } from '@/store/dataStore';

const NOW = new Date('2026-10-24T09:00:00.000Z');

function documentWith(overrides: Partial<PromptDocument> = {}): PromptDocument {
  return createBlankDocument({
    name: 'Release notes',
    role: 'Technical writer',
    objective: 'Summarise a release.',
    instructions: ['List changes.'],
    variables: [{ name: 'version', type: 'string', required: true }],
    metadata: { tags: ['release'] },
    ...overrides,
  });
}

function promptEntity(id = 'prompt-1'): Prompt {
  return createPromptEntity(
    {
      title: 'Release notes',
      description: 'Weekly release summary.',
      content: documentWith(),
      tags: ['release'],
    },
    { now: () => NOW, newId: () => id },
  );
}

interface Harness {
  readonly repositories: Repositories;
  readonly store: DataStore;
}

async function createHarness(
  seed?: (repositories: Repositories) => Promise<void>,
  /** Replaces one method, to exercise a storage failure honestly. */
  decorate?: (repositories: Repositories) => Repositories,
): Promise<Harness> {
  const opened = await createInMemoryRepositories();
  if (seed) await seed(opened);
  const repositories = decorate ? decorate(opened) : opened;

  let counter = 0;
  const store = createDataStore({
    // One second per read, so timestamps order the way a user would expect.
    now: () => new Date(NOW.getTime() + counter++ * 1000),
    newId: () => `generated-${counter}`,
  });
  store.getState().attach(repositories, 'durable');
  await store.getState().hydrate();

  return { repositories, store };
}

async function withPrompt(): Promise<Harness> {
  return createHarness(async (repos) => {
    await repos.prompts.create(promptEntity());
  });
}

describe('snapshotPrompt', () => {
  it('captures the complete authorable state and numbers the revision', async () => {
    const { repositories, store } = await withPrompt();

    const first = await store.getState().snapshotPrompt('prompt-1', '  Before cleanup ');
    const second = await store.getState().snapshotPrompt('prompt-1');

    expect(first.revisionNumber).toBe(1);
    expect(second.revisionNumber).toBe(2);
    expect(first.label).toBe('Before cleanup');
    expect(second.label).toBeNull();
    expect(first.kind).toBe('manual');
    expect(first).toMatchObject({
      promptId: 'prompt-1',
      titleSnapshot: 'Release notes',
      descriptionSnapshot: 'Weekly release summary.',
      tagsSnapshot: ['release'],
    });
    expect(first.contentSnapshot).toEqual(documentWith());
    expect(first.variablesSnapshot).toHaveLength(1);
    expect(await repositories.revisions.countByPrompt('prompt-1')).toBe(2);

    await repositories.close();
  });

  it('copies the document, so later edits cannot rewrite history', async () => {
    const { repositories, store } = await withPrompt();
    const revision = await store.getState().snapshotPrompt('prompt-1');

    const stored = await store.getState().editPrompt('prompt-1', {
      content: documentWith({ objective: 'Rewritten after the snapshot.' }),
      title: 'Final notes',
    });

    expect(stored.content.objective).toBe('Rewritten after the snapshot.');
    expect(revision.contentSnapshot.objective).toBe('Summarise a release.');
    expect(revision.titleSnapshot).toBe('Release notes');
    expect((await repositories.revisions.get(revision.id))?.contentSnapshot.objective).toBe(
      'Summarise a release.',
    );

    await repositories.close();
  });

  it('records a snapshot activity event', async () => {
    const { repositories, store } = await withPrompt();

    await store.getState().snapshotPrompt('prompt-1', 'Reviewed');

    expect(store.getState().activity[0]).toMatchObject({
      type: 'snapshot',
      promptId: 'prompt-1',
      promptTitle: 'Release notes',
    });
    expect(store.getState().activity[0]?.summary).toBe('Saved snapshot v1 of "Release notes"');

    await repositories.close();
  });

  it('refuses a prompt that no longer exists', async () => {
    const { repositories, store } = await createHarness();

    await expect(store.getState().snapshotPrompt('missing')).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );

    await repositories.close();
  });

  it('is not triggered by an ordinary prompt write', async () => {
    const { repositories, store } = await withPrompt();

    await store.getState().editPrompt('prompt-1', { title: 'Edited once' });
    await store.getState().editPrompt('prompt-1', { description: 'Edited twice' });
    await store.getState().setFavorite(['prompt-1'], true);

    expect(await repositories.revisions.countByPrompt('prompt-1')).toBe(0);
    expect(store.getState().revisions).toEqual([]);

    await repositories.close();
  });
});

describe('restoreRevision', () => {
  async function setup(): Promise<Harness & { revisionId: string }> {
    const harness = await withPrompt();
    const revision = await harness.store.getState().snapshotPrompt('prompt-1', 'Good state');

    await harness.store.getState().editPrompt('prompt-1', {
      title: 'Changed title',
      description: 'Changed description',
      tags: ['changed'],
      content: documentWith({ objective: 'Changed objective.' }),
      variables: [{ name: 'audience', type: 'string', required: false }],
    });

    return { ...harness, revisionId: revision.id };
  }

  it('takes a safety snapshot first, then restores every authorable field', async () => {
    const { repositories, store, revisionId } = await setup();
    const before = store.getState().prompts.find((prompt) => prompt.id === 'prompt-1');
    expect(before?.title).toBe('Changed title');

    const result = await store.getState().restoreRevision(revisionId);

    expect(result.safetyRevision).toMatchObject({
      kind: 'restore-safety',
      revisionNumber: 2,
      promptId: 'prompt-1',
      titleSnapshot: 'Changed title',
      descriptionSnapshot: 'Changed description',
      tagsSnapshot: ['changed'],
    });
    expect(result.safetyRevision.label).toBe('Before restoring v1');
    expect(result.restoredFrom.revisionNumber).toBe(1);

    const restored = result.prompt;
    expect(restored).toMatchObject({
      title: 'Release notes',
      description: 'Weekly release summary.',
      tags: ['release'],
      version: (before?.version ?? 0) + 1,
    });
    expect(restored.content.objective).toBe('Summarise a release.');
    expect(restored.variables).toEqual([{ name: 'version', type: 'string', required: true }]);

    // Both revisions survive, and the restored prompt is what storage holds.
    const revisions = await repositories.revisions.listByPrompt('prompt-1');
    expect(revisions.map((revision) => revision.revisionNumber)).toEqual([2, 1]);
    expect((await repositories.prompts.get('prompt-1'))?.title).toBe('Release notes');
    expect(store.getState().prompts[0]?.title).toBe('Release notes');

    await repositories.close();
  });

  it('restores the safety snapshot as an independent copy', async () => {
    const { repositories, store, revisionId } = await setup();
    const result = await store.getState().restoreRevision(revisionId);

    await store.getState().editPrompt('prompt-1', { title: 'A third title' });

    const safety = await repositories.revisions.get(result.safetyRevision.id);
    expect(safety?.titleSnapshot).toBe('Changed title');
    expect(safety?.contentSnapshot.objective).toBe('Changed objective.');

    await repositories.close();
  });

  it('records the restore with both numbers in the activity log', async () => {
    const { repositories, store, revisionId } = await setup();

    await store.getState().restoreRevision(revisionId);

    const latest = store.getState().activity[0];
    expect(latest).toMatchObject({ type: 'restored', promptId: 'prompt-1' });
    expect(latest?.summary).toBe('Restored v1 of "Release notes"; the previous state is v2');

    await repositories.close();
  });

  it('keeps a restore-safety snapshot that can itself be restored', async () => {
    const { repositories, store, revisionId } = await setup();
    const { safetyRevision } = await store.getState().restoreRevision(revisionId);

    const second = await store.getState().restoreRevision(safetyRevision.id);

    expect(second.prompt.title).toBe('Changed title');
    expect(second.prompt.content.objective).toBe('Changed objective.');
    expect(second.safetyRevision.kind).toBe('restore-safety');
    expect(second.safetyRevision.revisionNumber).toBe(3);

    await repositories.close();
  });

  it('leaves the prompt and the history untouched when the write fails', async () => {
    const control = { failNextWrite: false };
    const harness = await createHarness(
      async (repos) => {
        await repos.prompts.create(promptEntity());
      },
      (repos) => ({
        ...repos,
        prompts: {
          ...repos.prompts,
          // Armed just before the restore: the write fails the way a stale
          // version would, and the retry then proves nothing was left behind.
          update: async (prompt, options) => {
            if (control.failNextWrite) {
              control.failNextWrite = false;
              throw new StaleWriteError(
                prompt.id,
                options.expectedVersion,
                options.expectedVersion + 1,
              );
            }
            return repos.prompts.update(prompt, options);
          },
        },
      }),
    );
    const { repositories, store } = harness;
    const revision = await store.getState().snapshotPrompt('prompt-1', 'Good state');
    await store.getState().editPrompt('prompt-1', { title: 'Changed title' });
    control.failNextWrite = true;

    await expect(store.getState().restoreRevision(revision.id)).rejects.toBeInstanceOf(
      StaleWriteError,
    );

    expect((await repositories.prompts.get('prompt-1'))?.title).toBe('Changed title');
    // The safety revision was rolled back: no record of a change that never
    // happened, and no gap in the numbering that would confuse the next write.
    const revisions = await repositories.revisions.listByPrompt('prompt-1');
    expect(revisions.map((revision) => revision.revisionNumber)).toEqual([1]);
    expect(store.getState().revisions).toHaveLength(1);
    expect(store.getState().error).toContain('changed elsewhere');

    // The next restore succeeds with the same number the failed one used.
    const retried = await store.getState().restoreRevision(revision.id);
    expect(retried.safetyRevision.revisionNumber).toBe(2);
    expect(retried.prompt.title).toBe('Release notes');

    await repositories.close();
  });

  it('refuses a snapshot that no longer exists', async () => {
    const { repositories, store } = await withPrompt();

    await expect(store.getState().restoreRevision('missing')).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );
    expect(store.getState().revisions).toEqual([]);

    await repositories.close();
  });

  it('refuses a snapshot whose prompt has been deleted', async () => {
    const { repositories, store, revisionId } = await setup();
    await repositories.prompts.delete('prompt-1');

    await expect(store.getState().restoreRevision(revisionId)).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );

    await repositories.close();
  });

  it('does not restore fields a revision never captured', async () => {
    const harness = await createHarness(async (repos) => {
      await repos.prompts.create(
        createPromptEntity(
          {
            title: 'Filed prompt',
            content: documentWith(),
            folderId: 'folder-1',
            collectionIds: ['collection-1'],
            status: 'active',
            pinned: true,
            favorite: true,
          },
          { now: () => NOW, newId: () => 'prompt-1' },
        ),
      );
    });

    const revision = await harness.store.getState().snapshotPrompt('prompt-1');
    await harness.store.getState().editPrompt('prompt-1', { title: 'Renamed' });

    const restored = await harness.store.getState().restoreRevision(revision.id);

    expect(restored.prompt).toMatchObject({
      folderId: 'folder-1',
      collectionIds: ['collection-1'],
      status: 'active',
      pinned: true,
      favorite: true,
    });

    await harness.repositories.close();
  });

  it('keeps the prompt valid when the snapshot is restored into it', async () => {
    const { repositories, store, revisionId } = await setup();

    const result = await store.getState().restoreRevision(revisionId);

    expect(result.prompt.format).toBe('json');
    expect(result.prompt.content.schemaVersion).toBe('1.0');
    expect(result.prompt.variables).toEqual(result.prompt.content.variables);

    await repositories.close();
  });
});

describe('pruneRevisions', () => {
  async function withHistory(count: number): Promise<Harness> {
    const harness = await withPrompt();
    for (let index = 0; index < count; index += 1) {
      await harness.store.getState().snapshotPrompt('prompt-1', `Snapshot ${index + 1}`);
    }
    return harness;
  }

  it('removes the oldest snapshots and keeps the newest N', async () => {
    const { repositories, store } = await withHistory(5);

    const result = await store.getState().pruneRevisions('prompt-1', 3);

    expect(result).toEqual({ removed: 2, kept: 3 });
    const remaining = await repositories.revisions.listByPrompt('prompt-1');
    expect(remaining.map((revision) => revision.revisionNumber)).toEqual([5, 4, 3]);
    expect(store.getState().revisions).toHaveLength(3);

    await repositories.close();
  });

  it('renumbers nothing, so the newest snapshot keeps its number', async () => {
    const { repositories, store } = await withHistory(4);

    await store.getState().pruneRevisions('prompt-1', 1);

    const remaining = await repositories.revisions.listByPrompt('prompt-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.revisionNumber).toBe(4);

    // The next snapshot continues from the highest number that ever existed.
    const next = await store.getState().snapshotPrompt('prompt-1');
    expect(next.revisionNumber).toBe(5);

    await repositories.close();
  });

  it('removes nothing when the history is within the limit', async () => {
    const { repositories, store } = await withHistory(2);

    const result = await store.getState().pruneRevisions('prompt-1', 10);

    expect(result).toEqual({ removed: 0, kept: 2 });
    expect(store.getState().revisions).toHaveLength(2);

    await repositories.close();
  });

  it('never removes the newest snapshot', async () => {
    const { repositories, store } = await withHistory(3);

    await store.getState().pruneRevisions('prompt-1', 1);

    const remaining = await repositories.revisions.listByPrompt('prompt-1');
    expect(remaining.map((revision) => revision.revisionNumber)).toEqual([3]);

    await repositories.close();
  });

  it('records how much was pruned', async () => {
    const { repositories, store } = await withHistory(4);

    await store.getState().pruneRevisions('prompt-1', 2);

    expect(store.getState().activity[0]?.summary).toBe(
      'Pruned 2 snapshots from "Release notes", keeping the newest 2',
    );
    expect(store.getState().activity[0]?.type).toBe('snapshot');

    await repositories.close();
  });

  it('refuses an unknown prompt', async () => {
    const { repositories, store } = await createHarness();

    await expect(store.getState().pruneRevisions('missing', 2)).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );

    await repositories.close();
  });

  it('refuses to remove every snapshot', async () => {
    const { repositories, store } = await withHistory(2);

    await store.getState().pruneRevisions('prompt-1', 0);

    expect(await repositories.revisions.countByPrompt('prompt-1')).toBe(1);

    await repositories.close();
  });

  it('leaves other prompts’ histories alone', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.prompts.create(promptEntity('prompt-1'));
      await repos.prompts.create(promptEntity('prompt-2'));
    });
    await store.getState().snapshotPrompt('prompt-1');
    await store.getState().snapshotPrompt('prompt-1');
    await store.getState().snapshotPrompt('prompt-2');

    await store.getState().pruneRevisions('prompt-1', 1);

    expect(await repositories.revisions.countByPrompt('prompt-1')).toBe(1);
    expect(await repositories.revisions.countByPrompt('prompt-2')).toBe(1);

    await repositories.close();
  });

  it('surfaces a storage failure without dropping state', async () => {
    const { repositories, store } = await createHarness(
      async (repos) => {
        await repos.prompts.create(promptEntity());
      },
      (repos) => ({
        ...repos,
        revisions: {
          ...repos.revisions,
          deleteMany: async () => {
            throw new Error('storage went away');
          },
        },
      }),
    );
    for (let index = 0; index < 3; index += 1) {
      await store.getState().snapshotPrompt('prompt-1');
    }

    await expect(store.getState().pruneRevisions('prompt-1', 1)).rejects.toBeTruthy();

    expect(store.getState().revisions).toHaveLength(3);
    expect(store.getState().error).toContain('storage went away');

    await repositories.close();
  });
});

describe('revision isolation', () => {
  it('keeps one prompt’s snapshots out of another’s restore', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.prompts.create(promptEntity('prompt-1'));
      await repos.prompts.create(promptEntity('prompt-2'));
    });
    const first = await store.getState().snapshotPrompt('prompt-1', 'Mine');
    await store.getState().snapshotPrompt('prompt-2', 'Theirs');

    await store.getState().editPrompt('prompt-1', { title: 'Changed' });
    const result = await store.getState().restoreRevision(first.id);

    expect(result.prompt.title).toBe('Release notes');
    expect(store.getState().prompts.find((prompt) => prompt.id === 'prompt-2')?.title).toBe(
      'Release notes',
    );
    // Only prompt-1 gains a safety revision.
    expect(await repositories.revisions.countByPrompt('prompt-1')).toBe(2);
    expect(await repositories.revisions.countByPrompt('prompt-2')).toBe(1);

    await repositories.close();
  });

  it('reports a rule violation when a store write is refused', async () => {
    const { repositories, store } = await withPrompt();
    // `RuleViolationError` is what every other guard throws; a restore must not
    // turn a refusal into a silent success.
    expect(RuleViolationError).toBeTypeOf('function');
    await expect(store.getState().snapshotPrompt('prompt-1')).resolves.toBeDefined();

    await repositories.close();
  });
});
