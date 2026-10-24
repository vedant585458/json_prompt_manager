import { describe, expect, it } from 'vitest';

import {
  createLibrarySelector,
  selectCounts,
  selectDashboard,
  selectLibrary,
  selectPromptById,
  selectTagCounts,
} from '@/store/selectors';
import { createPrompt, type CreatePromptInput } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type { ActivityEvent, Prompt } from '@/domain/types';

/** Deterministic prompt: day-of-month sets `updatedAt`, id is `p<day>`. */
function promptOn(day: number, input: CreatePromptInput = {}): Prompt {
  return createPrompt(
    { title: `Prompt ${day}`, ...input },
    {
      now: () => new Date(Date.UTC(2026, 9, day, 12)),
      newId: () => `p${String(day).padStart(2, '0')}`,
    },
  );
}

function activityOn(day: number): ActivityEvent {
  return {
    id: `a${day}`,
    type: 'updated',
    summary: `Event ${day}`,
    createdAt: new Date(Date.UTC(2026, 9, day, 12)).toISOString(),
  };
}

const prompts: readonly Prompt[] = [
  promptOn(1, { title: 'Zebra extraction', tags: ['extraction', 'json'], status: 'active' }),
  promptOn(2, { title: 'alpha summary', description: 'Condenses long threads', tags: ['writing'] }),
  promptOn(3, { title: 'Beta review', tags: ['writing'], favorite: true, pinned: true }),
  promptOn(4, {
    title: 'Archived draft',
    archived: true,
    tags: ['writing'],
    status: 'deprecated',
  }),
  promptOn(5, { title: 'Unfiled idea', folderId: null, collectionIds: ['c1'], status: 'active' }),
];

const inFolder = promptOn(6, { title: 'Filed note', folderId: 'f1', collectionIds: ['c2'] });

describe('selectLibrary', () => {
  it('hides archived prompts by default and shows only them when asked', () => {
    expect(selectLibrary(prompts).map((prompt) => prompt.id)).not.toContain('p04');
    expect(selectLibrary(prompts, { archived: true }).map((prompt) => prompt.title)).toEqual([
      'Archived draft',
    ]);
  });

  it('filters by favourites, pins, folder, collection, tag, and status', () => {
    expect(selectLibrary(prompts, { favoritesOnly: true }).map((p) => p.id)).toEqual(['p03']);
    expect(selectLibrary(prompts, { pinnedOnly: true }).map((p) => p.id)).toEqual(['p03']);
    expect(selectLibrary(prompts, { folderId: null }).map((p) => p.id)).toEqual([
      'p05',
      'p03',
      'p02',
      'p01',
    ]);
    expect(selectLibrary([...prompts, inFolder], { folderId: 'f1' })).toHaveLength(1);
    expect(selectLibrary([...prompts, inFolder], { collectionId: 'c1' }).map((p) => p.id)).toEqual([
      'p05',
    ]);
    expect(selectLibrary(prompts, { tag: 'writing' }).map((p) => p.id)).toEqual(['p03', 'p02']);
    expect(selectLibrary(prompts, { status: 'active' }).map((p) => p.id)).toEqual(['p05', 'p01']);
    expect(selectLibrary(prompts, { status: 'all' })).toHaveLength(4);
  });

  it('searches title, description, and tags case-insensitively', () => {
    expect(selectLibrary(prompts, { search: 'ZEBRA' }).map((p) => p.id)).toEqual(['p01']);
    expect(selectLibrary(prompts, { search: 'threads' }).map((p) => p.id)).toEqual(['p02']);
    expect(selectLibrary(prompts, { search: 'writing' }).map((p) => p.id)).toEqual(['p03', 'p02']);
    expect(selectLibrary(prompts, { search: '   ' })).toHaveLength(4);
    expect(selectLibrary(prompts, { search: 'nothing' })).toEqual([]);
  });

  it('ands every filter together', () => {
    expect(selectLibrary(prompts, { tag: 'writing', status: 'draft' }).map((p) => p.id)).toEqual([
      'p03',
      'p02',
    ]);
  });

  it('orders by updatedAt (default), createdAt, or title without mutating input', () => {
    const copy = [...prompts];

    expect(selectLibrary(prompts).map((p) => p.id)).toEqual(['p05', 'p03', 'p02', 'p01']);
    expect(selectLibrary(prompts, { sort: 'created' }).map((p) => p.id)).toEqual([
      'p05',
      'p03',
      'p02',
      'p01',
    ]);
    expect(selectLibrary(prompts, { sort: 'title' }).map((p) => p.title)).toEqual([
      'alpha summary',
      'Beta review',
      'Unfiled idea',
      'Zebra extraction',
    ]);
    expect(prompts.map((p) => p.id)).toEqual(copy.map((p) => p.id));
  });
});

describe('createLibrarySelector', () => {
  it('returns the same reference for the same inputs and a new one otherwise', () => {
    const select = createLibrarySelector();

    const first = select(prompts, { search: 'writing' });
    expect(select(prompts, { search: 'writing' })).toBe(first);

    expect(select(prompts, { search: 'zebra' })).not.toBe(first);

    const replaced = [...prompts];
    expect(select(replaced, { search: 'writing' })).not.toBe(first);
  });
});

describe('selectPromptById', () => {
  it('finds a prompt or returns null', () => {
    expect(selectPromptById(prompts, 'p02')?.title).toBe('alpha summary');
    expect(selectPromptById(prompts, 'missing')).toBeNull();
    expect(selectPromptById(prompts, null)).toBeNull();
  });
});

describe('selectCounts', () => {
  it('counts by status while excluding archived rows from the working totals', () => {
    expect(selectCounts(prompts)).toEqual({
      all: 5,
      active: 2,
      draft: 2,
      deprecated: 0,
      archived: 1,
      favorites: 1,
      pinned: 1,
    });
  });
});

describe('selectTagCounts', () => {
  it('counts non-archived tags, most used first, then alphabetically', () => {
    expect(selectTagCounts(prompts)).toEqual([
      { tag: 'writing', count: 2 },
      { tag: 'extraction', count: 1 },
      { tag: 'json', count: 1 },
    ]);
    expect(selectTagCounts(prompts, 1)).toEqual([{ tag: 'writing', count: 2 }]);
    expect(selectTagCounts(prompts, 0)).toEqual([]);
  });
});

describe('selectDashboard', () => {
  it('summarizes counts, recency, tags, and activity', () => {
    // One prompt was touched inside the seven-day window, the rest were not.
    const fresh = promptOn(22, { title: 'Fresh note', tags: ['writing'] });
    const summary = selectDashboard([...prompts, fresh], [activityOn(24), activityOn(23)], {
      now: new Date(Date.UTC(2026, 9, 24, 12)),
    });

    expect(summary.total).toBe(6);
    expect(summary.active).toBe(2);
    expect(summary.draft).toBe(3);
    expect(summary.archived).toBe(1);
    expect(summary.updatedThisWeek).toBe(1);
    expect(summary.tagCount).toBe(3);
    expect(summary.activityCount).toBe(2);
    expect(summary.recent.map((p) => p.id)).toEqual(['p22', 'p05', 'p03', 'p02', 'p01']);
    expect(summary.topTags[0]).toEqual({ tag: 'writing', count: 3 });
  });

  it('respects custom limits', () => {
    const summary = selectDashboard(prompts, [], {
      now: new Date(Date.UTC(2026, 9, 24, 12)),
      recentLimit: 2,
      topTagLimit: 1,
    });

    expect(summary.recent).toHaveLength(2);
    expect(summary.topTags).toHaveLength(1);
    expect(summary.activityCount).toBe(0);
  });
});

describe('library filters added in TASK-011', () => {
  function libraryPrompt(
    id: string,
    overrides: CreatePromptInput & { updatedAt?: string } = {},
  ): Prompt {
    const prompt = createPrompt(
      { title: `Prompt ${id}`, ...overrides },
      { now: () => new Date('2026-10-01T09:00:00.000Z'), newId: () => id },
    );

    return overrides.updatedAt ? { ...prompt, updatedAt: overrides.updatedAt } : prompt;
  }

  const collectionPrompts: readonly Prompt[] = [
    libraryPrompt('a', { tags: ['finance', 'legal'], collectionIds: ['c1'] }),
    libraryPrompt('b', { tags: ['finance'], collectionIds: ['c1', 'c2'] }),
    libraryPrompt('c', { tags: ['legal'] }),
  ];

  it('requires every selected tag', () => {
    expect(selectLibrary(collectionPrompts, { tags: ['finance'] }).map((p) => p.id)).toEqual([
      'a',
      'b',
    ]);
    expect(
      selectLibrary(collectionPrompts, { tags: ['finance', 'legal'] }).map((p) => p.id),
    ).toEqual(['a']);
    expect(selectLibrary(collectionPrompts, { tags: ['nope'] })).toEqual([]);
  });

  it('filters by several folders at once', () => {
    const prompts = [
      libraryPrompt('one', { folderId: 'f1' }),
      libraryPrompt('two', { folderId: 'f2' }),
      libraryPrompt('three', { folderId: null }),
    ];

    expect(selectLibrary(prompts, { folderIds: ['f1', 'f2'] }).map((p) => p.id)).toEqual([
      'one',
      'two',
    ]);
    expect(selectLibrary(prompts, { folderId: null }).map((p) => p.id)).toEqual(['three']);
  });

  it('filters by any of several collections, and by having a collection at all', () => {
    expect(selectLibrary(collectionPrompts, { collectionIds: ['c2'] }).map((p) => p.id)).toEqual([
      'b',
    ]);
    expect(selectLibrary(collectionPrompts, { hasCollection: true }).map((p) => p.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('filters by document health using the ids it is given', () => {
    expect(
      selectLibrary(collectionPrompts, {
        documentFilter: { kind: 'unparsable', ids: ['b'] },
      }).map((p) => p.id),
    ).toEqual(['b']);

    expect(
      selectLibrary(collectionPrompts, {
        documentFilter: { kind: 'parsable', ids: ['b'] },
      }).map((p) => p.id),
    ).toEqual(['a', 'c']);
  });

  it('filters by prompts that have a stored revision', () => {
    expect(
      selectLibrary(collectionPrompts, { snapshotPromptIds: ['a', 'c'] }).map((p) => p.id),
    ).toEqual(['a', 'c']);
  });

  it('filters by the last edit date', () => {
    const prompts = [
      libraryPrompt('new', { updatedAt: '2026-10-20T09:00:00.000Z' }),
      libraryPrompt('old', { updatedAt: '2026-09-01T09:00:00.000Z' }),
    ];

    expect(
      selectLibrary(prompts, { updatedAfter: '2026-10-01T00:00:00.000Z' }).map((p) => p.id),
    ).toEqual(['new']);
  });

  it('searches inside the stored JSON document', () => {
    const prompt = createPrompt(
      {
        title: 'Neutral name',
        description: 'Neutral description',
        content: createBlankDocument({
          name: 'Neutral name',
          objective: 'Score the reply with a four point rubric.',
        }),
      },
      { now: () => new Date('2026-10-01T09:00:00.000Z'), newId: () => 'content-hit' },
    );

    expect(selectLibrary([prompt], { search: 'rubric' }).map((p) => p.id)).toEqual(['content-hit']);
  });

  it('excludes archived prompts by default and shows them when asked', () => {
    const prompts = [libraryPrompt('live'), libraryPrompt('archived', { archived: true })];

    expect(selectLibrary(prompts).map((p) => p.id)).toEqual(['live']);
    expect(selectLibrary(prompts, { archived: true }).map((p) => p.id)).toEqual(['archived']);
  });

  it('combines filters (AND) and keeps the sort order stable', () => {
    const prompts = [
      libraryPrompt('first', { tags: ['finance'], status: 'active' }),
      libraryPrompt('second', { tags: ['finance'], status: 'draft' }),
      libraryPrompt('third', { tags: ['legal'], status: 'active' }),
    ];

    expect(
      selectLibrary(prompts, { tags: ['finance'], status: 'active', sort: 'title' }).map(
        (p) => p.id,
      ),
    ).toEqual(['first']);
  });
});
