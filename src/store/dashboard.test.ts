import { describe, expect, it } from 'vitest';

import {
  createActivityEvent,
  createCollection,
  createPrompt,
  createPromptSchema,
  createRevision,
  createTemplate,
} from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type {
  ActivityEvent,
  Prompt,
  PromptDocument,
  PromptSchema,
  PromptTemplate,
} from '@/domain/types';
import {
  DASHBOARD_LIMITS,
  STALE_AFTER_DAYS,
  describeDashboardSummary,
  findDocumentProblems,
  selectAttention,
  selectDashboardData,
} from '@/store/dashboard';

const NOW = new Date('2026-10-24T10:00:00.000Z');
let sequence = 0;

const deps = {
  now: () => NOW,
  newId: () => `fixture-${++sequence}`,
};

function makePrompt(overrides: {
  title: string;
  updatedAt?: string;
  archived?: boolean;
  favorite?: boolean;
  pinned?: boolean;
  tags?: readonly string[];
  content?: unknown;
  status?: Prompt['status'];
}): Prompt {
  const base = createPrompt({ title: overrides.title, tags: overrides.tags ?? [] }, deps);
  return {
    ...base,
    archived: overrides.archived ?? false,
    favorite: overrides.favorite ?? false,
    pinned: overrides.pinned ?? false,
    status: overrides.status ?? 'active',
    ...(overrides.updatedAt ? { updatedAt: overrides.updatedAt } : {}),
    ...(overrides.content === undefined ? {} : { content: overrides.content as PromptDocument }),
  };
}

function makeTemplate(name: string, isBuiltIn: boolean): PromptTemplate {
  return createTemplate({ name, content: createBlankDocument({ name }), isBuiltIn }, deps);
}

function makeActivity(summary: string, createdAt: string, type: ActivityEvent['type'] = 'created') {
  return {
    ...createActivityEvent({ type, summary }, deps),
    createdAt,
  } satisfies ActivityEvent;
}

describe('dashboard counts', () => {
  it('derives every count from stored records', () => {
    sequence = 0;
    const prompts = [
      makePrompt({ title: 'Live one', favorite: true, pinned: true }),
      makePrompt({ title: 'Live two' }),
      makePrompt({ title: 'Archived one', archived: true, favorite: true }),
      makePrompt({ title: 'Archived two', archived: true }),
    ];
    const revisions = [
      createRevision(prompts[0] as Prompt, { revisionNumber: 1, kind: 'manual' }, deps),
      createRevision(prompts[0] as Prompt, { revisionNumber: 2, kind: 'manual' }, deps),
    ];

    const data = selectDashboardData({
      prompts,
      collections: [createCollection({ name: 'Starter kit' }, deps)],
      templates: [
        makeTemplate('Extraction', true),
        makeTemplate('Review', true),
        makeTemplate('Mine', false),
      ],
      revisions,
      activity: [],
      now: NOW,
    });

    expect(data.counts).toEqual({
      total: 2,
      active: 2,
      favorites: 1,
      archived: 2,
      collections: 1,
      snapshots: 2,
      invalidDocuments: 0,
      schemaMismatches: 0,
      templates: 3,
    });
    expect(data.isEmpty).toBe(false);
  });

  it('reports an empty library honestly', () => {
    const data = selectDashboardData({
      prompts: [],
      collections: [],
      templates: [],
      revisions: [],
      activity: [],
      now: NOW,
    });

    expect(data.counts).toEqual({
      total: 0,
      active: 0,
      favorites: 0,
      archived: 0,
      collections: 0,
      snapshots: 0,
      invalidDocuments: 0,
      schemaMismatches: 0,
      templates: 0,
    });
    expect(data.recent).toEqual([]);
    expect(data.pinned).toEqual([]);
    expect(data.favorites).toEqual([]);
    expect(data.attention).toEqual([]);
    expect(data.activity).toEqual([]);
    expect(data.isEmpty).toBe(true);
  });

  it('stays correct with many prompts', () => {
    sequence = 0;
    const prompts = Array.from({ length: 250 }, (_value, index) =>
      makePrompt({
        title: `Prompt ${index}`,
        updatedAt: new Date(NOW.getTime() - index * 60_000).toISOString(),
        archived: index % 10 === 0,
      }),
    );

    const data = selectDashboardData({
      prompts,
      collections: [],
      templates: [],
      revisions: [],
      activity: [],
      now: NOW,
    });

    expect(data.counts.total).toBe(225);
    expect(data.counts.archived).toBe(25);
    expect(data.recent).toHaveLength(DASHBOARD_LIMITS.recent);
    expect(data.recent.every((prompt) => !prompt.archived)).toBe(true);
  });
});

describe('dashboard lists', () => {
  const prompts = Array.from({ length: 8 }, (_value, index) =>
    makePrompt({
      title: `Prompt ${index}`,
      updatedAt: new Date(NOW.getTime() - index * 60 * 60_000).toISOString(),
      favorite: index < 3,
      pinned: index < 2,
    }),
  );

  const base = {
    prompts,
    collections: [],
    templates: [],
    revisions: [],
    activity: [],
    now: NOW,
  } as const;

  it('lists the most recently edited live prompts first', () => {
    const data = selectDashboardData(base);
    expect(data.recent.map((prompt) => prompt.title)).toEqual([
      'Prompt 0',
      'Prompt 1',
      'Prompt 2',
      'Prompt 3',
      'Prompt 4',
    ]);
  });

  it('lists pinned and favorite prompts separately, live only', () => {
    const data = selectDashboardData(base);
    expect(data.pinned.map((prompt) => prompt.title)).toEqual(['Prompt 0', 'Prompt 1']);
    expect(data.favorites.map((prompt) => prompt.title)).toEqual([
      'Prompt 0',
      'Prompt 1',
      'Prompt 2',
    ]);
  });

  it('excludes archived prompts from recents, pinned, and favorites', () => {
    const data = selectDashboardData({
      ...base,
      prompts: [
        makePrompt({ title: 'Archived', archived: true, favorite: true, pinned: true }),
        makePrompt({ title: 'Live' }),
      ],
    });

    expect(data.recent.map((prompt) => prompt.title)).toEqual(['Live']);
    expect(data.pinned).toEqual([]);
    expect(data.favorites).toEqual([]);
  });

  it('previews built-in templates first', () => {
    const data = selectDashboardData({
      ...base,
      templates: [
        makeTemplate('Zeta', true),
        makeTemplate('Alpha', false),
        makeTemplate('Beta', true),
        makeTemplate('Gamma', true),
      ],
    });

    expect(data.templates.map((template) => template.name)).toEqual(['Beta', 'Gamma', 'Zeta']);
    expect(data.counts.templates).toBe(4);
  });

  it('shows the most recent activity, newest first', () => {
    const activity = Array.from({ length: 10 }, (_value, index) =>
      makeActivity(
        `Event ${index}`,
        new Date(NOW.getTime() - index * 60_000).toISOString(),
        index % 2 === 0 ? 'created' : 'updated',
      ),
    );

    const data = selectDashboardData({ ...base, activity });

    expect(data.activity).toHaveLength(DASHBOARD_LIMITS.activity);
    expect(data.activity.map((event) => event.summary)).toEqual([
      'Event 0',
      'Event 1',
      'Event 2',
      'Event 3',
      'Event 4',
      'Event 5',
      'Event 6',
      'Event 7',
    ]);
  });
});

describe('document problems', () => {
  it('parses stored content and reports only real failures', () => {
    sequence = 0;
    const prompts = [
      makePrompt({ title: 'Healthy' }),
      makePrompt({ title: 'Broken', content: { schemaVersion: '1.0' } }),
      makePrompt({ title: 'Also broken', content: { nope: true } }),
    ];

    const problems = findDocumentProblems(prompts);

    expect(problems).toHaveLength(2);
    expect(problems.map((problem) => problem.title)).toEqual(['Also broken', 'Broken']);
    expect(problems[0]?.path.length).toBeGreaterThan(0);
    expect(problems[0]?.message.length).toBeGreaterThan(0);
  });

  it('feeds the invalid count and the attention list', () => {
    sequence = 0;
    const prompts = [
      makePrompt({ title: 'Healthy' }),
      makePrompt({ title: 'Broken', content: { schemaVersion: '1.0' } }),
    ];

    const data = selectDashboardData({
      prompts,
      collections: [],
      templates: [],
      revisions: [],
      activity: [],
      now: NOW,
    });

    expect(data.counts.invalidDocuments).toBe(1);
    expect(data.attention[0]).toMatchObject({
      kind: 'invalid-document',
      promptId: prompts[1]?.id,
      title: 'Broken',
    });
  });

  it('flags stale prompts after the threshold and ignores archived ones', () => {
    sequence = 0;
    const old = new Date(
      NOW.getTime() - (STALE_AFTER_DAYS + 1) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const prompts = [
      makePrompt({ title: 'Stale live', updatedAt: old }),
      makePrompt({ title: 'Stale archived', updatedAt: old, archived: true }),
      makePrompt({ title: 'Fresh', updatedAt: NOW.toISOString() }),
    ];

    const attention = selectAttention(prompts, findDocumentProblems(prompts), NOW);

    expect(attention.map((item) => item.title)).toEqual(['Stale live']);
    expect(attention[0]?.detail).toContain(String(STALE_AFTER_DAYS));
  });

  it('caps the attention list and puts broken documents first', () => {
    sequence = 0;
    const old = new Date(
      NOW.getTime() - (STALE_AFTER_DAYS + 3) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const prompts = [
      ...Array.from({ length: 4 }, (_value, index) =>
        makePrompt({ title: `Stale ${index}`, updatedAt: old }),
      ),
      makePrompt({ title: 'Broken', content: { schemaVersion: '1.0' } }),
    ];

    const attention = selectAttention(prompts, findDocumentProblems(prompts), NOW);

    expect(attention).toHaveLength(DASHBOARD_LIMITS.attention);
    expect(attention[0]?.kind).toBe('invalid-document');
    expect(attention.filter((item) => item.kind === 'stale')).toHaveLength(4);
  });

  it('handles unreadable timestamps without marking them stale', () => {
    sequence = 0;
    const prompts = [makePrompt({ title: 'Weird', updatedAt: 'not-a-date' })];

    expect(selectAttention(prompts, findDocumentProblems(prompts), NOW)).toEqual([]);
  });
});

describe('dashboard summary', () => {
  const base = {
    total: 0,
    active: 0,
    favorites: 0,
    archived: 0,
    collections: 0,
    snapshots: 0,
    invalidDocuments: 0,
    schemaMismatches: 0,
    templates: 0,
  };

  it('describes an empty library without inventing content', () => {
    expect(describeDashboardSummary(base)).toBe(
      'Your library is empty — the fastest way in is a template.',
    );
  });

  it('pluralises counts and reports parse failures as facts', () => {
    expect(
      describeDashboardSummary({ ...base, total: 4, collections: 2, invalidDocuments: 2 }),
    ).toBe('4 prompts across 2 collections. 2 documents will not parse and need a fix.');

    expect(
      describeDashboardSummary({ ...base, total: 1, collections: 1, invalidDocuments: 1 }),
    ).toBe('1 prompt across 1 collection. 1 document will not parse and needs a fix.');
  });

  it('never calls a parsing document a good prompt', () => {
    const summary = describeDashboardSummary({ ...base, total: 2 });
    expect(summary).toBe('2 prompts and no collections yet. Every stored document parses.');
    expect(summary).not.toMatch(/quality|good|valid prompt/i);
  });
});

describe('schema mismatches on the dashboard (TASK-016)', () => {
  const schema: PromptSchema = createPromptSchema(
    {
      name: 'Needs an objective',
      schemaContent: {
        type: 'object',
        required: ['objective'],
        properties: { objective: { type: 'string', minLength: 10 } },
      },
    },
    { ...deps, newId: () => 'schema-1' },
  );

  function attached(id: string, title: string, objective: string): Prompt {
    const prompt = makePrompt({ title, content: createBlankDocument({ name: title, objective }) });
    return { ...prompt, id, schemaId: schema.id };
  }

  it('counts prompts whose document fails an attached schema', () => {
    const data = selectDashboardData({
      prompts: [attached('a', 'Short one', 'nope'), attached('b', 'Long one', 'A full objective.')],
      collections: [],
      templates: [],
      revisions: [],
      activity: [],
      schemas: [schema],
      now: NOW,
    });

    expect(data.counts.schemaMismatches).toBe(1);
    expect(data.counts.invalidDocuments).toBe(0);
  });

  it('does not count schemas when none are supplied, and never guesses', () => {
    const data = selectDashboardData({
      prompts: [attached('a', 'Short one', 'nope')],
      collections: [],
      templates: [],
      revisions: [],
      activity: [],
      now: NOW,
    });

    expect(data.counts.schemaMismatches).toBe(0);
  });

  it('puts a schema mismatch in the attention list, after parse failures', () => {
    const data = selectDashboardData({
      prompts: [attached('a', 'Short one', 'nope')],
      collections: [],
      templates: [],
      revisions: [],
      activity: [],
      schemas: [schema],
      now: NOW,
    });

    expect(data.attention[0]).toMatchObject({ kind: 'schema-mismatch', title: 'Short one' });
    expect(data.attention[0]?.detail).toMatch(
      /Needs an objective: 1 schema error, first at \$\.objective/,
    );
  });

  it('puts structural findings in the attention list, after schema mismatches', () => {
    const data = selectDashboardData({
      prompts: [attached('a', 'Short one', 'nope'), makePrompt({ title: 'Needs a review' })],
      collections: [],
      templates: [],
      revisions: [],
      activity: [],
      schemas: [schema],
      quality: [
        {
          promptId: 'b',
          title: 'Needs a review',
          updatedAt: NOW.toISOString(),
          errors: 0,
          warnings: 2,
        },
      ],
      now: NOW,
    });

    expect(data.attention.map((item) => item.kind)).toEqual([
      'schema-mismatch',
      'quality-findings',
    ]);
    expect(data.attention[1]).toMatchObject({
      id: 'quality:b',
      promptId: 'b',
      title: 'Needs a review',
      detail: '2 structural findings in the inspector',
    });
  });

  it('keeps findings behind stale prompts only when there is no room', () => {
    const data = selectDashboardData({
      prompts: [],
      collections: [],
      templates: [],
      revisions: [],
      activity: [],
      quality: [
        {
          promptId: 'b',
          title: 'Needs a review',
          updatedAt: NOW.toISOString(),
          errors: 1,
          warnings: 0,
        },
      ],
      now: NOW,
    });

    expect(data.attention).toHaveLength(1);
    expect(data.attention[0]?.detail).toBe('1 structural finding in the inspector');
  });

  it('mentions schema failures in the header summary', () => {
    expect(
      describeDashboardSummary({
        total: 1,
        active: 1,
        favorites: 0,
        archived: 0,
        collections: 0,
        snapshots: 0,
        invalidDocuments: 0,
        schemaMismatches: 1,
        templates: 0,
      }),
    ).toBe(
      '1 prompt and no collections yet. Every stored document parses. 1 document fails an attached schema.',
    );
  });
});
