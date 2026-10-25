/**
 * Backup round trip over real storage (TASK-030).
 *
 * The integration promise a user actually relies on: "export everything, lose the
 * browser profile, import the file, and get the same library back". Every other
 * transfer test works on in-memory records; this one writes a full library to
 * IndexedDB, exports it, **deletes the database**, imports the file into a fresh
 * one, and compares what came back field by field.
 *
 * It also pins the documented limits of a backup: `FIDELITY_NOTES` says the
 * activity log, preferences, and drafts are not in a bundle, and that is asserted
 * here so the note cannot drift away from the behaviour.
 */

import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openStorage } from '@/data';
import { createDefaultSettings } from '@/domain/factories';
import { FIDELITY_NOTES, emptyLibrary } from '@/domain/transfer/bundle';
import { exportLibrary } from '@/domain/transfer/export';
import { buildImportPlan, readImportFile } from '@/domain/transfer/import';
import { createDataStore } from '@/store/dataStore';
import { fakeClock } from '@/test/clock';
import { buildLibrary } from '@/test/libraryFixture';

const SOURCE = 'promptforge-round-trip-source';
const TARGET = 'promptforge-round-trip-target';

let factory: IDBFactory;

beforeEach(() => {
  factory = new IDBFactory();
  vi.stubGlobal('indexedDB', factory);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openDurable(name: string) {
  const opened = await openStorage({ name });
  if (opened.mode !== 'durable') throw new Error(`expected durable storage, got ${opened.mode}`);
  // `mode` is a plain string on the boot result, so narrow it here and let the
  // return type be inferred from the checked value.
  return { ...opened, mode: 'durable' as const };
}

async function deleteDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('delete failed'));
    request.onblocked = () =>
      reject(new Error(`deleting ${name} was blocked by an open connection`));
  });
}

describe('a backup restores the library it was taken from', () => {
  it('survives export, database deletion, and import into a fresh install', async () => {
    const fixture = buildLibrary({
      prompts: 4,
      folders: true,
      collection: true,
      history: true,
      archiveLast: true,
    });

    const source = await openDurable(SOURCE);
    const sourceStore = createDataStore();
    sourceStore.getState().attach(source.repositories, source.mode);

    for (const folder of fixture.folders) await source.repositories.folders.create(folder);
    for (const collection of fixture.collections)
      await source.repositories.collections.create(collection);
    for (const schema of fixture.schemas) await source.repositories.schemas.create(schema);
    for (const snippet of fixture.snippets) await source.repositories.snippets.create(snippet);
    for (const template of fixture.templates) await source.repositories.templates.create(template);
    for (const prompt of fixture.prompts) await source.repositories.prompts.create(prompt);
    for (const revision of fixture.revisions) await source.repositories.revisions.create(revision);
    for (const testCase of fixture.testCases) await source.repositories.testCases.create(testCase);

    // Read the library back through the store, which is what the export screen
    // hands to the exporter.
    await sourceStore.getState().hydrate();
    const loaded = sourceStore.getState();
    const library = {
      prompts: loaded.prompts,
      revisions: loaded.revisions,
      folders: loaded.folders,
      collections: loaded.collections,
      schemas: loaded.schemas,
      snippets: loaded.snippets,
      templates: loaded.templates,
      testCases: loaded.testCases,
    };

    const exported = exportLibrary(library, {
      appVersion: '0.1.0',
      exportedAt: fixture.clock.iso(),
    });
    expect(exported.counts.prompts).toBe(4);
    expect(exported.counts.revisions).toBe(4);
    expect(exported.counts.testCases).toBe(4);
    expect(exported.counts.folders).toBe(4);
    expect(exported.counts.collections).toBe(1);
    expect(exported.counts.schemas).toBe(1);
    expect(exported.counts.snippets).toBe(1);

    // The user loses the profile: the database is gone, not just disconnected.
    await source.repositories.close();
    await deleteDatabase(SOURCE);
    await expect(
      openDurable(SOURCE).then((opened) => opened.repositories.prompts.list()),
    ).resolves.toEqual([]);

    // A fresh install imports the file.
    const target = await openDurable(TARGET);
    const targetStore = createDataStore();
    targetStore.getState().attach(target.repositories, target.mode);

    const read = readImportFile(exported.json, { deps: fakeClock().deps });
    if (!read.ok) throw new Error(read.failure.message);

    const plan = buildImportPlan(read.value, {}, emptyLibrary(), fakeClock({ prefix: 'new' }).deps);
    const outcome = await targetStore.getState().applyImport(plan);

    expect(outcome.created).toBe(4);
    expect(outcome.overwritten).toBe(0);
    expect(outcome.skipped).toBe(0);

    const restored = await targetStore.getState().prompts;
    const byTitle = new Map(restored.map((prompt) => [prompt.title, prompt]));

    for (const original of fixture.prompts) {
      const copy = byTitle.get(original.title);
      expect(copy, `${original.title} did not come back`).toBeDefined();
      if (!copy) continue;

      expect(copy.content).toEqual(original.content);
      expect(copy.description).toBe(original.description);
      expect(copy.tags).toEqual([...original.tags]);
      expect(copy.status).toBe(original.status);
      expect(copy.favorite).toBe(original.favorite);
      expect(copy.archived).toBe(original.archived);
      expect(copy.variables).toEqual(original.variables);
      expect(copy.schemaId).toBe(original.schemaId);
      expect(copy.createdAt).toBe(original.createdAt);
    }

    // Membership survived: the folder and collection are re-linked by name.
    const folders = await target.repositories.folders.list();
    const collections = await target.repositories.collections.list();
    expect(folders.map((folder) => folder.name).sort()).toEqual(
      fixture.folders.map((folder) => folder.name).sort(),
    );
    expect(collections.map((collection) => collection.name)).toEqual(
      fixture.collections.map((collection) => collection.name),
    );
    expect(restored.filter((prompt) => prompt.collectionIds.length === 1)).toHaveLength(4);

    // History and test cases came along.
    const revisions = await Promise.all(
      restored.map((prompt) => target.repositories.revisions.listByPrompt(prompt.id)),
    );
    expect(revisions.flat().filter((revision) => revision.kind === 'manual')).toHaveLength(4);
    expect(await target.repositories.testCases.list()).toHaveLength(4);

    // Schemas and snippets came along once, not once per prompt.
    expect(await target.repositories.schemas.list()).toHaveLength(1);
    expect(await target.repositories.snippets.list()).toHaveLength(1);

    await target.repositories.close();
  }, 30_000);

  it('does not put the activity log or preferences in a bundle, as the notes say', async () => {
    const fixture = buildLibrary({ prompts: 1 });
    const source = await openDurable(`${SOURCE}-notes`);
    const store = createDataStore();
    store.getState().attach(source.repositories, source.mode);
    await store.getState().addPrompt({ title: 'Recorded prompt' });
    await store.getState().saveSettings({ ...createDefaultSettings(), onboardedAt: null });

    const loaded = store.getState();
    const exported = exportLibrary(
      {
        prompts: loaded.prompts,
        revisions: loaded.revisions,
        folders: loaded.folders,
        collections: loaded.collections,
        schemas: loaded.schemas,
        snippets: loaded.snippets,
        templates: loaded.templates,
        testCases: loaded.testCases,
      },
      { appVersion: '0.1.0', exportedAt: fixture.clock.iso() },
    );

    const written = JSON.parse(exported.json) as Record<string, unknown>;
    expect(Object.keys(written)).not.toContain('activity');
    expect(Object.keys(written)).not.toContain('settings');
    expect(exported.bundle.manifest.fidelity).toEqual([...FIDELITY_NOTES]);
    expect(FIDELITY_NOTES.join(' ')).toMatch(/Not included: activity log, preferences/);

    // The source library did have activity and settings, so this is a real
    // omission from the file and not an empty library in disguise.
    expect((await source.repositories.activity.list()).length).toBeGreaterThan(0);
    expect(await source.repositories.settings.get()).not.toBeNull();

    await source.repositories.close();
  }, 20_000);

  it('keeps the source library intact when an import is rejected', async () => {
    const source = await openDurable(`${SOURCE}-reject`);
    const store = createDataStore();
    store.getState().attach(source.repositories, source.mode);
    await store.getState().addPrompt({ title: 'Kept' });

    const rejected = readImportFile(
      '{"format":"promptforge.bundle","version":1,"prompts":"nope"}',
      {
        deps: fakeClock().deps,
      },
    );
    expect(rejected.ok).toBe(false);

    await store.getState().hydrate();
    expect(store.getState().prompts.map((prompt) => prompt.title)).toEqual(['Kept']);
    await source.repositories.close();
  }, 20_000);
});
