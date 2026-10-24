/**
 * Shared repository contract (TASK-006).
 *
 * One suite, run against every adapter, so the in-memory and IndexedDB
 * implementations cannot drift. Adapter-specific concerns (schema, migrations,
 * corruption repair) live in their own test files.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DuplicateRecordError,
  InvalidWriteError,
  RecordNotFoundError,
  StaleWriteError,
  StorageError,
} from '@/data/db/errors';
import type { PromptQuery, Repositories } from '@/data/repositories/contracts';
import {
  createActivityEvent,
  createCollection,
  createFolder,
  createPrompt,
  createPromptSchema,
  createRevision,
  createSnippet,
  createTemplate,
  createTestCase,
  createDefaultSettings,
} from '@/domain/factories';
import type { ActivityEvent, Folder, Prompt, PromptRevision, PromptTemplate } from '@/domain/types';

function makePrompt(id: string, overrides: Partial<Prompt> = {}): Prompt {
  const prompt = createPrompt(
    { title: `Prompt ${id}` },
    { now: () => new Date('2026-10-24T09:41:07.123Z'), newId: () => id },
  );
  return { ...prompt, ...overrides };
}

function makeRevision(
  id: string,
  promptId: string,
  revisionNumber: number,
  createdAt = '2026-10-24T09:41:07.123Z',
): PromptRevision {
  const prompt = makePrompt(promptId);
  const revision = createRevision(
    prompt,
    { revisionNumber, kind: 'manual' },
    { now: () => new Date(createdAt), newId: () => id },
  );
  return { ...revision, promptId };
}

const now = (): Date => new Date('2026-10-24T09:41:07.123Z');

function makeActivity(id: string, createdAt: string): ActivityEvent {
  return createActivityEvent(
    { type: 'updated', summary: `Event ${id}` },
    { now: () => new Date(createdAt), newId: () => id },
  );
}

export function describeRepositoryContract(
  label: string,
  createRepositories: () => Promise<Repositories>,
): void {
  describe(`${label} repositories`, () => {
    let repos: Repositories;

    beforeEach(async () => {
      repos = await createRepositories();
    });

    afterEach(async () => {
      await repos.close();
    });

    /* ------------------------------------------------------------------ */
    /* Prompts                                                            */
    /* ------------------------------------------------------------------ */

    describe('prompts', () => {
      it('creates, reads, and lists prompts', async () => {
        const prompt = makePrompt('p1');

        await expect(repos.prompts.create(prompt)).resolves.toEqual(prompt);
        await expect(repos.prompts.get('p1')).resolves.toEqual(prompt);
        await expect(repos.prompts.get('missing')).resolves.toBeNull();
        await expect(repos.prompts.list()).resolves.toEqual([prompt]);
      });

      it('rejects duplicate ids', async () => {
        const prompt = makePrompt('p1');
        await repos.prompts.create(prompt);

        await expect(repos.prompts.create(prompt)).rejects.toBeInstanceOf(DuplicateRecordError);
        await expect(repos.prompts.list()).resolves.toHaveLength(1);
      });

      it('returns copies, so callers cannot mutate stored state', async () => {
        const prompt = makePrompt('p1', { tags: ['docs'] });
        await repos.prompts.create(prompt);

        const loaded = await repos.prompts.get('p1');
        if (!loaded) throw new Error('expected a prompt');
        // Deliberately break immutability: stored state must not change.
        (loaded.tags as string[]).push('mutated');
        (loaded as { title: string }).title = 'mutated';

        const reloaded = await repos.prompts.get('p1');
        expect(reloaded?.tags).toEqual(['docs']);
        expect(reloaded?.title).toBe(prompt.title);
      });

      it('orders by updatedAt descending, then id ascending', async () => {
        await repos.prompts.create(makePrompt('b', { updatedAt: '2026-03-01T00:00:00.000Z' }));
        await repos.prompts.create(makePrompt('c', { updatedAt: '2026-01-01T00:00:00.000Z' }));
        await repos.prompts.create(makePrompt('a', { updatedAt: '2026-03-01T00:00:00.000Z' }));
        await repos.prompts.create(makePrompt('d', { updatedAt: '2026-05-01T00:00:00.000Z' }));

        const listed = await repos.prompts.list();
        expect(listed.map((prompt) => prompt.id)).toEqual(['d', 'a', 'b', 'c']);
      });

      it('queries by folder, collection, tag, status, and flags', async () => {
        await repos.prompts.create(
          makePrompt('draft', { folderId: 'f1', tags: ['docs'], collectionIds: ['c1'] }),
        );
        await repos.prompts.create(
          makePrompt('active', {
            folderId: 'f2',
            tags: ['docs', 'release'],
            status: 'active',
            favorite: true,
            pinned: true,
          }),
        );
        await repos.prompts.create(makePrompt('unfiled', { folderId: null, archived: true }));
        await repos.prompts.create(makePrompt('collection', { collectionIds: ['c2'] }));

        const ids = async (query: PromptQuery) =>
          (await repos.prompts.query(query)).map((prompt) => prompt.id).sort();

        expect(await ids({ folderId: 'f1' })).toEqual(['draft']);
        expect(await ids({ folderId: null })).toEqual(['collection', 'unfiled']);
        expect(await ids({ tag: 'docs' })).toEqual(['active', 'draft']);
        expect(await ids({ collectionId: 'c1' })).toEqual(['draft']);
        expect(await ids({ status: 'active' })).toEqual(['active']);
        expect(await ids({ archived: true })).toEqual(['unfiled']);
        expect(await ids({ archived: false })).toEqual(['active', 'collection', 'draft']);
        expect(await ids({ favorite: true })).toEqual(['active']);
        expect(await ids({ pinned: true })).toEqual(['active']);
        expect(await ids({})).toEqual(['active', 'collection', 'draft', 'unfiled']);
      });

      it('combines criteria as a conjunction', async () => {
        await repos.prompts.create(
          makePrompt('match', { folderId: 'f1', tags: ['docs'], favorite: true }),
        );
        await repos.prompts.create(makePrompt('no-tag', { folderId: 'f1', favorite: true }));
        await repos.prompts.create(makePrompt('no-favorite', { folderId: 'f1', tags: ['docs'] }));

        const results = await repos.prompts.query({
          folderId: 'f1',
          tag: 'docs',
          favorite: true,
        });
        expect(results.map((prompt) => prompt.id)).toEqual(['match']);
      });

      it('queries an inclusive updatedAt range', async () => {
        await repos.prompts.create(makePrompt('early', { updatedAt: '2026-01-01T00:00:00.000Z' }));
        await repos.prompts.create(makePrompt('middle', { updatedAt: '2026-02-01T00:00:00.000Z' }));
        await repos.prompts.create(makePrompt('late', { updatedAt: '2026-03-01T00:00:00.000Z' }));

        const inRange = await repos.prompts.query({
          updatedAfter: '2026-02-01T00:00:00.000Z',
          updatedBefore: '2026-03-01T00:00:00.000Z',
        });
        expect(inRange.map((prompt) => prompt.id).sort()).toEqual(['late', 'middle']);

        const after = await repos.prompts.query({ updatedAfter: '2026-02-15T00:00:00.000Z' });
        expect(after.map((prompt) => prompt.id)).toEqual(['late']);
      });

      it('updates under optimistic concurrency', async () => {
        const original = makePrompt('p1', { version: 1 });
        await repos.prompts.create(original);

        const edited: Prompt = { ...original, title: 'Edited', version: 2 };
        await expect(repos.prompts.update(edited, { expectedVersion: 1 })).resolves.toEqual(edited);
        await expect(repos.prompts.get('p1')).resolves.toEqual(edited);
      });

      it('rejects stale writes without touching the stored record', async () => {
        const original = makePrompt('p1', { version: 3, title: 'Stored' });
        await repos.prompts.create(original);

        const stale: Prompt = { ...original, title: 'Mine', version: 2 };
        const failure = repos.prompts.update(stale, { expectedVersion: 1 });

        await expect(failure).rejects.toBeInstanceOf(StaleWriteError);
        await expect(failure).rejects.toMatchObject({
          code: 'stale-write',
          promptId: 'p1',
          expectedVersion: 1,
          actualVersion: 3,
        });

        const stored = await repos.prompts.get('p1');
        expect(stored?.title).toBe('Stored');
        expect(stored?.version).toBe(3);
      });

      it('requires the version to advance by exactly one', async () => {
        const original = makePrompt('p1', { version: 1 });
        await repos.prompts.create(original);

        await expect(
          repos.prompts.update({ ...original, title: 'Same version' }, { expectedVersion: 1 }),
        ).rejects.toBeInstanceOf(InvalidWriteError);

        await expect(
          repos.prompts.update({ ...original, version: 5 }, { expectedVersion: 1 }),
        ).rejects.toBeInstanceOf(InvalidWriteError);

        await expect(repos.prompts.get('p1')).resolves.toEqual(original);
      });

      it('reports a missing prompt on update', async () => {
        await expect(
          repos.prompts.update(makePrompt('ghost', { version: 2 }), { expectedVersion: 1 }),
        ).rejects.toBeInstanceOf(RecordNotFoundError);
      });

      it('writes several prompts in one transaction', async () => {
        const first = makePrompt('p1', { version: 1 });
        const second = makePrompt('p2', { version: 1 });
        await repos.prompts.create(first);
        await repos.prompts.create(second);

        const saved = await repos.prompts.updateMany([
          { prompt: { ...first, title: 'First', version: 2 }, expectedVersion: 1 },
          { prompt: { ...second, title: 'Second', version: 2 }, expectedVersion: 1 },
        ]);

        expect(saved.map((prompt) => prompt.title)).toEqual(['First', 'Second']);
        await expect(repos.prompts.get('p1')).resolves.toMatchObject({
          title: 'First',
          version: 2,
        });
        await expect(repos.prompts.get('p2')).resolves.toMatchObject({
          title: 'Second',
          version: 2,
        });
      });

      it('applies none of a batch when one write is stale', async () => {
        const first = makePrompt('p1', { version: 1 });
        const second = makePrompt('p2', { version: 3 });
        await repos.prompts.create(first);
        await repos.prompts.create(second);

        await expect(
          repos.prompts.updateMany([
            { prompt: { ...first, title: 'First', version: 2 }, expectedVersion: 1 },
            { prompt: { ...second, title: 'Second', version: 4 }, expectedVersion: 1 },
          ]),
        ).rejects.toBeInstanceOf(StaleWriteError);

        await expect(repos.prompts.get('p1')).resolves.toMatchObject({
          title: first.title,
          version: 1,
        });
        await expect(repos.prompts.get('p2')).resolves.toMatchObject({
          title: second.title,
          version: 3,
        });
      });

      it('rejects a batch that targets a missing prompt', async () => {
        const first = makePrompt('p1', { version: 1 });
        await repos.prompts.create(first);

        await expect(
          repos.prompts.updateMany([
            { prompt: { ...first, title: 'First', version: 2 }, expectedVersion: 1 },
            { prompt: makePrompt('ghost', { version: 2 }), expectedVersion: 1 },
          ]),
        ).rejects.toBeInstanceOf(RecordNotFoundError);

        await expect(repos.prompts.get('p1')).resolves.toMatchObject({ version: 1 });
      });

      it('accepts an empty batch without touching storage', async () => {
        await repos.prompts.create(makePrompt('p1'));

        await expect(repos.prompts.updateMany([])).resolves.toEqual([]);
        await expect(repos.prompts.list()).resolves.toHaveLength(1);
      });

      it('deletes idempotently', async () => {
        await repos.prompts.create(makePrompt('p1'));

        await repos.prompts.delete('p1');
        // Deleting again must not throw: cleanup paths call it repeatedly.
        await repos.prompts.delete('p1');

        await expect(repos.prompts.list()).resolves.toEqual([]);
      });

      it("cascades a delete to that prompt's revisions and test cases only", async () => {
        await repos.prompts.create(makePrompt('p1'));
        await repos.prompts.create(makePrompt('p2'));
        await repos.revisions.create(makeRevision('r1', 'p1', 1));
        await repos.revisions.create(makeRevision('r2', 'p1', 2));
        await repos.revisions.create(makeRevision('r3', 'p2', 1));
        await repos.testCases.create(
          createTestCase({ promptId: 'p1', name: 'Keep me' }, { now, newId: () => 'tc1' }),
        );
        await repos.testCases.create(
          createTestCase({ promptId: 'p2', name: 'Survivor' }, { now, newId: () => 'tc2' }),
        );

        await repos.prompts.deleteCascade('p1');

        await expect(repos.prompts.get('p1')).resolves.toBeNull();
        await expect(repos.prompts.get('p2')).resolves.not.toBeNull();
        await expect(repos.revisions.listByPrompt('p1')).resolves.toEqual([]);
        await expect(repos.revisions.listByPrompt('p2')).resolves.toHaveLength(1);
        await expect(repos.testCases.get('tc1')).resolves.toBeNull();
        await expect(repos.testCases.get('tc2')).resolves.not.toBeNull();
      });

      it('deletes several prompts and their dependents in one call', async () => {
        await repos.prompts.create(makePrompt('p1'));
        await repos.prompts.create(makePrompt('p2'));
        await repos.prompts.create(makePrompt('p3'));
        await repos.revisions.create(makeRevision('r1', 'p1', 1));
        await repos.revisions.create(makeRevision('r2', 'p2', 1));
        await repos.testCases.create(
          createTestCase({ promptId: 'p2', name: 'Case' }, { now, newId: () => 'tc2' }),
        );

        await repos.prompts.deleteManyCascade(['p1', 'p2']);

        await expect(repos.prompts.list()).resolves.toMatchObject([{ id: 'p3' }]);
        await expect(repos.revisions.listByPrompt('p1')).resolves.toEqual([]);
        await expect(repos.revisions.listByPrompt('p2')).resolves.toEqual([]);
        await expect(repos.testCases.get('tc2')).resolves.toBeNull();
        // Idempotent, including rows that never existed.
        await expect(
          repos.prompts.deleteManyCascade(['p1', 'never-there']),
        ).resolves.toBeUndefined();
      });

      it('cascades idempotently, including for a prompt that never existed', async () => {
        await repos.prompts.create(makePrompt('p1'));
        await repos.revisions.create(makeRevision('r1', 'p1', 1));

        await repos.prompts.deleteCascade('p1');
        await expect(repos.prompts.deleteCascade('p1')).resolves.toBeUndefined();
        await expect(repos.prompts.deleteCascade('never-there')).resolves.toBeUndefined();
      });
    });

    /* ------------------------------------------------------------------ */
    /* Revisions                                                          */
    /* ------------------------------------------------------------------ */

    describe('revisions', () => {
      it('creates and lists revisions newest first', async () => {
        await repos.revisions.create(makeRevision('r1', 'p1', 1));
        await repos.revisions.create(makeRevision('r3', 'p1', 3));
        await repos.revisions.create(makeRevision('r2', 'p1', 2));
        await repos.revisions.create(makeRevision('other', 'p2', 1));

        const revisions = await repos.revisions.listByPrompt('p1');
        expect(revisions.map((revision) => revision.revisionNumber)).toEqual([3, 2, 1]);
        await expect(repos.revisions.get('r2')).resolves.toMatchObject({ promptId: 'p1' });
        await expect(repos.revisions.get('missing')).resolves.toBeNull();
        await expect(repos.revisions.countByPrompt('p1')).resolves.toBe(3);
      });

      it('rejects duplicate revision numbers for the same prompt only', async () => {
        await repos.revisions.create(makeRevision('r1', 'p1', 1));

        await expect(repos.revisions.create(makeRevision('r1b', 'p1', 1))).rejects.toBeInstanceOf(
          DuplicateRecordError,
        );
        await expect(repos.revisions.create(makeRevision('r2', 'p2', 1))).resolves.toMatchObject({
          promptId: 'p2',
        });
      });

      it('deletes only the revisions of one prompt', async () => {
        await repos.revisions.create(makeRevision('r1', 'p1', 1));
        await repos.revisions.create(makeRevision('r2', 'p1', 2));
        await repos.revisions.create(makeRevision('r3', 'p2', 1));

        await repos.revisions.deleteByPrompt('p1');

        await expect(repos.revisions.listByPrompt('p1')).resolves.toEqual([]);
        await expect(repos.revisions.listByPrompt('p2')).resolves.toHaveLength(1);
      });

      it('copies snapshot data instead of aliasing it', async () => {
        const revision = makeRevision('r1', 'p1', 1);
        await repos.revisions.create(revision);

        (revision.contentSnapshot.instructions as string[]).push('mutated');
        const stored = await repos.revisions.get('r1');
        expect(stored?.contentSnapshot.instructions).not.toContain('mutated');
      });
    });

    /* ------------------------------------------------------------------ */
    /* Named entities                                                     */
    /* ------------------------------------------------------------------ */

    describe('named entities', () => {
      const folder = (id: string, name: string): Folder => ({
        ...createFolder(
          { name },
          { now: () => new Date('2026-01-01T00:00:00.000Z'), newId: () => id },
        ),
        id,
        name,
      });

      it('orders folders by name, case-insensitively', async () => {
        await repos.folders.create(folder('f1', 'zeta'));
        await repos.folders.create(folder('f2', 'Alpha'));
        await repos.folders.create(folder('f3', 'beta'));

        const listed = await repos.folders.list();
        expect(listed.map((item) => item.name)).toEqual(['Alpha', 'beta', 'zeta']);
      });

      it('supports create/get/update/delete for each simple repository', async () => {
        const collection = createCollection(
          { name: 'Writing', description: 'Tone of voice' },
          { now: () => new Date('2026-01-01T00:00:00.000Z'), newId: () => 'c1' },
        );
        const testCase = createTestCase(
          { promptId: 'p1', name: 'Short input', inputValues: { topic: 'release' } },
          { now: () => new Date('2026-01-01T00:00:00.000Z'), newId: () => 't1' },
        );
        const schema = createPromptSchema(
          { name: 'Notes schema', schemaContent: { type: 'object' } },
          { now: () => new Date('2026-01-01T00:00:00.000Z'), newId: () => 's1' },
        );
        const snippet = createSnippet(
          { name: 'Tone block', targetPath: 'context.description', value: 'Concise.' },
          { now: () => new Date('2026-01-01T00:00:00.000Z'), newId: () => 'sn1' },
        );
        const template = createTemplate(
          {
            name: 'Summarizer',
            content: createPrompt({}, { now: () => new Date(), newId: () => 'tmp' }).content,
          },
          { now: () => new Date('2026-01-01T00:00:00.000Z'), newId: () => 'tpl1' },
        );

        const check = async <T extends { id: string }>(
          repository: {
            create: (entity: T) => Promise<T>;
            get: (id: string) => Promise<T | null>;
            update: (entity: T) => Promise<T>;
            delete: (id: string) => Promise<void>;
            list: () => Promise<T[]>;
          },
          entity: T,
          patch: T,
        ) => {
          await expect(repository.create(entity)).resolves.toEqual(entity);
          await expect(repository.get(entity.id)).resolves.toEqual(entity);
          await expect(repository.list()).resolves.toHaveLength(1);
          await expect(repository.update(patch)).resolves.toEqual(patch);
          await expect(repository.get(entity.id)).resolves.toEqual(patch);
          await repository.delete(entity.id);
          await expect(repository.get(entity.id)).resolves.toBeNull();
          await expect(repository.delete(entity.id)).resolves.toBeUndefined();
        };

        await check(repos.collections, collection, { ...collection, description: 'Updated' });
        await check(repos.testCases, testCase, { ...testCase, name: 'Renamed case' });
        await check(repos.schemas, schema, { ...schema, description: 'Updated' });
        await check(repos.snippets, snippet, { ...snippet, value: 'Changed.' });
        await check(repos.templates, template, { ...template, name: 'Renamed template' });
        await check(repos.folders, folder('f9', 'Inbox'), folder('f9', 'Archive'));
      });

      it('rejects duplicate ids and updates of missing records', async () => {
        const collection = createCollection(
          { name: 'Writing' },
          { now: () => new Date('2026-01-01T00:00:00.000Z'), newId: () => 'c1' },
        );
        await repos.collections.create(collection);

        await expect(repos.collections.create(collection)).rejects.toBeInstanceOf(
          DuplicateRecordError,
        );

        const ghost: PromptTemplate = createTemplate(
          {
            name: 'Ghost',
            content: createPrompt({}, { now: () => new Date(), newId: () => 'doc' }).content,
          },
          { now: () => new Date(), newId: () => 'ghost' },
        );
        await expect(repos.templates.update(ghost)).rejects.toBeInstanceOf(RecordNotFoundError);
      });
    });

    /* ------------------------------------------------------------------ */
    /* Activity                                                           */
    /* ------------------------------------------------------------------ */

    describe('activity', () => {
      it('appends and lists newest first', async () => {
        await repos.activity.append(makeActivity('a', '2026-01-01T00:00:00.000Z'));
        await repos.activity.append(makeActivity('c', '2026-03-01T00:00:00.000Z'));
        await repos.activity.append(makeActivity('b', '2026-02-01T00:00:00.000Z'));

        const listed = await repos.activity.list();
        expect(listed.map((event) => event.id)).toEqual(['c', 'b', 'a']);
      });

      it('honours a limit and prunes the oldest entries', async () => {
        await repos.activity.append(makeActivity('a', '2026-01-01T00:00:00.000Z'));
        await repos.activity.append(makeActivity('b', '2026-02-01T00:00:00.000Z'));
        await repos.activity.append(makeActivity('c', '2026-03-01T00:00:00.000Z'));

        const recent = await repos.activity.list(2);
        expect(recent.map((event) => event.id)).toEqual(['c', 'b']);

        await expect(repos.activity.prune(1)).resolves.toBe(2);
        const remaining = await repos.activity.list();
        expect(remaining.map((event) => event.id)).toEqual(['c']);

        await expect(repos.activity.prune(0)).resolves.toBe(1);
        await expect(repos.activity.list()).resolves.toEqual([]);
      });

      it('clears the log and rejects duplicate ids', async () => {
        const event = makeActivity('a', '2026-01-01T00:00:00.000Z');
        await repos.activity.append(event);
        await expect(repos.activity.append(event)).rejects.toBeInstanceOf(DuplicateRecordError);

        await repos.activity.clear();
        await expect(repos.activity.list()).resolves.toEqual([]);
      });
    });

    /* ------------------------------------------------------------------ */
    /* Settings and meta                                                  */
    /* ------------------------------------------------------------------ */

    describe('settings', () => {
      it('starts empty and stores the singleton record', async () => {
        await expect(repos.settings.get()).resolves.toBeNull();

        const settings = createDefaultSettings({ theme: 'light', density: 'compact' });
        await expect(repos.settings.save(settings)).resolves.toEqual(settings);
        await expect(repos.settings.get()).resolves.toEqual(settings);

        const updated = createDefaultSettings({ theme: 'dark' });
        await repos.settings.save(updated);
        await expect(repos.settings.get()).resolves.toEqual(updated);
      });
    });

    describe('meta', () => {
      it('exposes the schema version and tracks the seed version', async () => {
        const meta = await repos.meta.get();
        expect(meta?.seedVersion).toBe(0);
        expect(meta?.dbSchemaVersion).toBeGreaterThanOrEqual(1);

        await expect(repos.meta.getSeedVersion()).resolves.toBe(0);

        await repos.meta.setSeedVersion(3);
        await expect(repos.meta.getSeedVersion()).resolves.toBe(3);
        await expect(repos.meta.get()).resolves.toMatchObject({ seedVersion: 3 });
      });

      it('rejects invalid seed versions', async () => {
        await expect(repos.meta.setSeedVersion(-1)).rejects.toBeInstanceOf(StorageError);
        await expect(repos.meta.setSeedVersion(1.5)).rejects.toBeInstanceOf(StorageError);
        await expect(repos.meta.getSeedVersion()).resolves.toBe(0);
      });
    });
  });
}
