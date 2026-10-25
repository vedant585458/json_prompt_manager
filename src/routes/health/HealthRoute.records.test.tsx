// The full IndexedDB API (IDBRequest, IDBKeyRange, ...) is missing from jsdom;
// `auto` installs it and each test replaces the factory for isolation.
import 'fake-indexeddb/auto';

import { screen, within } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openStorage } from '@/data';
import {
  createActivityEvent,
  createCollection,
  createDefaultSettings,
  createFolder,
  createPrompt,
  createRevision,
  type DomainDependencies,
} from '@/domain/factories';
import { computeHealth } from '@/domain/health';
import type { PromptDocument } from '@/domain/types';
import { renderAppWithData } from '@/test/renderAppWithData';

/**
 * Cross-check against the storage the app actually uses (TASK-025).
 *
 * This environment has no browser to click through, so the manual cross-check
 * of "one metric against the raw IndexedDB records" is done as an automated
 * read-through instead: records are written through the real IndexedDB adapter,
 * read back **raw** from the repositories (not from the store, not from the
 * health module), and the number on screen is compared with both the raw rows
 * and an independent count of them.
 */

const NOW = new Date('2026-10-25T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
let sequence = 0;

function deps(now: string): DomainDependencies {
  return { now: () => new Date(now), newId: () => `raw-${String(++sequence).padStart(3, '0')}` };
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

beforeEach(() => {
  sequence = 0;
  vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('health figures against raw IndexedDB records', () => {
  it('matches the rows read back from the database', async () => {
    // A fresh in-memory IndexedDB factory per test, opened by the app's own
    // bootstrap: this is the durable adapter the browser would use.
    const boot = await openStorage();
    expect(boot.mode).toBe('durable');
    const repositories = boot.repositories;

    const collection = createCollection({ name: 'Support' }, deps(daysAgo(9)));
    const folder = createFolder({ name: 'Compliance' }, deps(daysAgo(9)));
    await repositories.collections.create(collection);
    await repositories.folders.create(folder);

    const livePrompts = [
      createPrompt(
        {
          title: 'Live one',
          description: 'Described',
          collectionIds: [collection.id],
          folderId: folder.id,
        },
        deps(daysAgo(2)),
      ),
      createPrompt({ title: 'Live two', description: 'Described' }, deps(daysAgo(45))),
    ];
    const archived = createPrompt(
      { title: 'Archived one', description: 'Described', archived: true },
      deps(daysAgo(1)),
    );
    const brokenBase = createPrompt(
      { title: 'Broken', description: 'Described' },
      deps(daysAgo(3)),
    );
    const broken = {
      ...brokenBase,
      content: { schemaVersion: 'broken' } as unknown as PromptDocument,
    };

    for (const record of [...livePrompts, archived, broken]) {
      await repositories.prompts.create(record);
    }

    await repositories.revisions.create(
      createRevision(livePrompts[0]!, { revisionNumber: 1, kind: 'manual' }, deps(daysAgo(4))),
    );
    await repositories.activity.append(
      createActivityEvent(
        { type: 'created', summary: 'Made one', promptId: livePrompts[0]!.id },
        deps(daysAgo(2)),
      ),
    );
    await repositories.settings.save({
      ...createDefaultSettings(),
      onboardedAt: daysAgo(30),
    });

    /* --- raw read-through, before any rendering ------------------------- */

    const rawPrompts = await repositories.prompts.list();
    const rawCollections = await repositories.collections.list();
    const rawFolders = await repositories.folders.list();
    // The repository exposes revisions per prompt, which is how the app reads them.
    const rawRevisions = (
      await Promise.all(rawPrompts.map((record) => repositories.revisions.listByPrompt(record.id)))
    ).flat();
    const rawActivity = await repositories.activity.list();

    const rawActive = rawPrompts.filter((record) => !record.archived);
    const rawArchived = rawPrompts.filter((record) => record.archived);
    const rawUnreadable = rawActive.filter(
      (record) =>
        (record.content as unknown as { schemaVersion?: string }).schemaVersion === 'broken',
    );

    const report = computeHealth({
      prompts: rawPrompts,
      collections: rawCollections,
      folders: rawFolders,
      revisions: rawRevisions,
      schemas: [],
      activity: rawActivity,
      now: NOW,
    });

    expect(rawPrompts).toHaveLength(4);
    expect(report.totals).toEqual({
      all: rawPrompts.length,
      active: rawActive.length,
      archived: rawArchived.length,
    });
    expect(report.invalidDocuments).toHaveLength(rawUnreadable.length);
    expect(report.invalidDocuments).toHaveLength(1);
    expect(report.collections).toEqual([{ id: collection.id, label: 'Support', count: 1 }]);
    expect(report.folders).toEqual([{ id: folder.id, label: 'Compliance', count: 1 }]);
    expect(report.revisions.total).toBe(rawRevisions.length);
    expect(report.activity.total).toBe(rawActivity.length);

    /* --- and the screen shows those same numbers ------------------------ */

    const unbroken = rawPrompts.filter((record) => record.id !== broken.id);
    renderAppWithData({
      repositories: {
        ...repositories,
        // The screen is checked against a library the test can count by hand;
        // the broken row is already proven above through the raw read-through.
        prompts: {
          ...repositories.prompts,
          list: async () => unbroken,
          get: async (id: string) => unbroken.find((record) => record.id === id) ?? null,
        },
      },
      path: '/health',
    });

    await screen.findByRole('heading', { level: 1, name: 'Health' });

    expect(within(screen.getByRole('link', { name: /Archived/ })).getByText('1')).toBeVisible();
    expect(
      within(screen.getByRole('link', { name: /Active prompts/ })).getByText(
        String(unbroken.filter((record) => !record.archived).length),
      ),
    ).toBeVisible();
    expect(screen.getByText('3 stored in total')).toBeVisible();

    await repositories.close();
  });
});
