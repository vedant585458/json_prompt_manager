import { beforeEach, describe, expect, it } from 'vitest';

import { createPrompt, createPromptSchema } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type { JsonValue, Prompt } from '@/domain/types';
import {
  VALIDATION_LIMITS,
  clearSchemaCache,
  compileSchema,
  countSchemaUsage,
  describeValidation,
  findLineForPath,
  findSchemaProblems,
  pathToPointer,
  pointerToPath,
  validateJsonText,
  validateJsonValue,
} from '@/domain/validation';

const DOCUMENT = {
  ...createBlankDocument({ name: 'Invoice parser' }),
} as unknown as JsonValue;

const INVOICE_SCHEMA = {
  type: 'object',
  required: ['name', 'objective', 'schemaVersion'],
  properties: {
    name: { type: 'string', minLength: 3 },
    objective: { type: 'string' },
    schemaVersion: { const: '1.0' },
  },
} as const;

beforeEach(() => {
  clearSchemaCache();
});

describe('validateJsonText — syntax', () => {
  it('reports a syntax error with a line and column and stops there', () => {
    const report = validateJsonText('{\n  "name": \n}', { schema: INVOICE_SCHEMA });

    expect(report.status).toBe('invalid');
    expect(report.syntaxOk).toBe(false);
    expect(report.schemaStatus).toBe('unchecked');
    expect(report.conforms).toBeNull();
    expect(report.counts.syntax).toBe(1);
    expect(report.issues[0]).toMatchObject({ kind: 'syntax', severity: 'error', line: 3 });
    expect(report.issues[0]?.column).toBeGreaterThan(0);
  });

  it('says nothing was checked when the document is beyond the size cap', () => {
    const report = validateJsonText('x'.repeat(VALIDATION_LIMITS.maxTextChars + 1));

    expect(report.status).toBe('skipped');
    expect(report.valid).toBe(false);
    expect(report.skippedReason).toMatch(/larger than/);
    expect(report.issues).toEqual([]);
  });
});

describe('validateJsonText — document shape', () => {
  it('reports a conforming prompt document as valid', () => {
    const report = validateJsonText(JSON.stringify(DOCUMENT));

    expect(report.status).toBe('valid');
    expect(report.counts).toMatchObject({ syntax: 0, schema: 0, document: 0, errors: 0 });
    expect(report.schemaStatus).toBe('none');
  });

  it('turns prompt-document findings into warnings, not errors', () => {
    const report = validateJsonText('{"name":"Only a name"}');

    expect(report.status).toBe('warning');
    expect(report.valid).toBe(false);
    expect(report.counts.errors).toBe(0);
    expect(report.counts.document).toBeGreaterThan(0);
    expect(report.issues.every((issue) => issue.kind === 'document')).toBe(true);
    expect(report.issues.every((issue) => issue.severity === 'warning')).toBe(true);
    expect(report.issues.some((issue) => /schema version/i.test(issue.message))).toBe(true);
  });

  it('can skip the document rules for arbitrary JSON', () => {
    const report = validateJsonText('{"anything":true}', { checkDocument: false });
    expect(report.status).toBe('valid');
  });
});

describe('validateJsonText — schema conformance', () => {
  it('accepts a document that meets the schema', () => {
    const report = validateJsonText(JSON.stringify(DOCUMENT), { schema: INVOICE_SCHEMA });

    expect(report.schemaStatus).toBe('checked');
    expect(report.conforms).toBe(true);
    expect(report.status).toBe('valid');
    expect(report.counts.schema).toBe(0);
  });

  it('reports per-path schema errors without blaming the schema', () => {
    const document = { ...(DOCUMENT as Record<string, JsonValue>), name: 'x' };
    const report = validateJsonText(JSON.stringify(document), { schema: INVOICE_SCHEMA });

    expect(report.status).toBe('invalid');
    expect(report.conforms).toBe(false);
    expect(report.counts.schema).toBe(1);
    expect(report.issues[0]).toMatchObject({
      kind: 'schema',
      severity: 'error',
      path: '$.name',
      pointer: '/name',
      keyword: 'minLength',
    });
  });

  it('reports a rejected schema as a schema problem and does not invent document errors', () => {
    const report = validateJsonText(JSON.stringify(DOCUMENT), {
      schema: { type: 'object', requird: ['name'] },
    });

    expect(report.schemaStatus).toBe('rejected');
    expect(report.conforms).toBeNull();
    expect(report.counts.schema).toBe(1);
    expect(report.issues[0]?.path).toBe('$/requird');
    expect(report.issues.some((issue) => issue.kind === 'document')).toBe(false);
  });

  it('surfaces schema notes separately from findings', () => {
    const report = validateJsonText(JSON.stringify({ name: 'Ada' }), {
      schema: { type: 'object', properties: { name: { type: 'string', format: 'credit-card' } } },
      checkDocument: false,
    });

    expect(report.schemaWarnings).toHaveLength(1);
    expect(report.status).toBe('valid');
  });

  it('carries truncation through when the error cap is reached', () => {
    const report = validateJsonValue(
      Array.from({ length: 200 }, () => 'ab') as unknown as JsonValue,
      { schema: { type: 'array', items: { type: 'string', minLength: 3 } }, checkDocument: false },
    );

    expect(report.truncated).toBe(true);
  });
});

describe('pointerToPath', () => {
  it('converts JSON Pointers to the app’s path notation', () => {
    expect(pointerToPath('')).toBe('$');
    expect(pointerToPath('/name')).toBe('$.name');
    expect(pointerToPath('/variables/0/name')).toBe('$.variables[0].name');
    expect(pointerToPath('/a~1b')).toBe("$['a/b']");
  });
});

describe('paths', () => {
  it('round-trips a path to a pointer and back', () => {
    expect(pathToPointer('$.variables[0].name')).toBe('/variables/0/name');
    expect(pathToPointer('$')).toBe('');
    expect(pointerToPath(pathToPointer('$.a.b'))).toBe('$.a.b');
  });

  it('finds the line holding a nested key', () => {
    const text =
      '{\n  "name": "Ada",\n  "objective": "Ship it",\n  "variables": [\n    { "name": "x" }\n  ]\n}';

    expect(findLineForPath(text, '$.objective')).toBe(3);
    expect(findLineForPath(text, '$.name')).toBe(2);
  });

  it('returns null rather than guessing when the key is absent', () => {
    const text = '{\n  "name": "Ada"\n}';
    expect(findLineForPath(text, '$.missing')).toBeNull();
    expect(findLineForPath(text, '$')).toBeNull();
  });
});

describe('schema compilation cache', () => {
  it('reuses a compiled schema for identical content', () => {
    const first = compileSchema(INVOICE_SCHEMA);
    const second = compileSchema({ ...INVOICE_SCHEMA });

    expect(first).toBe(second);
  });

  it('recompiles after the cache is cleared', () => {
    const first = compileSchema(INVOICE_SCHEMA);
    clearSchemaCache();
    expect(compileSchema(INVOICE_SCHEMA)).not.toBe(first);
  });
});

describe('library helpers', () => {
  const schema = createPromptSchema(
    {
      name: 'Invoice shape',
      schemaContent: INVOICE_SCHEMA as unknown as Record<string, JsonValue>,
    },
    { now: () => new Date('2026-10-24T09:00:00.000Z'), newId: () => 'schema-1' },
  );

  function promptWith(overrides: Partial<Prompt>): Prompt {
    const base = createPrompt(
      {
        title: overrides.title ?? 'Invoice parser',
        content: createBlankDocument({ name: 'Invoice parser' }),
      },
      { now: () => new Date('2026-10-24T09:00:00.000Z'), newId: () => overrides.id ?? 'alpha' },
    );
    return { ...base, ...overrides };
  }

  it('finds prompts whose attached schema rejects them', () => {
    const passing = promptWith({ id: 'alpha', schemaId: schema.id });
    const failing = promptWith({
      id: 'beta',
      title: 'Broken invoice',
      schemaId: schema.id,
      content: { ...passing.content, name: 'x' },
    });
    const unattached = promptWith({ id: 'gamma' });

    const problems = findSchemaProblems([passing, failing, unattached], [schema]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ promptId: 'beta', schemaName: 'Invoice shape' });
    expect(problems[0]?.issues[0]?.path).toBe('$.name');
  });

  it('reports a schema that cannot be compiled as a problem for every prompt using it', () => {
    const broken = createPromptSchema(
      { name: 'Broken', schemaContent: { type: 'object', requird: ['name'] } },
      { now: () => new Date(), newId: () => 'schema-broken' },
    );
    const prompt = promptWith({ id: 'delta', schemaId: broken.id });

    const problems = findSchemaProblems([prompt], [broken]);
    expect(problems[0]?.issues[0]?.path).toBe('$/requird');
  });

  it('counts schema usage for a deletion warning', () => {
    expect(
      countSchemaUsage(
        [
          promptWith({ id: 'a', schemaId: 's' }),
          promptWith({ id: 'b' }),
          promptWith({ id: 'c', schemaId: 's' }),
        ],
        's',
      ),
    ).toBe(2);
  });
});

describe('describeValidation', () => {
  it('states exactly what was checked', () => {
    expect(describeValidation(validateJsonText(JSON.stringify(DOCUMENT)))).toBe(
      'Valid JSON, and the document matches the PromptForge shape.',
    );
    expect(
      describeValidation(validateJsonText(JSON.stringify(DOCUMENT), { schema: INVOICE_SCHEMA })),
    ).toBe('Valid JSON, and the document meets the attached schema.');
    expect(describeValidation(validateJsonText('{}'))).toMatch(/^Valid JSON — 5 document warnings/);
    expect(describeValidation(validateJsonText('{'))).toBe(
      'The text is not valid JSON, so nothing else was checked.',
    );
  });

  it('never claims quality', () => {
    const text = describeValidation(
      validateJsonText(JSON.stringify(DOCUMENT), { schema: INVOICE_SCHEMA }),
    );
    expect(text).not.toMatch(/quality|good|excellent|perfect/i);
  });
});

describe('bounded work and honest refusals', () => {
  it('refuses to deep-validate text past the size limit', () => {
    const huge = `{"name":"${'x'.repeat(VALIDATION_LIMITS.maxTextChars)}"}`;
    const report = validateJsonText(huge);

    expect(report.status).toBe('skipped');
    expect(report.counts.total).toBe(0);
    expect(describeValidation(report)).toMatch(/larger than/);
  });

  it('skips the shape check when asked to validate arbitrary JSON', () => {
    const report = validateJsonText('{"anything":1}', { checkDocument: false });
    expect(report.counts.document).toBe(0);
    expect(report.status).toBe('valid');
  });

  it('keeps the compile cache bounded', () => {
    clearSchemaCache();
    const schemas = Array.from({ length: VALIDATION_LIMITS.maxCachedSchemas + 4 }, (_, index) => ({
      type: 'object',
      title: `Schema ${index}`,
    }));

    const first = compileSchema(schemas[0]);
    for (const schema of schemas) compileSchema(schema);

    // The oldest entry was evicted, so compiling it again builds a new object.
    expect(compileSchema(schemas[0])).not.toBe(first);
    clearSchemaCache();
  });

  it('describes schema and document findings without praising anything', () => {
    const report = validateJsonText('{"name":"x"}', {
      schema: { type: 'object', required: ['name'], properties: { name: { minLength: 4 } } },
    });

    expect(report.counts.schema).toBe(1);
    expect(describeValidation(report)).toMatch(/^Valid JSON — 1 schema error,/);
    expect(describeValidation(report)).not.toMatch(/quality|good|perfect/i);
  });

  it('says when a schema was rejected rather than pretending it passed', () => {
    const report = validateJsonText(JSON.stringify(DOCUMENT), {
      schema: { type: 'object', requird: ['name'] },
    });

    expect(report.schemaStatus).toBe('rejected');
    // Nothing was checked against it, so conformance is unknown, not `false`.
    expect(report.conforms).toBeNull();
    expect(describeValidation(report)).toMatch(
      /attached schema could not be used \(1 schema problem\)/,
    );
  });

  it('states each outcome in words', () => {
    const unclean = validateJsonText('{}');
    expect(describeValidation(unclean)).toMatch(/document warning/);

    const empty = validateJsonText(JSON.stringify(DOCUMENT));
    expect(describeValidation(empty)).toMatch(/matches the PromptForge shape/);
  });
});

describe('pointer and path details', () => {
  it('escapes and unescapes pointer segments', () => {
    expect(pathToPointer("$['a/b']")).toBe('/a~1b');
    expect(pathToPointer('$.a~b')).toBe('/a~0b');
    expect(pointerToPath('/a~1b/c~0d')).toBe("$['a/b']['c~d']");
  });

  it('treats the root as the empty pointer', () => {
    expect(pointerToPath('')).toBe('$');
    expect(pathToPointer('$')).toBe('');
    expect(pathToPointer('$.items[2]')).toBe('/items/2');
  });
});
