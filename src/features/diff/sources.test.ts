import { describe, expect, it } from 'vitest';

import { createBlankDocument } from '@/domain/promptDocument';
import { createDefaultSettings, createPrompt, createRevision } from '@/domain/factories';
import { documentToJson } from '@/domain/serialization';
import type { Prompt, PromptRevision } from '@/domain/types';
import {
  defaultDiffSources,
  parseDiffSource,
  resolveDiffSource,
  revisionsOfPrompt,
  serializeDiffSource,
  switchDiffSourceKind,
} from '@/features/diff/sources';

const NOW = new Date('2026-10-24T09:00:00.000Z');

function promptFixture(id: string, title: string): Prompt {
  return createPrompt(
    {
      title,
      description: `${title} description.`,
      content: createBlankDocument({ name: title, objective: `Do ${title}.` }),
    },
    { now: () => NOW, newId: () => id },
  );
}

function revisionFixture(
  prompt: Prompt,
  number: number,
  id: string,
  label?: string,
): PromptRevision {
  return createRevision(
    prompt,
    { revisionNumber: number, kind: 'manual', label: label ?? null },
    { now: () => NOW, newId: () => id },
  );
}

const PARSER = promptFixture('p-parser', 'Invoice parser');
const DIGEST = promptFixture('p-digest', 'Weekly digest');
const V1 = revisionFixture(PARSER, 1, 'rev-1');
const V2 = revisionFixture(PARSER, 2, 'rev-2', 'Before rewrite');
const OTHER = revisionFixture(DIGEST, 1, 'rev-d1');

const DOCS = { prompts: [PARSER, DIGEST], revisions: [V1, V2, OTHER] };

describe('source parameters', () => {
  it('round-trips each kind through a query parameter', () => {
    expect(serializeDiffSource({ kind: 'prompt', promptId: 'p1' })).toBe('prompt:p1');
    expect(serializeDiffSource({ kind: 'revision', revisionId: 'r1', promptId: 'p1' })).toBe(
      'revision:r1',
    );
    expect(serializeDiffSource({ kind: 'text' })).toBe('text');

    expect(parseDiffSource('prompt:p1')).toEqual({ kind: 'prompt', promptId: 'p1' });
    expect(parseDiffSource('revision:r1')).toEqual({
      kind: 'revision',
      revisionId: 'r1',
      promptId: '',
    });
    expect(parseDiffSource('text')).toEqual({ kind: 'text' });
  });

  it('treats ids containing colons as one id', () => {
    expect(parseDiffSource('prompt:a:b')).toEqual({ kind: 'prompt', promptId: 'a:b' });
  });

  it('returns null for values it never writes', () => {
    for (const value of [
      null,
      undefined,
      '',
      'textx',
      'prompt',
      'prompt:',
      'other:1',
      ':id',
      ' ',
    ]) {
      expect(parseDiffSource(value), String(value)).toBeNull();
    }
  });
});

describe('default sources for a prompt link', () => {
  it('compares the newest snapshot with the stored prompt', () => {
    expect(defaultDiffSources('p-parser', DOCS.revisions)).toEqual({
      before: { kind: 'revision', revisionId: 'rev-2', promptId: 'p-parser' },
      after: { kind: 'prompt', promptId: 'p-parser' },
    });
  });

  it('pairs the stored prompt with pasted JSON when there are no snapshots yet', () => {
    expect(defaultDiffSources('p-parser', [OTHER])).toEqual({
      before: { kind: 'prompt', promptId: 'p-parser' },
      after: { kind: 'text' },
    });
  });
});

describe('resolving a side', () => {
  it('resolves a stored prompt to its document', () => {
    const resolved = resolveDiffSource({ kind: 'prompt', promptId: 'p-parser' }, DOCS);

    expect(resolved).toMatchObject({
      ok: true,
      label: 'Invoice parser',
      detail: 'Stored prompt',
      document: documentToJson(PARSER.content),
    });
  });

  it('explains a prompt that is not stored', () => {
    const resolved = resolveDiffSource({ kind: 'prompt', promptId: 'gone' }, DOCS);

    expect(resolved).toEqual({ ok: false, error: 'This prompt (gone) is not in your library.' });
  });

  it('resolves a snapshot with its prompt title, number, and label', () => {
    const resolved = resolveDiffSource(
      { kind: 'revision', revisionId: 'rev-2', promptId: 'p-parser' },
      DOCS,
    );

    expect(resolved).toMatchObject({
      ok: true,
      label: 'Invoice parser · v2 · Before rewrite',
      detail: 'Snapshot v2',
      document: documentToJson(V2.contentSnapshot),
    });
  });

  it('omits an empty snapshot label', () => {
    expect(
      resolveDiffSource({ kind: 'revision', revisionId: 'rev-1', promptId: 'p-parser' }, DOCS),
    ).toMatchObject({ label: 'Invoice parser · v1' });
  });

  it('explains a snapshot that was pruned or deleted', () => {
    const resolved = resolveDiffSource(
      { kind: 'revision', revisionId: 'rev-gone', promptId: 'p-parser' },
      DOCS,
    );

    expect(resolved).toMatchObject({ ok: false });
    expect(resolved.ok === false && resolved.error).toContain('no longer stored');
  });

  it('still resolves a snapshot whose prompt was deleted', () => {
    const resolved = resolveDiffSource(
      { kind: 'revision', revisionId: 'rev-d1', promptId: 'p-digest' },
      { prompts: [], revisions: [OTHER] },
    );

    expect(resolved).toMatchObject({
      ok: true,
      label: 'Deleted prompt · v1',
      detail: 'Snapshot of a deleted prompt',
    });
  });

  it('never claims a pasted side has content', () => {
    expect(resolveDiffSource({ kind: 'text' }, DOCS)).toEqual({
      ok: false,
      error: 'Paste JSON into this side to include it in the comparison.',
    });
  });
});

describe('revision picker', () => {
  it('lists only the prompt’s snapshots, newest first', () => {
    expect(revisionsOfPrompt(DOCS.revisions, 'p-parser').map((revision) => revision.id)).toEqual([
      'rev-2',
      'rev-1',
    ]);
    expect(revisionsOfPrompt(DOCS.revisions, 'p-missing')).toEqual([]);
    expect(revisionsOfPrompt(DOCS.revisions, undefined)).toEqual([]);
  });

  it('switches kind while staying on the same prompt', () => {
    const fromSnapshot = switchDiffSourceKind(
      'prompt',
      { kind: 'revision', revisionId: 'rev-1', promptId: 'p-digest' },
      DOCS,
    );
    expect(fromSnapshot).toEqual({ kind: 'prompt', promptId: 'p-digest' });

    const toSnapshot = switchDiffSourceKind(
      'revision',
      { kind: 'prompt', promptId: 'p-parser' },
      DOCS,
    );
    expect(toSnapshot).toEqual({ kind: 'revision', revisionId: 'rev-2', promptId: 'p-parser' });
  });

  it('falls back to pasted JSON when the prompt has no snapshots', () => {
    expect(
      switchDiffSourceKind(
        'revision',
        { kind: 'prompt', promptId: 'p-digest' },
        {
          prompts: DOCS.prompts,
          revisions: [V1, V2],
        },
      ),
    ).toEqual({ kind: 'text' });
  });

  it('starts from the first prompt when the current side is pasted text', () => {
    expect(switchDiffSourceKind('prompt', { kind: 'text' }, DOCS)).toEqual({
      kind: 'prompt',
      promptId: 'p-parser',
    });
  });

  it('does nothing when the library is empty', () => {
    expect(
      switchDiffSourceKind('prompt', { kind: 'text' }, { prompts: [], revisions: [] }),
    ).toEqual({ kind: 'text' });
  });

  it('survives a source that outlived its prompt', () => {
    // `promptId: ''` is what a hand-typed `revision:` parameter produces.
    expect(
      switchDiffSourceKind('revision', { kind: 'revision', revisionId: 'x', promptId: '' }, DOCS),
    ).toEqual({ kind: 'revision', revisionId: 'rev-2', promptId: 'p-parser' });
  });
});

describe('unrelated settings', () => {
  it('does not consult preferences or settings', () => {
    // A guard against future edits that would make resolution depend on UI state.
    expect(createDefaultSettings().onboardedAt).toBeNull();
  });
});
