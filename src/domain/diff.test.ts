import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAX_DIFF_ENTRIES,
  categoryOf,
  countDiffEntries,
  describeDiffCategories,
  describeDiffSide,
  describeDiffSummary,
  describePointer,
  diffDocuments,
  diffToJson,
  diffToText,
  escapePointerSegment,
  filterDiffEntries,
  formatDiffValue,
  jsonEquals,
  jsonTypeName,
  pointerFromSegments,
  restrictDiffResult,
  segmentsFromPointer,
  unescapePointerSegment,
} from '@/domain/diff';
import type { JsonValue } from '@/domain/types';

const BASE: JsonValue = {
  name: 'Invoice parser',
  role: 'Finance analyst',
  objective: 'Extract invoice fields.',
  instructions: ['Read the invoice.', 'Return the fields.'],
  constraints: ['Never invent a value.'],
  variables: [
    { name: 'invoice_text', type: 'string', required: true },
    { name: 'fields', type: 'json', required: false },
  ],
  output: { format: 'json' },
  metadata: { tags: ['finance', 'extraction'], nested: { a: 1 } },
};

function clone<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Applies a mutation to a deep copy so fixtures cannot share references. */
function changed(mutate: (document: Record<string, unknown>) => void): JsonValue {
  const copy = clone(BASE) as Record<string, unknown>;
  mutate(copy);
  return copy as JsonValue;
}

describe('jsonEquals', () => {
  it('ignores object key order but not array order', () => {
    expect(jsonEquals({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(jsonEquals([1, 2], [2, 1])).toBe(false);
    expect(jsonEquals({ a: [1, { b: null }] }, { a: [1, { b: null }] })).toBe(true);
    expect(jsonEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('separates scalars by type, not string form', () => {
    expect(jsonEquals(1, '1')).toBe(false);
    expect(jsonEquals(null, false)).toBe(false);
    expect(jsonEquals(0, -0)).toBe(true);
    expect(jsonEquals('', null)).toBe(false);
  });
});

describe('jsonTypeName', () => {
  it('names every JSON type', () => {
    expect(jsonTypeName('x')).toBe('string');
    expect(jsonTypeName(1)).toBe('number');
    expect(jsonTypeName(true)).toBe('boolean');
    expect(jsonTypeName(null)).toBe('null');
    expect(jsonTypeName([])).toBe('array');
    expect(jsonTypeName({})).toBe('object');
  });
});

describe('identical documents', () => {
  it('reports no changes for the same value', () => {
    const result = diffDocuments(BASE, clone(BASE));

    expect(result.identical).toBe(true);
    expect(result.entries).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.summary).toEqual({
      total: 0,
      counts: { added: 0, removed: 0, changed: 0, 'type-changed': 0, reordered: 0 },
      structural: 0,
      textual: 0,
    });
    expect(describeDiffSummary(result.summary)).toBe('No differences.');
    expect(describeDiffCategories(result.summary)).toBe('Nothing to classify.');
  });

  it('ignores key order, because member order is not part of the data model', () => {
    const reordered = { b: 2, a: 1 } as JsonValue;
    expect(diffDocuments({ a: 1, b: 2 }, reordered).identical).toBe(true);
  });

  it('compares whitespace-free values, so formatting is never a change', () => {
    const result = diffDocuments(
      JSON.parse('{"a":1}') as JsonValue,
      JSON.parse('{ "a" : 1 }') as JsonValue,
    );
    expect(result.identical).toBe(true);
  });
});

describe('objects', () => {
  it('reports a changed scalar with its pointer, both values, and a textual class', () => {
    const result = diffDocuments(
      BASE,
      changed((document) => {
        document.objective = 'Extract every invoice field.';
      }),
    );

    expect(result.identical).toBe(false);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      pointer: '/objective',
      segments: ['objective'],
      label: 'objective',
      kind: 'changed',
      category: 'textual',
      before: 'Extract invoice fields.',
      after: 'Extract every invoice field.',
    });
    expect(result.summary).toMatchObject({ total: 1, textual: 1, structural: 0 });
  });

  it('reports nested additions, removals, and changes in one pass', () => {
    const result = diffDocuments(
      BASE,
      changed((document) => {
        document.name = 'Invoice extractor';
        const metadata = document.metadata as Record<string, unknown>;
        metadata.nested = { a: 1, b: 2 };
        (metadata.tags as string[]).push('pdf');
        delete document.constraints;
      }),
    );

    expect(result.entries.map((entry) => [entry.pointer, entry.kind])).toEqual([
      ['/name', 'changed'],
      ['/metadata/tags/2', 'added'],
      ['/metadata/nested/b', 'added'],
      ['/constraints', 'removed'],
    ]);
  });

  it('follows the new document order, then lists removals in the old order', () => {
    const before: JsonValue = { a: 1, b: 2, c: 3 };
    const after: JsonValue = { c: 4, d: 5 };

    expect(diffDocuments(before, after).entries.map((entry) => entry.pointer)).toEqual([
      '/c',
      '/d',
      '/a',
      '/b',
    ]);
  });

  it('describes empty containers honestly instead of recursing into them', () => {
    const result = diffDocuments({ context: {} }, { context: { customer: 'acme' } });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      pointer: '/context/customer',
      kind: 'added',
      after: 'acme',
    });
    expect(diffDocuments({ context: {} }, { context: [] }).entries[0]).toMatchObject({
      pointer: '/context',
      kind: 'type-changed',
    });
  });
});

describe('type changes', () => {
  it('reports a scalar type change as structural, with both values', () => {
    const result = diffDocuments({ count: '3' }, { count: 3 });

    expect(result.entries[0]).toMatchObject({
      pointer: '/count',
      kind: 'type-changed',
      category: 'structural',
      before: '3',
      after: 3,
    });
  });

  it('reports a container-type change at that path rather than walking into it', () => {
    const result = diffDocuments(
      { variables: [{ name: 'a' }] },
      { variables: { a: { name: 'a' } } },
    );

    expect(result.entries).toEqual([
      expect.objectContaining({ pointer: '/variables', kind: 'type-changed' }),
    ]);
  });

  it('treats a change at the root as the document itself changing type', () => {
    const result = diffDocuments([1, 2] as JsonValue, { a: 1 });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      pointer: '',
      segments: [],
      label: 'document',
      kind: 'type-changed',
      before: [1, 2],
      after: { a: 1 },
    });
  });
});

describe('arrays', () => {
  const list = (values: readonly JsonValue[]): JsonValue => [...values];

  it('reports an insertion at the front as one addition, not a cascade', () => {
    const result = diffDocuments(list(['a', 'b', 'c']), list(['x', 'a', 'b', 'c']));

    expect(result.entries).toEqual([
      expect.objectContaining({ pointer: '/0', segments: [0], kind: 'added', after: 'x' }),
    ]);
  });

  it('reports a removal from the middle at its old index', () => {
    const result = diffDocuments(list(['a', 'x', 'b']), list(['a', 'b']));

    expect(result.entries).toEqual([
      expect.objectContaining({ pointer: '/1', kind: 'removed', before: 'x' }),
    ]);
  });

  it('reports one change per differing position in the middle', () => {
    const result = diffDocuments(list(['a', 'x', 'y']), list(['a', 'p', 'q']));

    expect(
      result.entries.map((entry) => [entry.pointer, entry.kind, entry.before, entry.after]),
    ).toEqual([
      ['/1', 'changed', 'x', 'p'],
      ['/2', 'changed', 'y', 'q'],
    ]);
  });

  it('detects a pure re-order of a scalar array as one reordered entry with moves', () => {
    const result = diffDocuments(
      list(['first', 'second', 'third']),
      list(['second', 'first', 'third']),
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      pointer: '',
      kind: 'reordered',
      category: 'structural',
      before: ['first', 'second', 'third'],
      after: ['second', 'first', 'third'],
    });
    expect(result.entries[0]?.moves).toEqual([
      { from: 0, to: 1 },
      { from: 1, to: 0 },
    ]);
    expect(result.entries[0]?.movedPositions).toBe(2);
  });

  it('caps recorded moves but reports how many positions moved', () => {
    const before = Array.from({ length: 12 }, (_, index) => index);
    const after = [...before].reverse();
    const result = diffDocuments(before, after, { maxMoves: 3 });

    expect(result.entries[0]?.moves).toHaveLength(3);
    expect(result.entries[0]?.movedPositions).toBe(12);
  });

  it('does not claim a reorder when values were also added or removed', () => {
    const result = diffDocuments(list(['a', 'b']), list(['b', 'c']));

    expect(result.entries.every((entry) => entry.kind !== 'reordered')).toBe(true);
    expect(result.entries.map((entry) => entry.kind)).toEqual(['changed', 'changed']);
  });

  it('compares objects inside arrays by index and recurses into them', () => {
    const result = diffDocuments(
      { variables: [{ name: 'a', required: true }] },
      { variables: [{ name: 'b', required: true }] },
    );

    expect(result.entries).toEqual([
      expect.objectContaining({
        pointer: '/variables/0/name',
        kind: 'changed',
        before: 'a',
        after: 'b',
      }),
    ]);
  });

  it('keeps the index in the path when an element is appended', () => {
    const result = diffDocuments({ instructions: ['one'] }, { instructions: ['one', 'two'] });

    expect(result.entries[0]).toMatchObject({
      pointer: '/instructions/1',
      label: 'instructions[1]',
      kind: 'added',
    });
  });

  it('compares a large array without walking every element as a change', () => {
    const before = Array.from({ length: 5000 }, (_, index) => `line ${index}`);
    const after = [...before, 'line 5000'];
    const result = diffDocuments(before, after);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ pointer: '/5000', kind: 'added' });
  });
});

describe('paths', () => {
  it('escapes pointer segments per RFC 6901 and round-trips them', () => {
    expect(escapePointerSegment('a/b')).toBe('a~1b');
    expect(escapePointerSegment('a~b')).toBe('a~0b');
    expect(unescapePointerSegment('a~1b')).toBe('a/b');
    expect(pointerFromSegments(['a/b', 0, 'c~d'])).toBe('/a~1b/0/c~0d');
    expect(segmentsFromPointer('/a~1b/0/c~0d')).toEqual(['a/b', '0', 'c~d']);
    expect(pointerFromSegments([])).toBe('');
    expect(segmentsFromPointer('')).toEqual([]);
  });

  it('rejects a string that is not a pointer', () => {
    expect(() => segmentsFromPointer('a/b')).toThrow('Not a JSON Pointer');
  });

  it('uses escaped pointers for keys that contain slashes', () => {
    const result = diffDocuments({ 'a/b': 1 }, { 'a/b': 2 });

    expect(result.entries[0]).toMatchObject({ pointer: '/a~1b', segments: ['a/b'], label: 'a/b' });
  });

  it('describes readable paths', () => {
    expect(describePointer([])).toBe('document');
    expect(describePointer(['objective'])).toBe('objective');
    expect(describePointer(['instructions', 2])).toBe('instructions[2]');
    expect(describePointer(['context', 'customer', 'email'])).toBe('context.customer.email');
  });

  it('compares Unicode exactly, without normalising', () => {
    const nfc = '\u00e9'.normalize('NFC');
    const nfd = '\u00e9'.normalize('NFD');
    expect(nfc).not.toBe(nfd);

    expect(diffDocuments({ name: nfc }, { name: nfd }).entries[0]?.kind).toBe('changed');
    expect(diffDocuments({ name: '👩‍💻' }, { name: '👩‍💻' }).identical).toBe(true);
    expect(diffDocuments({ emoji: '🙂' }, { emoji: '🙃' }).entries[0]).toMatchObject({
      pointer: '/emoji',
      kind: 'changed',
      before: '🙂',
      after: '🙃',
    });
  });
});

describe('summary and filtering', () => {
  const result = diffDocuments(
    BASE,
    changed((document) => {
      document.name = 'Invoice extractor';
      delete document.constraints;
      document.extra = true;
    }),
  );

  it('counts by kind and by category', () => {
    expect(result.summary.counts).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
      'type-changed': 0,
      reordered: 0,
    });
    expect(result.summary).toMatchObject({ total: 3, structural: 2, textual: 1 });
    expect(describeDiffSummary(result.summary)).toBe('3 changes: 1 added, 1 removed, 1 changed.');
    expect(describeDiffCategories(result.summary)).toBe('2 structure, 1 text.');
  });

  it('filters by change kind and treats an empty selection as everything', () => {
    expect(filterDiffEntries(result.entries, ['removed']).map((entry) => entry.pointer)).toEqual([
      '/constraints',
    ]);
    expect(filterDiffEntries(result.entries, []).length).toBe(3);
    expect(countDiffEntries(result.entries).changed).toBe(1);
  });

  it('maps every kind to a stable category', () => {
    expect(categoryOf('changed')).toBe('textual');
    expect(categoryOf('added')).toBe('structural');
    expect(categoryOf('removed')).toBe('structural');
    expect(categoryOf('type-changed')).toBe('structural');
    expect(categoryOf('reordered')).toBe('structural');
  });
});

describe('value formatting', () => {
  it('renders scalars as JSON literals so types stay visible', () => {
    expect(formatDiffValue('3').text).toBe('"3"');
    expect(formatDiffValue(3).text).toBe('3');
    expect(formatDiffValue(null).text).toBe('null');
    expect(formatDiffValue(true).text).toBe('true');
    expect(formatDiffValue(null).truncated).toBe(false);
  });

  it('pretty-prints containers and truncates long output with a flag', () => {
    const object = formatDiffValue({ a: 1 });
    expect(object.text).toBe('{\n  "a": 1\n}');

    const long = formatDiffValue('x'.repeat(500));
    expect(long.truncated).toBe(true);
    expect(long.text.endsWith('…')).toBe(true);
    expect(long.characters).toBeGreaterThan(500);
    expect(formatDiffValue('x'.repeat(500), { maxLength: 2000 }).truncated).toBe(false);
  });
});

describe('copy output', () => {
  const result = diffDocuments(
    BASE,
    changed((document) => {
      document.objective = 'Rewritten.';
      delete document.output;
    }),
  );

  it('serialises every displayed change, with both sides', () => {
    const parsed = JSON.parse(
      diffToJson(result, { before: 'Stored prompt', after: 'Snapshot v2' }),
    ) as {
      before: string;
      after: string;
      identical: boolean;
      truncated: boolean;
      summary: { total: number };
      changes: {
        pointer: string;
        kind: string;
        category: string;
        before?: JsonValue;
        after?: JsonValue;
      }[];
    };

    expect(parsed.before).toBe('Stored prompt');
    expect(parsed.after).toBe('Snapshot v2');
    expect(parsed.identical).toBe(false);
    expect(parsed.truncated).toBe(false);
    expect(parsed.summary.total).toBe(2);
    expect(parsed.changes).toEqual([
      {
        pointer: '/objective',
        path: 'objective',
        kind: 'changed',
        category: 'textual',
        before: 'Extract invoice fields.',
        after: 'Rewritten.',
      },
      {
        pointer: '/output',
        path: 'output',
        kind: 'removed',
        category: 'structural',
        before: { format: 'json' },
      },
    ]);
  });

  it('serialises reorder moves and says when the list was truncated', () => {
    const reorder = diffDocuments(['a', 'b'], ['b', 'a']);
    const parsed = JSON.parse(diffToJson(reorder)) as {
      changes: { kind: string; moves: unknown; movedPositions: number }[];
    };
    expect(parsed.changes[0]).toMatchObject({
      kind: 'reordered',
      moves: [
        { from: 0, to: 1 },
        { from: 1, to: 0 },
      ],
      movedPositions: 2,
    });

    const truncated = diffDocuments(
      { a: 1, b: 2, c: 3, d: 4 },
      { a: 0, b: 0, c: 0, d: 0 },
      { maxEntries: 2 },
    );
    expect(truncated.truncated).toBe(true);
    expect((JSON.parse(diffToJson(truncated)) as { truncated: boolean }).truncated).toBe(true);
    expect(diffToText(truncated)).toContain('Truncated: showing the first 2 changes.');
  });

  it('renders a readable text list that names every path', () => {
    const text = diffToText(result, { before: 'Stored prompt', after: 'Snapshot v1' });

    expect(text).toContain('Before: Stored prompt');
    expect(text).toContain('After:  Snapshot v1');
    expect(text).toContain('2 changes: 1 removed, 1 changed.');
    expect(text).toContain('~ objective  (changed, text)');
    expect(text).toContain('- "Extract invoice fields."');
    expect(text).toContain('+ "Rewritten."');
    expect(text).toContain('- output  (removed, structure)');
    expect(text).toContain('"format": "json"');
  });

  it('lists moved positions in the text copy', () => {
    const text = diffToText(diffDocuments(['a', 'b', 'c'], ['c', 'b', 'a']));
    expect(text).toContain('~ document  (re-ordered, structure)');
    expect(text).toContain('moved: 0 → 2, 2 → 0');
  });

  it('restricts a result to a filtered selection and records the filter', () => {
    const restricted = restrictDiffResult(result, filterDiffEntries(result.entries, ['removed']));

    expect(restricted.entries).toHaveLength(1);
    expect(restricted.summary.total).toBe(1);
    expect(restricted.summary.counts.removed).toBe(1);
    expect(restricted.identical).toBe(false);
    expect(restricted.truncated).toBe(false);

    const note = 'Filtered view: showing 1 of 2 changes (Removed).';
    const parsed = JSON.parse(diffToJson(restricted, undefined, { filterNote: note })) as {
      filter: string;
      changes: { pointer: string }[];
    };
    expect(parsed.filter).toBe(note);
    expect(parsed.changes.map((change) => change.pointer)).toEqual(['/output']);
    expect(diffToText(restricted, undefined, { filterNote: note })).toContain(note);
  });

  it('says "No differences" in the text copy too', () => {
    expect(diffToText(diffDocuments(BASE, clone(BASE)))).toBe(
      'No differences.\nNothing to classify.',
    );
  });
});

describe('bounds', () => {
  it('stops at the entry cap and reports truncation', () => {
    expect(DEFAULT_MAX_DIFF_ENTRIES).toBe(2000);

    const before = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`key${index}`, index]),
    ) as JsonValue;
    const after = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`key${index}`, index + 1]),
    ) as JsonValue;

    const result = diffDocuments(before, after, { maxEntries: 4 });

    expect(result.entries).toHaveLength(4);
    expect(result.truncated).toBe(true);
    expect(result.identical).toBe(false);
    expect(result.summary.total).toBe(4);
  });

  it('treats a zero or negative cap as one entry rather than hanging', () => {
    const result = diffDocuments({ a: 1, b: 2 }, { a: 9, b: 8 }, { maxEntries: 0 });
    expect(result.entries).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });

  it('does not report truncation for a comparison that fits', () => {
    expect(
      diffDocuments(
        BASE,
        changed((document) => {
          document.objective = 'x';
        }),
      ).truncated,
    ).toBe(false);
  });
});

describe('side labels', () => {
  it('names the prompt alone when it is the stored document', () => {
    expect(describeDiffSide({ title: 'Invoice parser' })).toBe('Invoice parser');
  });

  it('names the snapshot number and its label when it is a revision', () => {
    expect(describeDiffSide({ title: 'Invoice parser', revisionNumber: 3 })).toBe(
      'Invoice parser · v3',
    );
    expect(
      describeDiffSide({ title: 'Invoice parser', revisionNumber: 3, label: 'Before rewrite' }),
    ).toBe('Invoice parser · v3 · Before rewrite');
    expect(describeDiffSide({ title: 'Invoice parser', revisionNumber: 1, label: '   ' })).toBe(
      'Invoice parser · v1',
    );
  });
});
