import { describe, expect, it } from 'vitest';

import { createSampleDocument } from '@/domain/promptDocument';
import {
  SerializationError,
  contentHash,
  documentHash,
  documentToJson,
  formatDocument,
  hashString,
  parseDocument,
  parseJson,
  stableStringify,
  tryContentHash,
  tryStableStringify,
} from '@/domain/serialization';

describe('stableStringify', () => {
  it('sorts object keys and emits compact JSON', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(stableStringify({ nested: { z: [3, 2], a: 1 } })).toBe('{"nested":{"a":1,"z":[3,2]}}');
  });

  it('pretty-prints with the requested indentation', () => {
    const output = stableStringify({ b: 1, a: { c: [1] } }, { indent: 2 });

    expect(output).toBe('{\n  "a": {\n    "c": [\n      1\n    ]\n  },\n  "b": 1\n}');
    expect(stableStringify({}, { indent: 2 })).toBe('{}');
    expect(stableStringify([], { indent: 2 })).toBe('[]');
    expect(stableStringify({ a: [] }, { indent: 2 })).toBe('{\n  "a": []\n}');
  });

  it('drops undefined object entries and nulls undefined array entries', () => {
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(stableStringify([1, undefined, 3])).toBe('[1,null,3]');
    expect(() => stableStringify(undefined)).toThrow(/undefined/);
  });

  it('serializes primitives and nested arrays', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify('text')).toBe('"text"');
    expect(stableStringify(0)).toBe('0');
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify([[1], [2]])).toBe('[[1],[2]]');
  });

  it('rejects values JSON cannot represent instead of writing invalid JSON', () => {
    expect(() => stableStringify({ fn: () => undefined })).toThrow(SerializationError);
    expect(() => stableStringify(Number.NaN)).toThrow(/finite/);
    expect(() => stableStringify(Number.POSITIVE_INFINITY)).toThrow(/finite/);
    expect(() => stableStringify(Symbol('x'))).toThrow(/symbol/);
    expect(() => stableStringify(new Date())).toThrow(/plain objects/);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => stableStringify(cyclic)).toThrow(/cyclic/);
  });

  it('accepts shared (non-cyclic) references', () => {
    const shared = { value: 1 };
    expect(stableStringify({ a: shared, b: shared })).toBe('{"a":{"value":1},"b":{"value":1}}');
  });

  it('reports failures as issues in tryStableStringify', () => {
    const ok = tryStableStringify({ b: 1, a: 2 });
    expect(ok).toEqual({ ok: true, value: '{"a":2,"b":1}', issues: [] });

    const failed = tryStableStringify(new Map());
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.issues[0]?.severity).toBe('error');
    expect(failed.issues[0]?.message).toMatch(/plain objects/);
  });
});

describe('document conversion', () => {
  it('emits canonical section order and includes preserved extras last', () => {
    const document = { ...createSampleDocument(), extras: { vendor: { id: 7 } } };
    const json = documentToJson(document);
    const keys = Object.keys(json);

    expect(keys.slice(0, 4)).toEqual(['schemaVersion', 'name', 'role', 'objective']);
    expect(keys.at(-1)).toBe('vendor');
    expect(json.vendor).toEqual({ id: 7 });
  });

  it('never lets extras overwrite a canonical field', () => {
    const document = { ...createSampleDocument(), extras: { name: 'shadowed' } };
    expect(documentToJson(document).name).toBe('Release notes summarizer');
  });

  it('formats a document as readable, deterministic JSON', () => {
    const document = createSampleDocument();
    const formatted = formatDocument(document);

    expect(formatted.startsWith('{\n  "schemaVersion": "1.0",')).toBe(true);
    expect(formatted).toContain('\n  "instructions": [');
    expect(formatDocument(document)).toBe(formatted);
    expect(formatDocument(document, 4)).toContain('\n    "schemaVersion"');
  });

  it('round-trips a document through format → parse', () => {
    const document = createSampleDocument();
    const result = parseDocument(formatDocument(document));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(document);
    expect(result.issues).toEqual([]);
  });

  it('preserves unknown fields across a round-trip', () => {
    const source = { ...createSampleDocument(), extras: { vendor: { id: 7 } } };
    const result = parseDocument(formatDocument(source));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.extras).toEqual({ vendor: { id: 7 } });
    expect(result.issues.map((issue) => issue.path)).toEqual(['vendor']);
    expect(JSON.parse(formatDocument(result.value))).toMatchObject({ vendor: { id: 7 } });
  });
});

describe('parseDocument', () => {
  it('parses valid text into a normalized document', () => {
    const result = parseDocument(
      JSON.stringify({
        schemaVersion: '1.0',
        name: '  Trimmed  ',
        role: 'Editor',
        objective: 'Edit.',
        instructions: [' Step '],
        context: {},
        constraints: [],
        variables: [],
        output: { format: 'text' },
        examples: [],
        metadata: {},
        includes: [],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Trimmed');
    expect(result.value.instructions).toEqual(['Step']);
  });

  it('accepts an already-parsed value', () => {
    expect(parseDocument(createSampleDocument()).ok).toBe(true);
  });

  it('reports empty input without throwing', () => {
    const result = parseDocument('   ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toBe('The document is empty.');
  });

  it('turns a syntax error into a readable message with a location', () => {
    const located = parseDocument('{\n  a: 1\n}');
    expect(located.ok).toBe(false);
    if (!located.ok) {
      expect(located.issues[0]?.severity).toBe('error');
      expect(located.issues[0]?.message).toBe(
        "Invalid JSON at line 2, column 3 — Expected property name or '}'",
      );
    }

    // Some engine messages carry no location; they are still cleaned up.
    const unlocated = parseDocument('{\n  "name": "x",\n  "role": }\n');
    expect(unlocated.ok).toBe(false);
    if (unlocated.ok) return;
    expect(unlocated.issues[0]?.message).toBe("Invalid JSON — Unexpected token '}'");
  });

  it('reports unknown schema versions as errors', () => {
    const result = parseDocument(JSON.stringify({ schemaVersion: '9.9' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual({
      path: 'schemaVersion',
      message: 'Unsupported schema version "9.9"; this build reads "1.0".',
      severity: 'error',
    });
  });

  it('rejects JSON that is not an object', () => {
    const result = parseDocument('[1, 2, 3]');
    expect(result.ok).toBe(false);
  });
});

describe('parseJson', () => {
  it('parses any JSON value', () => {
    expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 }, issues: [] });
    expect(parseJson('[1,2]').ok).toBe(true);
    expect(parseJson('"text"').ok).toBe(true);
    expect(parseJson('null').ok).toBe(true);
  });

  it('reports empty and invalid input', () => {
    const empty = parseJson('   ');
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.issues[0]?.message).toBe('The input is empty.');

    const invalid = parseJson('{"a": }');
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.issues[0]?.message).toMatch(/Invalid JSON/);
  });
});

describe('hashing', () => {
  it('produces a stable 16-character hex digest', () => {
    expect(hashString('promptforge')).toMatch(/^[0-9a-f]{16}$/);
    expect(hashString('promptforge')).toBe(hashString('promptforge'));
    expect(hashString('promptforge')).not.toBe(hashString('promptforgf'));
    expect(hashString('')).toMatch(/^[0-9a-f]{16}$/);
    expect(hashString('\u{1F680}')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('hashes content independently of key order', () => {
    expect(contentHash({ a: 1, b: [1, 2] })).toBe(contentHash({ b: [1, 2], a: 1 }));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });

  it('detects document changes and ignores formatting differences', () => {
    const document = createSampleDocument();
    const reformatted = parseDocument(formatDocument(document, 4));
    expect(reformatted.ok).toBe(true);
    if (!reformatted.ok) return;

    expect(documentHash(reformatted.value)).toBe(documentHash(document));
    expect(documentHash({ ...document, objective: 'Different.' })).not.toBe(documentHash(document));
  });

  it('reports unserializable input as issues', () => {
    const result = tryContentHash(new Map());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.severity).toBe('error');

    const ok = tryContentHash({ a: 1 });
    expect(ok).toEqual({ ok: true, value: contentHash({ a: 1 }), issues: [] });
  });
});
