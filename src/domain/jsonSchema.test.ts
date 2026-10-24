import { describe, expect, it } from 'vitest';

import {
  JSON_SCHEMA_LIMITS,
  compileJsonSchema,
  schemaProblemPath,
  validateInstance,
} from '@/domain/jsonSchema';
import type { JsonValue } from '@/domain/types';

function compile(schema: unknown) {
  const result = compileJsonSchema(schema);
  if (!result.ok) throw new Error(`Unexpected compile failure: ${result.problems[0]?.message}`);
  return result;
}

function errorsFor(schema: unknown, value: JsonValue) {
  return validateInstance(compile(schema).schema, value).errors;
}

const PERSON = {
  type: 'object',
  required: ['name', 'age'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 40 },
    age: { type: 'integer', minimum: 0, maximum: 130 },
    email: { type: 'string', format: 'email' },
    role: { enum: ['writer', 'reviewer'] },
    tags: { type: 'array', items: { type: 'string' }, uniqueItems: true, maxItems: 3 },
  },
} as const;

describe('compileJsonSchema', () => {
  it('accepts a well-formed schema and returns it unchanged', () => {
    const result = compile(PERSON);
    expect(result.warnings).toEqual([]);
    expect(result.schema).toBe(PERSON);
  });

  it('accepts the boolean schemas', () => {
    expect(compileJsonSchema(true)).toEqual({ ok: true, schema: true, warnings: [] });
    expect(compileJsonSchema(false)).toEqual({ ok: true, schema: false, warnings: [] });
  });

  it('rejects non-schema values', () => {
    for (const input of [null, 42, 'name', [], [{ type: 'string' }]]) {
      expect(compileJsonSchema(input).ok, JSON.stringify(input)).toBe(false);
    }
  });

  it('names a misspelled keyword instead of ignoring it', () => {
    const result = compileJsonSchema({ requird: ['name'] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]).toMatchObject({
      pointer: '/requird',
      keyword: 'requird',
    });
    expect(result.problems[0]?.message).toMatch(/Unrecognised keyword/);
  });

  it('refuses keywords it cannot evaluate, rather than passing them', () => {
    const result = compileJsonSchema({ type: 'object', if: { required: ['a'] }, then: {} });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((problem) => problem.keyword).sort()).toEqual(['if', 'then']);
    expect(result.problems[0]?.message).toMatch(/does not implement/);
  });

  it('rejects malformed keyword values with a location', () => {
    const result = compileJsonSchema({
      type: 'sting',
      minLength: -1,
      pattern: '(',
      required: ['a', 'a'],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((problem) => problem.keyword).sort()).toEqual([
      'minLength',
      'pattern',
      'required',
      'type',
    ]);
    expect(result.problems.every((problem) => problem.pointer.startsWith('/'))).toBe(true);
  });

  it('accepts a local $ref that resolves and rejects one that does not', () => {
    expect(
      compileJsonSchema({
        $defs: { Name: { type: 'string' } },
        properties: { name: { $ref: '#/$defs/Name' } },
      }).ok,
    ).toBe(true);

    const broken = compileJsonSchema({ properties: { name: { $ref: '#/$defs/Missing' } } });
    expect(broken.ok).toBe(false);
    if (broken.ok) return;
    expect(broken.problems[0]?.message).toMatch(/does not point at anything/);
  });

  it('refuses remote references, because they would need the network', () => {
    const result = compileJsonSchema({ $ref: 'https://example.com/schema.json' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]?.message).toMatch(/remote reference/);
  });

  it('refuses a schema beyond the size cap', () => {
    const huge = { description: 'x'.repeat(JSON_SCHEMA_LIMITS.maxSchemaChars + 1) };
    const result = compileJsonSchema(huge);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]?.message).toMatch(/larger than/);
  });

  it('warns, without failing, about a format it does not check', () => {
    const result = compile({ type: 'string', format: 'credit-card' });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toMatch(/not checked/);
  });

  it('formats a problem path for display', () => {
    expect(schemaProblemPath({ pointer: '/$defs/Person/type', keyword: 'type', message: '' })).toBe(
      '$/$defs/Person/type',
    );
    expect(schemaProblemPath({ pointer: '', keyword: 'schema', message: '' })).toBe('$');
  });
});

describe('validateInstance', () => {
  it('accepts a conforming document', () => {
    const schema = compile(PERSON).schema;

    expect(
      validateInstance(schema, {
        name: 'Ada',
        age: 36,
        email: 'ada@example.com',
        role: 'writer',
        tags: ['a', 'b'],
      }).errors,
    ).toEqual([]);
  });

  it('reports each missing required property by pointer', () => {
    const errors = errorsFor(PERSON, { age: 4 });

    const missing = errors.filter((error) => error.keyword === 'required');
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      pointer: '/name',
      message: 'Required property `name` is missing.',
    });
  });

  it('reports a wrong type once, without cascading keyword failures', () => {
    const errors = errorsFor(PERSON, { name: 7, age: 4 });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ pointer: '/name', keyword: 'type' });
    expect(errors[0]?.message).toBe('Expected string but found integer.');
  });

  it('reports numeric bounds', () => {
    const errors = errorsFor(PERSON, { name: 'Ada', age: 200 });
    expect(errors.map((error) => error.keyword)).toEqual(['maximum']);
    expect(errors[0]?.pointer).toBe('/age');
  });

  it('accepts an integer where a number is allowed, and rejects a fraction', () => {
    const schema = compile({ type: 'integer' }).schema;
    expect(validateInstance(schema, 2).errors).toEqual([]);
    expect(validateInstance(schema, 2.5).errors).toHaveLength(1);
  });

  it('reports string length and format problems', () => {
    const errors = errorsFor(PERSON, { name: 'A', age: 4, email: 'not-an-email' });

    expect(errors.map((error) => error.keyword)).toEqual(['minLength', 'format']);
    expect(errors[1]?.pointer).toBe('/email');
  });

  it('reports array bounds, item schemas, and duplicates', () => {
    const errors = errorsFor(PERSON, {
      name: 'Ada',
      age: 4,
      tags: ['a', 'a', 'b', 'c'],
    });

    expect(errors.map((error) => error.keyword)).toEqual(['maxItems', 'uniqueItems']);
    expect(errors[1]?.pointer).toBe('/tags/1');

    const typed = errorsFor(PERSON, { name: 'Ada', age: 4, tags: ['a', 3] });
    expect(typed[0]).toMatchObject({ pointer: '/tags/1', keyword: 'type' });
  });

  it('reports an unexpected property when additionalProperties is false', () => {
    const errors = errorsFor(PERSON, { name: 'Ada', age: 4, nickname: 'A' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ pointer: '/nickname', keyword: 'additionalProperties' });
  });

  it('applies a schema-valued additionalProperties', () => {
    const schema = compile({
      properties: { id: { type: 'string' } },
      additionalProperties: { type: 'number' },
    }).schema;

    expect(validateInstance(schema, { id: 'a', score: 3 }).errors).toEqual([]);
    expect(validateInstance(schema, { id: 'a', score: 'high' }).errors).toHaveLength(1);
  });

  it('supports patternProperties', () => {
    const schema = compile({
      patternProperties: { '^x-': { type: 'string' } },
      additionalProperties: false,
    }).schema;

    expect(validateInstance(schema, { 'x-trace': 'abc' }).errors).toEqual([]);
    expect(validateInstance(schema, { 'x-trace': 1 }).errors).toHaveLength(1);
    expect(validateInstance(schema, { other: 1 }).errors).toHaveLength(1);
  });

  it('handles enum and const', () => {
    const errors = errorsFor(PERSON, { name: 'Ada', age: 4, role: 'admin' });
    expect(errors[0]?.message).toBe('Expected one of "writer", "reviewer".');

    const schema = compile({ const: { a: 1 } }).schema;
    expect(validateInstance(schema, { a: 1 }).errors).toEqual([]);
    expect(validateInstance(schema, { a: 2 }).errors).toHaveLength(1);
  });

  it('handles allOf, anyOf, oneOf, and not', () => {
    const anyOf = compile({
      anyOf: [{ type: 'string' }, { type: 'number' }],
    }).schema;
    expect(validateInstance(anyOf, 'x').errors).toEqual([]);
    expect(validateInstance(anyOf, false).errors[0]?.keyword).toBe('anyOf');

    const oneOf = compile({ oneOf: [{ type: 'number' }, { type: 'integer' }] }).schema;
    expect(validateInstance(oneOf, 3).errors[0]?.message).toMatch(/Matches 2 alternatives/);
    expect(validateInstance(oneOf, 3.5).errors).toEqual([]);

    const not = compile({ not: { type: 'string' } }).schema;
    expect(validateInstance(not, 'x').errors[0]?.keyword).toBe('not');
    expect(validateInstance(not, 1).errors).toEqual([]);

    const allOf = compile({ allOf: [{ minimum: 2 }, { maximum: 4 }] }).schema;
    expect(validateInstance(allOf, 3).errors).toEqual([]);
    expect(validateInstance(allOf, 5).errors.map((error) => error.keyword)).toEqual(['maximum']);
  });

  it('follows a local $ref', () => {
    const schema = compile({
      $defs: { Positive: { type: 'number', exclusiveMinimum: 0 } },
      properties: { amount: { $ref: '#/$defs/Positive' } },
    }).schema;

    expect(validateInstance(schema, { amount: 5 }).errors).toEqual([]);
    expect(validateInstance(schema, { amount: 0 }).errors).toHaveLength(1);
  });

  it('stops at a self-referencing schema instead of looping forever', () => {
    const schema = compile({
      $ref: '#/$defs/Loop',
      $defs: { Loop: { $ref: '#/$defs/Loop' } },
    }).schema;
    const result = validateInstance(schema, { a: 1 });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((error) => /too many times/.test(error.message))).toBe(true);
  });

  it('treats the false schema as nothing-allowed', () => {
    expect(validateInstance(false, 1).errors[0]?.keyword).toBe('false');
    expect(validateInstance(true, 1).errors).toEqual([]);
  });

  it('caps the number of reported errors and says so', () => {
    const schema = compile({
      type: 'array',
      items: { type: 'string', minLength: 3 },
    }).schema;

    const result = validateInstance(
      schema,
      Array.from({ length: 300 }, () => 'ab'),
    );

    expect(result.errors).toHaveLength(JSON_SCHEMA_LIMITS.maxErrors);
    expect(result.truncated).toBe(true);
  });

  it('checks minProperties and maxProperties', () => {
    const schema = compile({ minProperties: 1, maxProperties: 2 }).schema;

    expect(validateInstance(schema, {}).errors[0]?.keyword).toBe('minProperties');
    expect(validateInstance(schema, { a: 1, b: 2, c: 3 }).errors[0]?.keyword).toBe('maxProperties');
  });
});

describe('compileJsonSchema — authoring mistakes', () => {
  it('reports a $defs map that is not an object', () => {
    const result = compileJsonSchema({ $defs: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]).toMatchObject({ pointer: '/$defs', keyword: '$defs' });
  });

  it('reports each malformed keyword value with its own pointer', () => {
    const result = compileJsonSchema({
      type: [],
      enum: [],
      multipleOf: 0,
      minimum: '1',
      maximum: true,
      exclusiveMinimum: null,
      maxLength: 1.5,
      format: 3,
      prefixItems: 'nope',
      additionalProperties: 'yes',
      properties: [],
      patternProperties: { '(': {}, ['x'.repeat(600)]: {} },
      required: [1],
      uniqueItems: 'yes',
      allOf: [],
      anyOf: [],
      oneOf: {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    // `patternProperties` can fail twice (a bad pattern and an over-long one).
    const keywords = [...new Set(result.problems.map((problem) => problem.keyword))].sort();
    expect(keywords).toEqual(
      [
        'additionalProperties',
        'allOf',
        'anyOf',
        'enum',
        'exclusiveMinimum',
        'format',
        'maxLength',
        'maximum',
        'minimum',
        'multipleOf',
        'oneOf',
        'patternProperties',
        'prefixItems',
        'properties',
        'required',
        'type',
        'uniqueItems',
      ].sort(),
    );
    expect(result.problems.every((problem) => problem.pointer.startsWith('/'))).toBe(true);
  });

  it('reports a $ref that is not a local string', () => {
    const result = compileJsonSchema({ properties: { a: { $ref: 7 } } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]?.message).toMatch(/Only local references/);
  });

  it('warns about the tuple form of items', () => {
    const result = compile({ items: [{ type: 'string' }, { type: 'number' }] });
    expect(result.warnings[0]?.message).toMatch(/tuple form/);
  });

  it('refuses a schema nested past the depth limit', () => {
    let node: Record<string, unknown> = { type: 'string' };
    for (let depth = 0; depth < JSON_SCHEMA_LIMITS.maxSchemaDepth + 2; depth += 1) {
      node = { properties: { child: node } };
    }

    const result = compileJsonSchema(node);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((problem) => /nests more than/.test(problem.message))).toBe(true);
  });

  it('rejects a value that is not a schema object at all', () => {
    const result = compileJsonSchema({ properties: { a: 42 } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]).toMatchObject({ pointer: '/properties/a', keyword: 'schema' });
  });

  it('accepts every annotation keyword without checking it', () => {
    expect(
      compileJsonSchema({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'https://example.com/s.json',
        title: 'Title',
        description: 'Description',
        default: 1,
        examples: [1, 2],
        deprecated: false,
        readOnly: true,
        writeOnly: false,
        $comment: 'A note',
      }).ok,
    ).toBe(true);
  });
});

describe('validateInstance — formats and numeric rules', () => {
  function formatErrors(format: string, value: string) {
    return errorsFor({ type: 'string', format }, value);
  }

  it('checks the formats it documents', () => {
    expect(formatErrors('uri', 'https://example.com/a')).toEqual([]);
    expect(formatErrors('uri', 'not a uri')).toHaveLength(1);
    expect(formatErrors('date', '2026-10-24')).toEqual([]);
    expect(formatErrors('date', '2026-13-45')).toHaveLength(1);
    expect(formatErrors('date-time', '2026-10-24T09:00:00Z')).toEqual([]);
    expect(formatErrors('date-time', '2026-10-24')).toHaveLength(1);
    expect(formatErrors('time', '09:00')).toEqual([]);
    expect(formatErrors('time', 'nine')).toHaveLength(1);
    expect(formatErrors('uuid', '123e4567-e89b-12d3-a456-426614174000')).toEqual([]);
    expect(formatErrors('uuid', 'nope')).toHaveLength(1);
    expect(formatErrors('ipv4', '10.0.0.1')).toEqual([]);
    expect(formatErrors('ipv4', '10.0.0.300')).toHaveLength(1);
    expect(formatErrors('hostname', 'api.example.com')).toEqual([]);
    expect(formatErrors('hostname', '-bad-')).toHaveLength(1);
  });

  it('applies multipleOf without floating-point false positives', () => {
    const schema = compile({ type: 'number', multipleOf: 0.1 }).schema;
    expect(validateInstance(schema, 0.3).errors).toEqual([]);
    expect(validateInstance(schema, 0.35).errors).toHaveLength(1);
  });

  it('applies exclusive bounds', () => {
    const schema = compile({ exclusiveMinimum: 0, exclusiveMaximum: 10 }).schema;
    expect(validateInstance(schema, 5).errors).toEqual([]);
    expect(validateInstance(schema, 10).errors[0]?.keyword).toBe('exclusiveMaximum');
    expect(validateInstance(schema, 0).errors[0]?.keyword).toBe('exclusiveMinimum');
  });

  it('checks prefixItems positionally and items for the rest', () => {
    const schema = compile({
      type: 'array',
      prefixItems: [{ type: 'string' }, { type: 'number' }],
      items: { type: 'boolean' },
    }).schema;

    expect(validateInstance(schema, ['a', 1, true, false]).errors).toEqual([]);
    const errors = validateInstance(schema, ['a', 'b', true, 3]).errors;
    expect(errors.map((error) => error.pointer).sort()).toEqual(['/1', '/3']);
  });

  it('reads a schema from `definitions` as well as `$defs`', () => {
    const schema = compile({
      definitions: { Name: { type: 'string', minLength: 2 } },
      type: 'object',
      properties: { name: { $ref: '#/definitions/Name' } },
    }).schema;

    expect(validateInstance(schema, { name: 'Ada' }).errors).toEqual([]);
    expect(validateInstance(schema, { name: 'A' }).errors).toHaveLength(1);
  });

  it('counts string length in code points, so an emoji is one character', () => {
    const schema = compile({ type: 'string', maxLength: 1 }).schema;
    expect(validateInstance(schema, '🎉').errors).toEqual([]);
  });

  it('validates nested objects with their own paths', () => {
    const schema = compile({
      type: 'object',
      properties: {
        outer: {
          type: 'object',
          required: ['inner'],
          properties: { inner: { type: 'string' } },
        },
      },
    }).schema;

    expect(validateInstance(schema, { outer: {} }).errors[0]?.pointer).toBe('/outer/inner');
  });
});

describe('validateInstance — arrays, objects, and combinators', () => {
  it('checks array size and uniqueness', () => {
    const schema = compile({ type: 'array', minItems: 2, maxItems: 3, uniqueItems: true }).schema;

    expect(validateInstance(schema, [1, 2]).errors).toEqual([]);
    expect(validateInstance(schema, [1]).errors[0]?.keyword).toBe('minItems');
    expect(validateInstance(schema, [1, 2, 3, 4]).errors[0]?.keyword).toBe('maxItems');
    const duplicate = validateInstance(schema, [1, 2, 1]).errors;
    expect(duplicate).toHaveLength(1);
    expect(duplicate[0]?.pointer).toBe('/2');
  });

  it('checks object size, required names, and additional properties', () => {
    const schema = compile({
      type: 'object',
      minProperties: 1,
      maxProperties: 2,
      required: ['name'],
      properties: { name: { type: 'string' } },
      additionalProperties: false,
    }).schema;

    expect(validateInstance(schema, { name: 'Ada' }).errors).toEqual([]);
    expect(validateInstance(schema, {}).errors[0]?.keyword).toBe('minProperties');
    expect(validateInstance(schema, { name: 'Ada', extra: 1 }).errors[0]?.keyword).toBe(
      'additionalProperties',
    );
    expect(validateInstance(schema, { name: 'Ada', a: 1, b: 2 }).errors[0]?.keyword).toBe(
      'maxProperties',
    );
  });

  it('matches patternProperties and ignores unknown keys by default', () => {
    const schema = compile({
      type: 'object',
      patternProperties: { '^x-': { type: 'string' } },
    }).schema;

    expect(validateInstance(schema, { 'x-note': 'ok', other: 42 }).errors).toEqual([]);
    expect(validateInstance(schema, { 'x-note': 42 }).errors[0]?.pointer).toBe('/x-note');
  });

  it('explains allOf, anyOf, oneOf, and not', () => {
    const allOf = compile({ allOf: [{ type: 'string' }, { minLength: 3 }] }).schema;
    expect(validateInstance(allOf, 'abcd').errors).toEqual([]);
    // allOf reports the failing branch's own keyword, not a generic parent error.
    expect(validateInstance(allOf, 'ab').errors[0]?.keyword).toBe('minLength');

    const anyOf = compile({ anyOf: [{ type: 'string' }, { type: 'number' }] }).schema;
    expect(validateInstance(anyOf, 'x').errors).toEqual([]);
    expect(validateInstance(anyOf, true).errors[0]?.keyword).toBe('anyOf');

    const oneOf = compile({ oneOf: [{ type: 'number' }, { type: 'integer' }] }).schema;
    expect(validateInstance(oneOf, 1.5).errors).toEqual([]);
    expect(validateInstance(oneOf, 1).errors[0]?.message).toMatch(/Matches 2 alternatives/);

    const not = compile({ not: { type: 'string' } }).schema;
    expect(validateInstance(not, 7).errors).toEqual([]);
    expect(validateInstance(not, 'x').errors[0]?.keyword).toBe('not');
  });

  it('checks enum and const by deep equality', () => {
    const schema = compile({ enum: [{ a: 1 }, [1, 2], 'x'] }).schema;
    expect(validateInstance(schema, { a: 1 }).errors).toEqual([]);
    expect(validateInstance(schema, [1, 2]).errors).toEqual([]);
    expect(validateInstance(schema, { a: 2 }).errors[0]?.keyword).toBe('enum');

    expect(validateInstance(compile({ const: 'fixed' }).schema, 'fixed').errors).toEqual([]);
    expect(validateInstance(compile({ const: 'fixed' }).schema, 'other').errors[0]?.keyword).toBe(
      'const',
    );
  });

  it('reports mismatched types with the expected name', () => {
    const errors = validateInstance(compile({ type: 'integer' }).schema, 1.5).errors;
    expect(errors[0]?.message).toMatch(/Expected integer/);
  });

  it('follows a $ref chain and warns when it loops forever', () => {
    const schema = compile({
      $defs: { Node: { type: 'object', properties: { next: { $ref: '#/$defs/Node' } } } },
      $ref: '#/$defs/Node',
    }).schema;

    expect(validateInstance(schema, { next: { next: {} } }).errors).toEqual([]);

    const looping = compile({
      $defs: { Loop: { $ref: '#/$defs/Loop' } },
      $ref: '#/$defs/Loop',
    }).schema;
    expect(validateInstance(looping, 1).errors.some((error) => error.keyword === '$ref')).toBe(
      true,
    );
  });

  it('refuses a $ref to a missing pointer at compile time', () => {
    // A dangling reference is a schema mistake, so it is reported before any
    // document is checked rather than surfacing as a mystery failure later.
    const result = compileJsonSchema({ $ref: '#/$defs/Missing' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]?.keyword).toBe('$ref');
    expect(result.problems[0]?.message).toMatch(/does not point at anything in this schema/);
  });

  it('stops at the error cap and reports truncation', () => {
    const schema = compile({ type: 'array', items: { type: 'string' } }).schema;
    const result = validateInstance(
      schema,
      Array.from({ length: JSON_SCHEMA_LIMITS.maxErrors + 25 }, () => 1),
    );

    expect(result.errors).toHaveLength(JSON_SCHEMA_LIMITS.maxErrors);
    expect(result.truncated).toBe(true);
  });

  it('treats the boolean schemas as everything and nothing', () => {
    expect(validateInstance(true, { anything: true }).errors).toEqual([]);
    const errors = validateInstance(false, 'anything').errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/permits no value/);
  });

  it('surfaces a mismatch at the deepest path, not the root', () => {
    const schema = compile({
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'object', required: ['id'] } } },
    }).schema;

    expect(validateInstance(schema, { items: [{ id: 1 }, {}] }).errors[0]?.pointer).toBe(
      '/items/1/id',
    );
  });

  it('writes a readable path for a compiled problem', () => {
    expect(schemaProblemPath({ pointer: '/properties/a', keyword: 'type', message: '' })).toBe(
      '$/properties/a',
    );
    expect(schemaProblemPath({ pointer: '', keyword: 'type', message: '' })).toBe('$');
  });
});
