import { describe, expect, it } from 'vitest';

import { createPrompt, createRevision } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import {
  MAX_REVISION_LABEL_LENGTH,
  PRUNE_KEEP_OPTIONS,
  RESTORE_UNCHANGED_FIELDS,
  REVISION_KIND_LABELS,
  REVISION_WARNING_THRESHOLD,
  checkRevisionLabel,
  describeRevisionSize,
  findRevision,
  needsPruneWarning,
  normaliseRevisionLabel,
  prunePlan,
  restoreImpact,
  revisionsForPrompt,
  sortRevisionsNewestFirst,
  summariseRevision,
} from '@/domain/revisions';
import type { Prompt, PromptDocument, PromptRevision } from '@/domain/types';

const NOW = new Date('2026-10-24T09:00:00.000Z');

function documentWith(overrides: Partial<PromptDocument> = {}): PromptDocument {
  return createBlankDocument({
    name: 'Release notes',
    role: 'Technical writer',
    objective: 'Summarise a release.',
    instructions: ['List changes.', 'Name the migration step.'],
    constraints: ['No marketing language.'],
    variables: [
      { name: 'version', type: 'string', required: true },
      { name: 'audience', type: 'string', required: false },
    ],
    metadata: { tags: ['release', 'writing'] },
    ...overrides,
  });
}

function promptWith(overrides: Partial<Prompt> = {}): Prompt {
  const created = createPrompt(
    {
      title: 'Release notes',
      description: 'Weekly release summary.',
      content: documentWith(),
      tags: ['release', 'writing'],
    },
    { now: () => NOW, newId: () => 'prompt-1' },
  );
  return { ...created, ...overrides };
}

let sequence = 0;

function revisionOf(
  prompt: Prompt,
  overrides: Partial<PromptRevision> & { revisionNumber?: number } = {},
): PromptRevision {
  sequence += 1;
  const revision = createRevision(
    prompt,
    {
      revisionNumber: overrides.revisionNumber ?? sequence,
      kind: overrides.kind ?? 'manual',
      label: overrides.label ?? null,
    },
    { now: () => NOW, newId: () => `revision-${sequence}` },
  );

  return { ...revision, ...overrides };
}

describe('ordering', () => {
  it('sorts by revision number, newest first', () => {
    const prompt = promptWith();
    const ordered = sortRevisionsNewestFirst([
      revisionOf(prompt, { revisionNumber: 2 }),
      revisionOf(prompt, { revisionNumber: 7 }),
      revisionOf(prompt, { revisionNumber: 5 }),
    ]);

    expect(ordered.map((revision) => revision.revisionNumber)).toEqual([7, 5, 2]);
  });

  it('breaks number ties by creation time, then id', () => {
    const prompt = promptWith();
    const older = revisionOf(prompt, { revisionNumber: 3, createdAt: '2026-10-01T00:00:00.000Z' });
    const newer = revisionOf(prompt, { revisionNumber: 3, createdAt: '2026-10-02T00:00:00.000Z' });
    const sameTimeA = revisionOf(prompt, {
      revisionNumber: 3,
      createdAt: '2026-10-03T00:00:00.000Z',
      id: 'a',
    });
    const sameTimeB = revisionOf(prompt, {
      revisionNumber: 3,
      createdAt: '2026-10-03T00:00:00.000Z',
      id: 'b',
    });

    const ordered = sortRevisionsNewestFirst([older, sameTimeB, newer, sameTimeA]);
    expect(ordered.map((revision) => revision.id)).toEqual([
      sameTimeA.id,
      sameTimeB.id,
      newer.id,
      older.id,
    ]);
  });

  it('keeps only the requested prompt’s history', () => {
    const mine = revisionOf(promptWith(), { revisionNumber: 1 });
    const theirs = revisionOf(promptWith({ id: 'prompt-2' }), { revisionNumber: 9 });
    const alsoMine = revisionOf(promptWith({ id: 'prompt-1' }), { revisionNumber: 2 });

    expect(revisionsForPrompt([mine, theirs, alsoMine], 'prompt-1')).toEqual([alsoMine, mine]);
    expect(revisionsForPrompt([mine, theirs], 'nothing')).toEqual([]);
  });

  it('finds a revision by id', () => {
    const revision = revisionOf(promptWith());

    expect(findRevision([revision], revision.id)).toBe(revision);
    expect(findRevision([revision], 'missing')).toBeNull();
  });
});

describe('summariseRevision', () => {
  it('describes number, kind, title, and counts', () => {
    const prompt = promptWith();
    const summary = summariseRevision(
      revisionOf(prompt, { revisionNumber: 4, label: 'Before the rewrite' }),
    );

    expect(summary.versionLabel).toBe('v4');
    expect(summary.kindLabel).toBe('Snapshot');
    expect(summary.title).toBe('Release notes');
    expect(summary.variables).toBe(2);
    expect(summary.requiredVariables).toBe(1);
    expect(summary.instructions).toBe(2);
    expect(summary.constraints).toBe(1);
    expect(summary.tags).toEqual(['release', 'writing']);
    expect(summary.characters).toBeGreaterThan(50);
  });

  it('labels every kind and explains it', () => {
    const prompt = promptWith();

    expect(summariseRevision(revisionOf(prompt, { kind: 'restore-safety' })).kindLabel).toBe(
      'Safety snapshot',
    );
    expect(summariseRevision(revisionOf(prompt, { kind: 'import' })).kindLabel).toBe('Imported');
    expect(Object.keys(REVISION_KIND_LABELS).sort()).toEqual(
      ['import', 'manual', 'restore-safety'].sort(),
    );
    expect(
      summariseRevision(revisionOf(prompt, { kind: 'restore-safety' })).kindDescription,
    ).toContain('before a restore');
  });

  it('hashes the document so equal snapshots match', () => {
    const prompt = promptWith();
    const first = summariseRevision(revisionOf(prompt));
    const second = summariseRevision(revisionOf(prompt));
    const different = summariseRevision(
      revisionOf(promptWith({ content: documentWith({ objective: 'Something else.' }) })),
    );

    expect(first.hash).toBe(second.hash);
    expect(different.hash).not.toBe(first.hash);
  });

  it('formats sizes in words', () => {
    expect(describeRevisionSize(1)).toBe('1 character of JSON');
    expect(describeRevisionSize(1284)).toBe('1,284 characters of JSON');
  });
});

describe('restoreImpact', () => {
  it('reports nothing when the snapshot matches the prompt', () => {
    const prompt = promptWith();
    const impact = restoreImpact(revisionOf(prompt), prompt);

    expect(impact.changes).toEqual([]);
    expect(impact.noop).toBe(true);
    expect(impact.unchanged).toEqual(
      expect.arrayContaining(['Title', 'Description', 'Tags', 'Variables', 'Document']),
    );
  });

  it('names each field that differs, with both values', () => {
    const prompt = promptWith({
      title: 'Final notes',
      description: 'Edited since.',
      content: documentWith({ objective: 'Rewritten objective.' }),
    });
    const snapshot = revisionOf(promptWith(), { revisionNumber: 1 });
    const impact = restoreImpact(snapshot, prompt);

    expect(impact.noop).toBe(false);
    expect(impact.changes).toEqual(
      expect.arrayContaining([
        { field: 'Title', from: 'Final notes', to: 'Release notes' },
        { field: 'Description', from: 'Edited since.', to: 'Weekly release summary.' },
        { field: 'Document', from: 'current document', to: 'document stored in v1' },
      ]),
    );
  });

  it('treats an empty description and no tags as values, not absences', () => {
    const prompt = promptWith({ description: '' });
    const snapshot = revisionOf(promptWith({ tags: [] }));

    const impact = restoreImpact(snapshot, prompt);

    expect(impact.changes).toContainEqual({
      field: 'Description',
      from: 'no description',
      to: 'Weekly release summary.',
    });
    expect(impact.changes).toContainEqual({
      field: 'Tags',
      from: 'release, writing',
      to: 'no tags',
    });
  });

  it('reports a document-only difference without claiming metadata changed', () => {
    const prompt = promptWith({ content: documentWith({ objective: 'New objective.' }) });
    const snapshot = revisionOf(promptWith());

    const impact = restoreImpact(snapshot, prompt);

    expect(impact.changes.map((change) => change.field)).toEqual(['Document']);
    expect(impact.unchanged).toEqual(
      expect.arrayContaining(['Title', 'Description', 'Tags', 'Variables']),
    );
  });

  it('reports a variable-only difference', () => {
    const prompt = promptWith({
      variables: [{ name: 'version', type: 'string', required: true }],
    });
    const snapshot = revisionOf(
      promptWith({
        variables: [
          { name: 'version', type: 'string', required: true },
          { name: 'audience', type: 'string', required: false },
        ],
      }),
    );

    const impact = restoreImpact(snapshot, prompt);

    expect(impact.changes).toEqual([
      { field: 'Variables', from: '1 declared (1 required)', to: '2 declared (1 required)' },
    ]);
  });

  it('names the fields a revision never captured', () => {
    expect(RESTORE_UNCHANGED_FIELDS).toEqual(
      expect.arrayContaining(['Folder', 'Collections', 'Status', 'Attached schema']),
    );
  });
});

describe('labels', () => {
  it('normalises blank and padded labels', () => {
    expect(normaliseRevisionLabel('  Before cleanup ')).toBe('Before cleanup');
    expect(normaliseRevisionLabel('   ')).toBeNull();
    expect(normaliseRevisionLabel(null)).toBeNull();
    expect(normaliseRevisionLabel(undefined)).toBeNull();
  });

  it('rejects a label that is too long', () => {
    expect(checkRevisionLabel('x'.repeat(MAX_REVISION_LABEL_LENGTH))).toBeNull();
    expect(checkRevisionLabel('x'.repeat(MAX_REVISION_LABEL_LENGTH + 1))).toContain(
      String(MAX_REVISION_LABEL_LENGTH),
    );
  });
});

describe('prunePlan', () => {
  const prompt = promptWith();
  const history = [5, 4, 3, 2, 1].map((revisionNumber) => revisionOf(prompt, { revisionNumber }));

  it('keeps the newest N and lists the rest', () => {
    const plan = prunePlan(history, 3);

    expect(plan.keep.map((revision) => revision.revisionNumber)).toEqual([5, 4, 3]);
    expect(plan.remove.map((revision) => revision.revisionNumber)).toEqual([2, 1]);
    expect(plan.removalCount).toBe(2);
  });

  it('removes nothing when the history is within the limit', () => {
    const plan = prunePlan(history, 10);

    expect(plan.removalCount).toBe(0);
    expect(plan.keep).toHaveLength(5);
  });

  it('never plans an empty history', () => {
    expect(prunePlan(history, 0).keep).toHaveLength(1);
    expect(prunePlan(history, -4).keep).toHaveLength(1);
    expect(prunePlan(history, Number.NaN).keep).toHaveLength(1);
    // Fractional limits truncate rather than round up: the plan never keeps
    // more than the caller asked for.
    expect(prunePlan(history, 2.9).keep).toHaveLength(2);
  });

  it('offers prune counts as positive options', () => {
    expect(PRUNE_KEEP_OPTIONS.every((option) => option >= 1)).toBe(true);
    expect([...PRUNE_KEEP_OPTIONS]).toEqual([...PRUNE_KEEP_OPTIONS].sort((a, b) => a - b));
  });
});

describe('retention warning', () => {
  it('warns at the documented threshold only', () => {
    expect(needsPruneWarning(0)).toBe(false);
    expect(needsPruneWarning(REVISION_WARNING_THRESHOLD - 1)).toBe(false);
    expect(needsPruneWarning(REVISION_WARNING_THRESHOLD)).toBe(true);
    expect(needsPruneWarning(REVISION_WARNING_THRESHOLD + 40)).toBe(true);
  });
});
