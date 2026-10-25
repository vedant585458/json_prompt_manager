/**
 * Critical workflow integration suite (TASK-029, tasks.md §10.2).
 *
 * These are the flows the product has to get right, run end to end: the real data
 * store, the real IndexedDB adapter (`fake-indexeddb` provides the engine, not a
 * stub of ours), and a second connection that proves a write actually reached
 * storage rather than a cache.
 *
 * Each test names the promise it checks:
 *
 * 1. a created prompt survives a reconnect and leaves an activity event;
 * 2. an edit is refused when the stored row moved on, and nothing is overwritten;
 * 3. a snapshot → edit → restore keeps a safety revision and does not lose the
 *    newer text;
 * 4. a bulk archive can be undone back to the prior state;
 * 5. an import lands completely, or leaves the library untouched.
 *
 * The planning half of the import flow is unit-tested in `domain/transfer`; this
 * is the database half, which those tests cannot see.
 */

import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openStorage } from '@/data';
import { createDefaultSettings } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import { exportLibrary } from '@/domain/transfer/export';
import { buildImportPlan, readImportFile } from '@/domain/transfer/import';
import { createDataStore, type DataStore } from '@/store/dataStore';
import { fakeClock } from '@/test/clock';
import { buildLibrary } from '@/test/libraryFixture';

const DB_NAME = 'promptforge-critical-flows';

let database: IDBFactory;

beforeEach(() => {
  database = new IDBFactory();
  vi.stubGlobal('indexedDB', database);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A store attached to a fresh database, hydrated and ready. */
async function openStore(name = DB_NAME): Promise<{
  store: DataStore;
  reopen: () => Promise<Awaited<ReturnType<typeof openStorage>>>;
}> {
  const opened = await openStorage({ name });
  if (opened.mode !== 'durable') throw new Error(`expected durable storage, got ${opened.mode}`);

  const store = createDataStore();
  store.getState().attach(opened.repositories, opened.mode);
  await store.getState().hydrate();

  return {
    store,
    // A second connection over the same database: the honest way to ask "did it
    // really persist?" without trusting the store's own cache.
    reopen: () => openStorage({ name }),
  };
}

describe('§10.2.1 a created prompt persists and is recorded', () => {
  it('survives a reconnect and leaves exactly one activity event', async () => {
    const { store, reopen } = await openStore();
    const created = await store.getState().addPrompt({ title: 'Persisted prompt' });

    const reopened = await reopen();
    if (reopened.mode !== 'durable') throw new Error('expected durable storage');

    const stored = await reopened.repositories.prompts.get(created.id);
    expect(stored?.id).toBe(created.id);
    expect(stored?.title).toBe('Persisted prompt');

    const events = await reopened.repositories.activity.list();
    expect(events.filter((event) => event.type === 'created')).toHaveLength(1);
    expect(events[0]?.promptId).toBe(created.id);
  });
});

describe('§10.2.2 an edit is refused when the stored row moved on', () => {
  it('rejects a stale write and leaves the stored text alone', async () => {
    const { store, reopen } = await openStore();
    const created = await store.getState().addPrompt({ title: 'Racing prompt' });

    const reopened = await reopen();
    if (reopened.mode !== 'durable') throw new Error('expected durable storage');

    // Someone else writes first: the row is now at a higher version.
    const current = await reopened.repositories.prompts.get(created.id);
    if (!current) throw new Error('expected the prompt to exist');
    await reopened.repositories.prompts.update(
      { ...current, title: 'Written elsewhere', version: current.version + 1 },
      { expectedVersion: current.version },
    );

    await expect(
      store
        .getState()
        .editPrompt(created.id, { title: 'My stale title' }, { expectedVersion: created.version }),
    ).rejects.toThrow();

    const after = await reopened.repositories.prompts.get(created.id);
    expect(after?.title).toBe('Written elsewhere');
    expect(store.getState().error).not.toBeNull();
  });
});

describe('§10.2.3 a restore keeps a safety revision and the newer text', () => {
  it('snapshots, edits, restores, and leaves both revisions in storage', async () => {
    const { store, reopen } = await openStore();
    const created = await store.getState().addPrompt({ title: 'Versioned prompt' });

    const first = await store.getState().snapshotPrompt(created.id, 'First pass');
    expect(first.revisionNumber).toBe(1);

    // A real edit between the two snapshots, so the restore has something to
    // overwrite and the safety revision has something to preserve.
    const edited = await store.getState().editPrompt(created.id, {
      content: createBlankDocument({ name: 'Versioned prompt', objective: 'Second draft.' }),
      description: 'Changed after the first snapshot.',
    });
    expect(edited.description).toBe('Changed after the first snapshot.');

    const updated = await store.getState().snapshotPrompt(created.id, 'Second pass');
    expect(updated.revisionNumber).toBeGreaterThan(first.revisionNumber);

    const result = await store.getState().restoreRevision(first.id);
    expect(result.prompt.id).toBe(created.id);
    // The safety revision holds the state the restore replaced.
    expect(result.safetyRevision.kind).toBe('restore-safety');
    expect(result.safetyRevision.descriptionSnapshot).toBe('Changed after the first snapshot.');

    const reopened = await reopen();
    if (reopened.mode !== 'durable') throw new Error('expected durable storage');

    const revisions = await reopened.repositories.revisions.listByPrompt(created.id);
    // The safety snapshot is the point: restoring never destroys what it restored
    // over, so the newer state must still be reachable.
    expect(revisions.length).toBeGreaterThanOrEqual(3);
    // Newest first, as the repository contract promises.
    const numbers = revisions.map((revision) => revision.revisionNumber);
    expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
    expect(revisions.some((revision) => revision.kind === 'restore-safety')).toBe(true);
  });
});

describe('§10.2.10 a bulk archive can be undone', () => {
  it('restores every prompt to the state it had before the archive', async () => {
    const fixture = buildLibrary({ prompts: 3 });
    const opened = await openStorage({ name: DB_NAME });
    if (opened.mode !== 'durable') throw new Error('expected durable storage');

    for (const prompt of fixture.prompts) {
      await opened.repositories.prompts.create(prompt);
    }

    const store = createDataStore();
    store.getState().attach(opened.repositories, opened.mode);
    await store.getState().hydrate();

    const ids = fixture.prompts.slice(0, 2).map((prompt) => prompt.id);
    // The undo payload the screen keeps: the exact records from before the write.
    const before = store
      .getState()
      .prompts.filter((prompt) => ids.includes(prompt.id))
      .map((prompt) => ({ ...prompt }));

    await store.getState().setArchived(ids, true);
    expect(store.getState().prompts.filter((p) => p.archived)).toHaveLength(2);

    const restored = await store.getState().restorePrompts(before);
    expect(restored).toBe(2);

    const after = new Map(
      store
        .getState()
        .prompts.filter((prompt) => ids.includes(prompt.id))
        .map((prompt) => [prompt.id, prompt]),
    );
    // The undo puts back the flags and tags it captured; the write itself is
    // still a write, so `updatedAt` and the version move forward.
    for (const snapshot of before) {
      expect(after.get(snapshot.id)?.archived).toBe(snapshot.archived);
      expect(after.get(snapshot.id)?.tags).toEqual([...snapshot.tags]);
    }

    // And it reached storage, not just the cache.
    const persisted = await opened.repositories.prompts.get(ids[0]!);
    expect(persisted?.archived).toBe(false);
  });
});

describe('§10.2.7 an import lands completely or not at all', () => {
  it('writes every record of a valid bundle in one pass', async () => {
    const fixture = buildLibrary({ prompts: 2, folders: true, collection: true });
    const { store, reopen } = await openStore();

    const bundle = exportLibrary(
      {
        prompts: fixture.prompts,
        revisions: fixture.revisions,
        folders: fixture.folders,
        collections: fixture.collections,
        schemas: fixture.schemas,
        snippets: fixture.snippets,
        templates: fixture.templates,
        testCases: fixture.testCases,
      },
      { appVersion: '0.1.0', exportedAt: fixture.clock.iso() },
    );

    const read = readImportFile(bundle.json, {
      deps: fakeClock({ prefix: 'gen' }).deps,
      library: {
        prompts: [],
        revisions: [],
        folders: [],
        collections: [],
        schemas: [],
        snippets: [],
        templates: [],
        testCases: [],
      },
    });
    if (!read.ok) throw new Error(read.failure.message);

    const plan = buildImportPlan(
      read.value,
      {},
      {
        prompts: [],
        revisions: [],
        folders: [],
        collections: [],
        schemas: [],
        snippets: [],
        templates: [],
        testCases: [],
      },
      fakeClock({ prefix: 'gen' }).deps,
    );

    const outcome = await store.getState().applyImport(plan);
    expect(outcome.created).toBe(2);

    const reopened = await reopen();
    if (reopened.mode !== 'durable') throw new Error('expected durable storage');

    expect(await reopened.repositories.prompts.list()).toHaveLength(2);
    expect(await reopened.repositories.folders.list()).toHaveLength(2);
    expect(await reopened.repositories.collections.list()).toHaveLength(1);
    const importedPromptIds = (await reopened.repositories.prompts.list()).map(
      (prompt) => prompt.id,
    );
    const importedRevisions = (
      await Promise.all(
        importedPromptIds.map((id) => reopened.repositories.revisions.listByPrompt(id)),
      )
    ).flat();
    expect(importedRevisions.length).toBeGreaterThan(0);
    expect((await reopened.repositories.activity.list())[0]?.type).toBe('imported');
  });

  it('leaves the library untouched when the file is rejected', async () => {
    const { store, reopen } = await openStore();
    await store.getState().addPrompt({ title: 'Untouched' });

    const rejected = readImportFile('{"format":"promptforge.bundle","version":9}', {
      deps: fakeClock({ prefix: 'gen' }).deps,
    });
    expect(rejected.ok).toBe(false);

    const reopened = await reopen();
    if (reopened.mode !== 'durable') throw new Error('expected durable storage');
    // Nothing was written because nothing was planned: the reader refused first.
    expect(await reopened.repositories.prompts.list()).toHaveLength(1);
    expect(await reopened.repositories.activity.list()).toHaveLength(1);
  });
});

describe('a settings write survives a reconnect', () => {
  it('reads back the record the store saved', async () => {
    const { store, reopen } = await openStore();

    await store.getState().saveSettings({
      ...createDefaultSettings(),
      density: 'comfortable',
      indentSize: 4,
      onboardedAt: '2026-10-25T09:00:00.000Z',
    });

    const reopened = await reopen();
    if (reopened.mode !== 'durable') throw new Error('expected durable storage');

    const settings = await reopened.repositories.settings.get();
    expect(settings?.density).toBe('comfortable');
    expect(settings?.indentSize).toBe(4);
  });
});
