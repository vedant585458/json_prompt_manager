import { describe, expect, it } from 'vitest';

import {
  createActivityEvent,
  createCollection,
  createFolder,
  createPrompt,
  createPromptSchema,
  createRevision,
  type DomainDependencies,
} from '@/domain/factories';
import {
  DEFAULT_HEALTH_THRESHOLDS,
  HEALTH_THRESHOLD_RANGE,
  computeHealth,
  describeCount,
  describeHealth,
  describeHealthThresholds,
  describeStorage,
  findDocumentProblems,
  formatBytes,
  normalizeHealthThresholds,
  scanStoredDocuments,
  type HealthInput,
  type HealthReport,
} from '@/domain/health';
import { createBlankDocument } from '@/domain/promptDocument';
import { PROMPT_DOCUMENT_SCHEMA_VERSION } from '@/domain/types';
import type {
  ActivityEvent,
  Collection,
  Folder,
  HealthThresholds,
  Prompt,
  PromptDocument,
  PromptRevision,
  PromptSchema,
} from '@/domain/types';

/**
 * Health metric tests (TASK-025).
 *
 * Two kinds of test live here. The targeted ones pin down each definition with a
 * hand-built library. The property-style ones generate libraries and compare the
 * report against a second, deliberately dull recomputation — a loop per metric —
 * so a metric can only pass by agreeing with the records rather than with
 * another copy of the same helper.
 */

const NOW = new Date('2026-10-25T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

let sequence = 0;

function deps(now = '2026-10-20T09:00:00.000Z'): DomainDependencies {
  return { now: () => new Date(now), newId: () => `fixture-${++sequence}` };
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

interface PromptOptions {
  readonly title: string;
  readonly description?: string;
  readonly archived?: boolean;
  readonly updatedAt?: string;
  readonly content?: PromptDocument;
  readonly collectionIds?: readonly string[];
  readonly folderId?: string | null;
  readonly schemaId?: string | null;
}

function prompt(options: PromptOptions): Prompt {
  return createPrompt(
    {
      title: options.title,
      description: options.description ?? `${options.title} description`,
      ...(options.content ? { content: options.content } : {}),
      ...(options.collectionIds ? { collectionIds: options.collectionIds } : {}),
      ...(options.folderId ? { folderId: options.folderId } : {}),
      ...(options.schemaId ? { schemaId: options.schemaId } : {}),
      archived: options.archived ?? false,
    },
    deps(options.updatedAt ?? daysAgo(1)),
  );
}

/** A document whose stored content cannot be read back. */
function brokenPrompt(title: string, options: Partial<PromptOptions> = {}): Prompt {
  // Built as a valid record first, then given content the parser rejects — the
  // factory normalises documents, which is the point of it.
  const base = createPrompt(
    { title, description: `${title} description`, archived: options.archived ?? false },
    deps(options.updatedAt ?? daysAgo(1)),
  );
  return { ...base, content: { schemaVersion: 'not-a-version' } as unknown as PromptDocument };
}

function documentWith(overrides: {
  instructions?: readonly string[];
  variables?: readonly { name: string; required?: boolean }[];
  description?: string;
}): PromptDocument {
  return createBlankDocument({
    name: 'Fixture',
    ...(overrides.instructions ? { instructions: [...overrides.instructions] } : {}),
    ...(overrides.variables
      ? {
          variables: overrides.variables.map((variable) => ({
            name: variable.name,
            type: 'string' as const,
            required: variable.required ?? true,
          })),
        }
      : {}),
  });
}

function input(overrides: Partial<HealthInput> = {}): HealthInput {
  return {
    prompts: [],
    collections: [],
    folders: [],
    revisions: [],
    schemas: [],
    activity: [],
    now: NOW,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Targeted cases                                                             */
/* -------------------------------------------------------------------------- */

describe('computeHealth totals and scope', () => {
  it('reports an empty library as empty rather than failing', () => {
    const report = computeHealth(input());

    expect(report.totals).toEqual({ all: 0, active: 0, archived: 0 });
    expect(report.collections).toEqual([]);
    expect(report.folders).toEqual([]);
    expect(report.invalidDocuments).toEqual([]);
    expect(report.schemaMismatches).toEqual([]);
    expect(report.unresolvedVariables).toEqual([]);
    expect(report.unusedVariables).toEqual([]);
    expect(report.missingDescriptions).toEqual([]);
    expect(report.stale.attention).toEqual([]);
    expect(report.revisions).toEqual({ total: 0, promptsWithHistory: 0, newestAt: null });
    expect(report.activity).toEqual({ total: 0, newestAt: null });
    expect(report.oldestEdit).toBeNull();
    expect(report.newestEdit).toBeNull();
    expect(report.computedAt).toBe(NOW.toISOString());
    expect(report.thresholds).toEqual(DEFAULT_HEALTH_THRESHOLDS);
  });

  it('counts archived prompts in the totals but keeps them out of the work lists', () => {
    const live = prompt({ title: 'Live', description: 'Has one' });
    const archived = prompt({ title: 'Archived', archived: true, description: 'Has one' });

    const report = computeHealth(input({ prompts: [live, archived] }));

    expect(report.totals).toEqual({ all: 2, active: 1, archived: 1 });
    expect(report.missingDescriptions).toEqual([]);
    expect(report.stale.attention).toEqual([]);
  });

  it('leaves an archived broken document out of the invalid list but in the total', () => {
    const report = computeHealth(
      input({ prompts: [brokenPrompt('Broken but archived', { archived: true })] }),
    );

    expect(report.totals).toEqual({ all: 1, active: 0, archived: 1 });
    expect(report.invalidDocuments).toEqual([]);
  });
});

describe('computeHealth document metrics', () => {
  it('lists each unreadable document with the parser’s first problem', () => {
    const report = computeHealth(
      input({
        prompts: [prompt({ title: 'Fine' }), brokenPrompt('Broken', { updatedAt: daysAgo(3) })],
      }),
    );

    expect(report.invalidDocuments).toHaveLength(1);
    const [problem] = report.invalidDocuments;
    expect(problem?.promptId).toBeDefined();
    expect(problem?.title).toBe('Broken');
    expect(problem?.count).toBe(1);
    expect(problem?.detail).toContain('schemaVersion');
    expect(problem?.updatedAt).toBe(daysAgo(3));
  });

  it('uses the shared scanner for the invalid-document list', () => {
    const prompts = [brokenPrompt('A'), prompt({ title: 'B' }), brokenPrompt('C')];
    const scan = scanStoredDocuments(prompts);

    expect(scan.problems.map((problem) => problem.title)).toEqual(['A', 'C']);
    expect([...scan.documents.keys()]).toHaveLength(1);
    expect(findDocumentProblems(prompts)).toEqual(scan.problems);
  });

  it('separates schema mismatches from unreadable documents', () => {
    const schema = createPromptSchema(
      {
        name: 'Strict',
        schemaContent: { type: 'object', required: ['missingKey'] },
      },
      deps(),
    );
    const mismatched = prompt({ title: 'Mismatched', schemaId: schema.id });
    const noSchema = prompt({ title: 'No schema' });

    const report = computeHealth(input({ prompts: [mismatched, noSchema], schemas: [schema] }));

    expect(report.invalidDocuments).toEqual([]);
    expect(report.schemaMismatches).toHaveLength(1);
    expect(report.schemaMismatches[0]?.title).toBe('Mismatched');
    expect(report.schemaMismatches[0]?.detail).toContain('Strict');
    expect(report.schemaMismatches[0]?.updatedAt).toBe(mismatched.updatedAt);
  });

  it('finds undeclared and unused variables from the document text', () => {
    const undeclared = prompt({
      title: 'Undeclared',
      content: documentWith({ instructions: ['Greet {{audience}} warmly.'] }),
    });
    const unused = prompt({
      title: 'Unused',
      content: documentWith({
        instructions: ['Write a summary.'],
        variables: [{ name: 'tone' }],
      }),
    });
    const clean = prompt({
      title: 'Clean',
      content: documentWith({
        instructions: ['Greet {{audience}} warmly.'],
        variables: [{ name: 'audience' }],
      }),
    });

    const report = computeHealth(input({ prompts: [undeclared, unused, clean] }));

    expect(report.unresolvedVariables.map((item) => item.title)).toEqual(['Undeclared']);
    expect(report.unresolvedVariables[0]?.detail).toContain('audience');
    expect(report.unresolvedVariables[0]?.names).toEqual(['audience']);
    expect(report.unusedVariables.map((item) => item.title)).toEqual(['Unused']);
    expect(report.unusedVariables[0]?.names).toEqual(['tone']);
  });

  it('does not report variables for a document it could not read', () => {
    const base = createPrompt({ title: 'Broken', description: 'described' }, deps());
    const broken = {
      ...base,
      content: {
        schemaVersion: PROMPT_DOCUMENT_SCHEMA_VERSION,
        role: 42,
      } as unknown as PromptDocument,
    };

    const report = computeHealth(input({ prompts: [broken] }));

    expect(report.invalidDocuments).toHaveLength(1);
    expect(report.unresolvedVariables).toEqual([]);
    expect(report.unusedVariables).toEqual([]);
  });

  it('breaks equal variable counts by title, worst first and then alphabetical', () => {
    const report = computeHealth(
      input({
        prompts: [
          prompt({
            title: 'Zulu',
            content: documentWith({ instructions: ['Use {{a}}.'] }),
          }),
          prompt({
            title: 'Alpha',
            content: documentWith({ instructions: ['Use {{b}}.'] }),
          }),
          prompt({
            title: 'Worst',
            content: documentWith({ instructions: ['Use {{c}} and {{d}}.'] }),
          }),
        ],
      }),
    );

    expect(report.unresolvedVariables.map((item) => item.title)).toEqual([
      'Worst',
      'Alpha',
      'Zulu',
    ]);
    expect(report.unresolvedVariables[0]?.count).toBe(2);
  });

  it('counts empty descriptions only', () => {
    const report = computeHealth(
      input({
        prompts: [
          prompt({ title: 'Blank', description: '   ' }),
          prompt({ title: 'Filled', description: 'Notes' }),
        ],
      }),
    );

    expect(report.missingDescriptions.map((item) => item.title)).toEqual(['Blank']);
  });
});

describe('computeHealth staleness', () => {
  const prompts = [
    prompt({ title: 'Fresh', updatedAt: daysAgo(1) }),
    prompt({ title: 'Month', updatedAt: daysAgo(31) }),
    prompt({ title: 'Two months', updatedAt: daysAgo(61) }),
    prompt({ title: 'Dormant', updatedAt: daysAgo(91) }),
  ];

  it('buckets by the default thresholds, oldest first, cumulatively', () => {
    const report = computeHealth(input({ prompts }));

    expect(report.stale.attention.map((item) => item.title)).toEqual([
      'Dormant',
      'Two months',
      'Month',
    ]);
    expect(report.stale.stale.map((item) => item.title)).toEqual(['Dormant', 'Two months']);
    expect(report.stale.dormant.map((item) => item.title)).toEqual(['Dormant']);
    expect(report.stale.dormant[0]?.count).toBe(91);
  });

  it('breaks equal ages by title, so the list is stable', () => {
    const report = computeHealth(
      input({
        prompts: [
          prompt({ title: 'Zulu', updatedAt: daysAgo(40) }),
          prompt({ title: 'Alpha', updatedAt: daysAgo(40) }),
        ],
      }),
    );

    expect(report.stale.attention.map((item) => item.title)).toEqual(['Alpha', 'Zulu']);
  });

  it('uses the thresholds it is given', () => {
    const report = computeHealth(
      input({ prompts, thresholds: { attentionDays: 2, staleDays: 120, dormantDays: 365 } }),
    );

    expect(report.thresholds).toEqual({
      attentionDays: 2,
      staleDays: 120,
      dormantDays: 365,
    });
    expect(report.stale.attention).toHaveLength(3);
    expect(report.stale.stale).toEqual([]);
  });

  it('says “1 day”, not “1 days”, at the boundary', () => {
    const report = computeHealth(
      input({
        prompts: [prompt({ title: 'Boundary', updatedAt: daysAgo(1) })],
        thresholds: { attentionDays: 1, staleDays: 60, dormantDays: 90 },
      }),
    );

    expect(report.stale.attention).toHaveLength(1);
    expect(report.stale.attention[0]?.count).toBe(1);
    expect(report.stale.attention[0]?.detail).toBe('Not edited for 1 day.');
  });

  it('treats an unreadable timestamp as “not stale”, never as infinite age', () => {
    const weird = { ...prompt({ title: 'Weird' }), updatedAt: 'not-a-date' };
    const report = computeHealth(input({ prompts: [weird] }));

    expect(report.stale.attention).toEqual([]);
    expect(report.oldestEdit).toBe('not-a-date');
  });
});

describe('computeHealth distribution', () => {
  it('counts a prompt in every collection it belongs to, and orphan references nowhere', () => {
    const alpha = createCollection({ name: 'Alpha' }, deps());
    const beta = createCollection({ name: 'Beta' }, deps());
    const empty = createCollection({ name: 'Empty' }, deps());

    const report = computeHealth(
      input({
        collections: [alpha, beta, empty],
        prompts: [
          prompt({ title: 'Both', collectionIds: [alpha.id, beta.id] }),
          prompt({ title: 'Alpha only', collectionIds: [alpha.id] }),
          prompt({ title: 'Loose' }),
          prompt({ title: 'Ghost', collectionIds: ['deleted-collection'] }),
        ],
      }),
    );

    expect(report.collections).toEqual([
      { id: alpha.id, label: 'Alpha', count: 2 },
      { id: beta.id, label: 'Beta', count: 1 },
    ]);
    expect(report.collections.find((row) => row.id === empty.id)).toBeUndefined();
    // "Ghost" points at a collection that no longer exists: it is not listed
    // under a group (there is no group to list it under) and it is not
    // collection-less either, so only "Loose" is counted here.
    expect(report.withoutCollection).toBe(1);
  });

  it('counts folders, unfiled prompts, and ignores archived prompts', () => {
    const folder = createFolder({ name: 'Work' }, deps());
    const other = createFolder({ name: 'Home' }, deps());

    const report = computeHealth(
      input({
        folders: [folder, other],
        prompts: [
          prompt({ title: 'Filed', folderId: folder.id }),
          prompt({ title: 'Unfiled' }),
          prompt({ title: 'Archived', folderId: other.id, archived: true }),
        ],
      }),
    );

    expect(report.folders).toEqual([{ id: folder.id, label: 'Work', count: 1 }]);
    expect(report.unfiled).toBe(1);
  });

  it('breaks ties between equally sized groups by name', () => {
    const zulu = createCollection({ name: 'Zulu' }, deps());
    const alpha = createCollection({ name: 'Alpha' }, deps());

    const report = computeHealth(
      input({
        collections: [zulu, alpha],
        prompts: [
          prompt({ title: 'One', collectionIds: [zulu.id] }),
          prompt({ title: 'Two', collectionIds: [alpha.id] }),
        ],
      }),
    );

    expect(report.collections.map((row) => row.label)).toEqual(['Alpha', 'Zulu']);
  });
});

describe('computeHealth history and activity', () => {
  it('counts revisions, distinct prompts with history, and the newest revision', () => {
    const first = prompt({ title: 'First' });
    const second = prompt({ title: 'Second' });

    const revisions: PromptRevision[] = [
      createRevision(
        first,
        { revisionNumber: 1, kind: 'manual' },
        deps('2026-10-01T09:00:00.000Z'),
      ),
      createRevision(
        first,
        { revisionNumber: 2, kind: 'restore-safety' },
        deps('2026-10-10T09:00:00.000Z'),
      ),
      createRevision(
        second,
        { revisionNumber: 1, kind: 'manual' },
        deps('2026-10-05T09:00:00.000Z'),
      ),
    ];

    const report = computeHealth(input({ prompts: [first, second], revisions }));

    expect(report.revisions).toEqual({
      total: 3,
      promptsWithHistory: 2,
      newestAt: '2026-10-10T09:00:00.000Z',
    });
  });

  it('reports the activity total and the newest event', () => {
    const activity: ActivityEvent[] = [
      createActivityEvent(
        { type: 'created', summary: 'Made one' },
        deps('2026-10-02T09:00:00.000Z'),
      ),
      createActivityEvent(
        { type: 'updated', summary: 'Edited one' },
        deps('2026-10-09T09:00:00.000Z'),
      ),
    ];

    const report = computeHealth(input({ activity }));

    expect(report.activity).toEqual({ total: 2, newestAt: '2026-10-09T09:00:00.000Z' });
  });
});

/* -------------------------------------------------------------------------- */
/* Property-style agreement with a second, independent recomputation          */
/* -------------------------------------------------------------------------- */

/** Deterministic pseudo-random generator, so a failure is reproducible. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

interface Library {
  readonly prompts: Prompt[];
  readonly collections: Collection[];
  readonly folders: Folder[];
  readonly schemas: PromptSchema[];
  readonly revisions: PromptRevision[];
  readonly activity: ActivityEvent[];
  readonly thresholds: HealthThresholds;
}

function generateLibrary(seed: number): Library {
  const random = lcg(seed);
  const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)] as T;

  const collections = Array.from({ length: Math.floor(random() * 4) }, () =>
    createCollection({ name: `Collection ${Math.floor(random() * 1000)}` }, deps()),
  );
  const folders = Array.from({ length: Math.floor(random() * 3) }, () =>
    createFolder({ name: `Folder ${Math.floor(random() * 1000)}` }, deps()),
  );
  const schemas = [
    createPromptSchema(
      { name: 'Requires name', schemaContent: { type: 'object', required: ['name'] } },
      deps(),
    ),
  ];

  const prompts: Prompt[] = [];
  const count = Math.floor(random() * 8);

  for (let index = 0; index < count; index += 1) {
    const title = `Prompt ${index}`;
    const ageDays = Math.floor(random() * 200);
    const archived = random() < 0.2;
    const broken = random() < 0.2;

    if (broken) {
      prompts.push(
        brokenPrompt(title, {
          archived,
          updatedAt: daysAgo(ageDays),
        }),
      );
      continue;
    }

    const declares = random() < 0.5 ? [{ name: 'audience' }] : [];
    const references = random() < 0.5;
    prompts.push(
      createPrompt(
        {
          title,
          description: random() < 0.3 ? ' ' : 'described',
          content: documentWith({
            ...(references ? { instructions: ['Address {{audience}} directly.'] } : {}),
            ...(declares.length > 0 ? { variables: declares } : {}),
          }),
          archived,
          collectionIds: random() < 0.4 && collections.length > 0 ? [pick(collections).id] : [],
          folderId: random() < 0.4 && folders.length > 0 ? pick(folders).id : null,
          schemaId: random() < 0.3 ? (schemas[0]?.id ?? null) : null,
        },
        deps(daysAgo(ageDays)),
      ),
    );
  }

  const revisions: PromptRevision[] = [];
  for (const record of prompts) {
    if (random() < 0.4) {
      revisions.push(
        createRevision(
          record,
          { revisionNumber: 1, kind: 'manual' },
          deps(daysAgo(Math.floor(random() * 100))),
        ),
      );
    }
  }

  const activity = Array.from({ length: Math.floor(random() * 12) }, (_, index) =>
    createActivityEvent(
      { type: 'updated', summary: `Event ${index}` },
      deps(daysAgo(Math.floor(random() * 30))),
    ),
  );

  return {
    prompts,
    collections,
    folders,
    schemas,
    revisions,
    activity,
    thresholds: {
      attentionDays: pick([7, 30, 60]),
      staleDays: pick([60, 90, 120]),
      dormantDays: pick([90, 180, 365]),
    },
  };
}

interface ExpectedCounts {
  readonly all: number;
  readonly active: number;
  readonly archived: number;
  readonly unreadable: number;
  readonly missingDescriptions: number;
  readonly unresolved: number;
  readonly unused: number;
  readonly attention: number;
  readonly stale: number;
  readonly dormant: number;
  readonly perCollection: number;
  readonly unfiled: number;
  readonly revisions: number;
  readonly activity: number;
}

/** The dull recomputation: plain loops, no domain helpers beyond the parser. */
function expected(library: Library): ExpectedCounts {
  const active = library.prompts.filter((record) => !record.archived);
  let unreadable = 0;
  let missingDescriptions = 0;
  let unresolved = 0;
  let unused = 0;

  for (const record of active) {
    const scan = findDocumentProblems([record]);
    if (scan.length > 0) {
      unreadable += 1;
      continue;
    }
    if (record.description.trim().length === 0) missingDescriptions += 1;

    const text = JSON.stringify(record.content);
    const placeholders = new Set<string>();
    for (const match of text.matchAll(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g)) {
      if (match[1]) placeholders.add(match[1]);
    }
    const declared = new Set(record.content.variables.map((variable) => variable.name));

    for (const name of placeholders) if (!declared.has(name)) unresolved += 1;
    for (const name of declared) if (!placeholders.has(name)) unused += 1;
  }

  const buckets = (days: number) =>
    active.filter((record) => {
      const time = Date.parse(record.updatedAt);
      return !Number.isNaN(time) && NOW.getTime() - time >= days * DAY;
    }).length;

  let perCollection = 0;
  for (const collection of library.collections) {
    perCollection += active.filter((record) => record.collectionIds.includes(collection.id)).length;
  }

  return {
    all: library.prompts.length,
    active: active.length,
    archived: library.prompts.length - active.length,
    unreadable,
    missingDescriptions,
    unresolved,
    unused,
    attention: buckets(library.thresholds.attentionDays),
    stale: buckets(library.thresholds.staleDays),
    dormant: buckets(library.thresholds.dormantDays),
    perCollection,
    unfiled: active.filter((record) => record.folderId === null).length,
    revisions: library.revisions.length,
    activity: library.activity.length,
  };
}

describe('computeHealth agrees with a recomputation for generated libraries', () => {
  const seeds = [1, 7, 13, 29, 101, 409];

  for (const seed of seeds) {
    it(`matches for generated library #${seed}`, () => {
      const library = generateLibrary(seed);
      const report = computeHealth({ ...library, now: NOW });
      const reference = expected(library);

      expect(report.totals).toEqual({
        all: reference.all,
        active: reference.active,
        archived: reference.archived,
      });
      expect(report.invalidDocuments).toHaveLength(reference.unreadable);
      expect(report.missingDescriptions).toHaveLength(reference.missingDescriptions);
      expect(report.unresolvedVariables.reduce((total, item) => total + item.count, 0)).toBe(
        reference.unresolved,
      );
      expect(report.unusedVariables.reduce((total, item) => total + item.count, 0)).toBe(
        reference.unused,
      );
      expect(report.stale.attention).toHaveLength(reference.attention);
      expect(report.stale.stale).toHaveLength(reference.stale);
      expect(report.stale.dormant).toHaveLength(reference.dormant);
      expect(report.collections.reduce((total, row) => total + row.count, 0)).toBe(
        reference.perCollection,
      );
      expect(report.unfiled).toBe(reference.unfiled);
      expect(report.revisions.total).toBe(reference.revisions);
      expect(report.activity.total).toBe(reference.activity);

      // Staleness buckets can only grow, and every listed prompt is archived-free.
      expect(report.stale.attention.length).toBeGreaterThanOrEqual(report.stale.stale.length);
      expect(report.stale.stale.length).toBeGreaterThanOrEqual(report.stale.dormant.length);
      for (const item of report.invalidDocuments) {
        expect(library.prompts.find((record) => record.id === item.promptId)?.archived).toBe(false);
      }
    });
  }

  it('never mutates the records it reads', () => {
    const library = generateLibrary(29);
    const before = JSON.stringify(library.prompts);

    computeHealth({ ...library, now: NOW });

    expect(JSON.stringify(library.prompts)).toBe(before);
  });
});

/* -------------------------------------------------------------------------- */
/* Helpers and presentation                                                   */
/* -------------------------------------------------------------------------- */

describe('threshold normalisation', () => {
  it('falls back per field for anything unreadable', () => {
    expect(normalizeHealthThresholds(null)).toEqual(DEFAULT_HEALTH_THRESHOLDS);
    expect(normalizeHealthThresholds('30 days')).toEqual(DEFAULT_HEALTH_THRESHOLDS);
    expect(normalizeHealthThresholds({ attentionDays: 14 })).toEqual({
      attentionDays: 14,
      staleDays: DEFAULT_HEALTH_THRESHOLDS.staleDays,
      dormantDays: DEFAULT_HEALTH_THRESHOLDS.dormantDays,
    });
  });

  it('clamps to the documented bounds and rounds', () => {
    expect(normalizeHealthThresholds({ attentionDays: 0 }).attentionDays).toBe(
      DEFAULT_HEALTH_THRESHOLDS.attentionDays,
    );
    expect(normalizeHealthThresholds({ attentionDays: 99_999 }).attentionDays).toBe(
      HEALTH_THRESHOLD_RANGE.max,
    );
    expect(normalizeHealthThresholds({ attentionDays: 44.6 }).attentionDays).toBe(45);
    expect(
      normalizeHealthThresholds({ attentionDays: Number.POSITIVE_INFINITY }).attentionDays,
    ).toBe(DEFAULT_HEALTH_THRESHOLDS.attentionDays);
  });

  it('describes the thresholds it used', () => {
    expect(describeHealthThresholds(DEFAULT_HEALTH_THRESHOLDS)).toBe('30 / 60 / 90 days');
  });
});

describe('describeHealth', () => {
  const report = (overrides: Partial<HealthInput> = {}): HealthReport =>
    computeHealth(input(overrides));

  it('says an empty library has nothing to report', () => {
    expect(describeHealth(report())).toEqual({
      tone: 'ok',
      text: 'This library holds no prompts yet, so there is nothing to report.',
    });
  });

  it('leads with unreadable documents when there are any', () => {
    const summary = describeHealth(report({ prompts: [brokenPrompt('Broken')] }));
    expect(summary.tone).toBe('attention');
    expect(summary.text).toContain('1 stored document will not parse');
  });

  it('turns to idle prompts when everything parses', () => {
    const summary = describeHealth(
      report({ prompts: [prompt({ title: 'Quiet', updatedAt: daysAgo(45) })] }),
    );
    expect(summary.tone).toBe('attention');
    expect(summary.text).toBe('1 active prompt has not been edited for 30 days.');
  });

  it('reports a clean library as clean without praising quality', () => {
    const summary = describeHealth(report({ prompts: [prompt({ title: 'Fresh' })] }));
    expect(summary.tone).toBe('ok');
    expect(summary.text).toBe(
      'Every stored document parses, and nothing active has been idle for 30 days.',
    );
  });
});

describe('describeCount and formatBytes', () => {
  it('pluralises counts', () => {
    expect(describeCount(0, 'prompt')).toBe('No prompts');
    expect(describeCount(1, 'prompt')).toBe('1 prompt');
    expect(describeCount(2, 'prompt')).toBe('2 prompts');
  });

  it('formats byte counts at every scale', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(940)).toBe('940 B');
    expect(formatBytes(1_500)).toBe('1.5 kB');
    expect(formatBytes(48_000)).toBe('48 kB');
    expect(formatBytes(2_400_000)).toBe('2.4 MB');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });

  it('describes an estimate, a missing API, and a zero quota honestly', () => {
    expect(describeStorage({ available: false, reason: 'Not reported.' })).toBe('Not reported.');
    expect(describeStorage({ available: true, usage: 0, quota: 0 })).toBe(
      'This browser reports no quota for this origin.',
    );
    expect(describeStorage({ available: true, usage: 1_500, quota: 10_000 })).toBe(
      '1.5 kB of 10 kB used (15%). The figure covers this whole origin, not just PromptForge.',
    );
  });
});
