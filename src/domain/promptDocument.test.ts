import { describe, expect, it } from 'vitest';

import {
  DOCUMENT_SECTIONS,
  createBlankDocument,
  createSampleDocument,
  dedupeVariables,
  documentStats,
  getDocumentSection,
  isDocumentEmpty,
  isJsonValue,
  isPlainObject,
  normalizeDocument,
  normalizeVariable,
  setDocumentSection,
  validatePromptDocument,
} from '@/domain/promptDocument';
import { PROMPT_DOCUMENT_SCHEMA_VERSION, type PromptDocument } from '@/domain/types';

/** A minimal valid document, built by hand rather than by a factory. */
function minimal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: '1.0',
    name: 'Summarizer',
    role: 'Editor',
    objective: 'Summarize text.',
    instructions: ['Be concise.'],
    context: {},
    constraints: [],
    variables: [],
    output: { format: 'json' },
    examples: [],
    metadata: {},
    includes: [],
    ...overrides,
  };
}

function errorPaths(input: unknown): string[] {
  const result = validatePromptDocument(input);
  return result.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.path);
}

describe('value guards', () => {
  it('accepts only plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject('text')).toBe(false);
  });

  it('accepts JSON data and rejects everything JSON cannot represent', () => {
    expect(isJsonValue(null)).toBe(true);
    expect(isJsonValue('text')).toBe(true);
    expect(isJsonValue(0)).toBe(true);
    expect(isJsonValue(false)).toBe(true);
    expect(isJsonValue({ a: [1, 2, { b: null }] })).toBe(true);

    expect(isJsonValue(Number.NaN)).toBe(false);
    expect(isJsonValue(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isJsonValue(undefined)).toBe(false);
    expect(isJsonValue(() => undefined)).toBe(false);
    expect(isJsonValue(new Date())).toBe(false);
    expect(isJsonValue(new Map())).toBe(false);
  });

  it('rejects cyclic structures without hanging', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic.self = cyclic;
    expect(isJsonValue(cyclic)).toBe(false);

    const shared = { value: 1 };
    expect(isJsonValue({ a: shared, b: shared })).toBe(true);
  });
});

describe('validatePromptDocument', () => {
  it('accepts a minimal document and normalizes whitespace', () => {
    const result = validatePromptDocument(
      minimal({ name: '  Summarizer  ', instructions: ['  Be concise.  '] }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.name).toBe('Summarizer');
    expect(result.value.instructions).toEqual(['Be concise.']);
    expect(result.value.schemaVersion).toBe(PROMPT_DOCUMENT_SCHEMA_VERSION);
    expect(result.issues).toEqual([]);
  });

  it('rejects values that are not objects', () => {
    for (const input of [null, [], 'text', 42, true]) {
      const result = validatePromptDocument(input);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.issues[0]?.message).toMatch(/must be a JSON object/i);
    }
  });

  it('requires a supported schema version', () => {
    expect(errorPaths(minimal({ schemaVersion: undefined }))).toEqual(['schemaVersion']);
    expect(errorPaths(minimal({ schemaVersion: '2.0' }))).toEqual(['schemaVersion']);
    expect(errorPaths(minimal({ schemaVersion: 1 }))).toEqual(['schemaVersion']);
  });

  it('requires a non-empty name and caps its length', () => {
    expect(errorPaths(minimal({ name: '   ' }))).toEqual(['name']);
    expect(errorPaths(minimal({ name: undefined }))).toEqual(['name']);
    expect(errorPaths(minimal({ name: 12 }))).toEqual(['name']);
    expect(errorPaths(minimal({ name: 'x'.repeat(121) }))).toEqual(['name']);
  });

  it('warns instead of failing when role or objective is empty', () => {
    const result = validatePromptDocument(minimal({ role: '', objective: '   ' }));

    expect(result.ok).toBe(true);
    const warnings = result.issues.filter((issue) => issue.severity === 'warning');
    expect(warnings.map((issue) => issue.path)).toEqual(['role', 'objective']);
  });

  it('validates string lists and reports the failing index', () => {
    expect(errorPaths(minimal({ instructions: 'Be concise.' }))).toEqual(['instructions']);
    expect(errorPaths(minimal({ instructions: ['ok', 42] }))).toEqual(['instructions[1]']);

    const result = validatePromptDocument(
      minimal({ instructions: ['ok', '  ', 'ok'], constraints: ['Rule', 'Rule'] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.instructions).toEqual(['ok']);
    expect(result.value.constraints).toEqual(['Rule']);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      'instructions[1]',
      'instructions[2]',
      'constraints[1]',
    ]);
    expect(result.issues.every((issue) => issue.severity === 'warning')).toBe(true);
  });

  it('normalizes variable declarations', () => {
    const result = validatePromptDocument(
      minimal({
        variables: [
          { name: ' version ', type: 'string', required: true, description: ' Release ' },
          { name: 'tone' },
          { name: 'version', type: 'string', required: false },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.variables).toEqual([
      { name: 'version', type: 'string', required: true, description: 'Release' },
      { name: 'tone', type: 'string', required: true },
    ]);
    expect(result.issues).toContainEqual({
      path: 'variables[1].type',
      message: 'Missing type; defaulted to "string".',
      severity: 'warning',
    });
    expect(result.issues).toContainEqual({
      path: 'variables[1].required',
      message: 'Missing required flag; defaulted to true.',
      severity: 'warning',
    });
    expect(result.issues).toContainEqual({
      path: 'variables',
      message: 'Duplicate variable "version" removed.',
      severity: 'warning',
    });
  });

  it('rejects invalid variable names, types, and required flags', () => {
    expect(errorPaths(minimal({ variables: 'nope' }))).toEqual(['variables']);
    expect(errorPaths(minimal({ variables: ['nope'] }))).toEqual(['variables[0]']);
    expect(errorPaths(minimal({ variables: [{}] }))).toEqual(['variables[0].name']);
    expect(errorPaths(minimal({ variables: [{ name: '1bad', type: 'string' }] }))).toEqual([
      'variables[0].name',
    ]);
    expect(errorPaths(minimal({ variables: [{ name: 'ok', type: 'date' }] }))).toEqual([
      'variables[0].type',
    ]);
    expect(
      errorPaths(minimal({ variables: [{ name: 'ok', type: 'string', required: 'yes' }] })),
    ).toEqual(['variables[0].required']);
    expect(
      errorPaths(
        minimal({
          variables: [
            { name: 'ok', type: 'string', required: true, defaultValue: () => undefined },
          ],
        }),
      ),
    ).toEqual(['variables[0].defaultValue']);
  });

  it('accepts any JSON default for a "json" variable', () => {
    const result = validatePromptDocument(
      minimal({
        variables: [
          { name: 'payload', type: 'json', required: false, defaultValue: { nested: [1, 2] } },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('warns when a default value does not match the declared type', () => {
    const result = validatePromptDocument(
      minimal({
        variables: [{ name: 'count', type: 'number', required: true, defaultValue: '3' }],
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.issues).toContainEqual({
      path: 'variables[0].defaultValue',
      message: 'Default value does not match the declared "number" type.',
      severity: 'warning',
    });
  });

  it('accepts every supported variable type and rejects unknown output formats', () => {
    for (const type of ['string', 'number', 'boolean', 'json']) {
      const result = validatePromptDocument(
        minimal({ variables: [{ name: 'value', type, required: false }] }),
      );
      expect(result.ok).toBe(true);
    }

    expect(errorPaths(minimal({ output: 'json' }))).toEqual(['output']);
    expect(errorPaths(minimal({ output: { format: 'yaml' } }))).toEqual(['output.format']);
    expect(errorPaths(minimal({ output: { format: 'xml' } }))).toEqual(['output.format']);
  });

  it('defaults a missing output format with a warning', () => {
    const result = validatePromptDocument(minimal({ output: {} }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.output).toEqual({ format: 'json' });
    expect(result.issues).toContainEqual({
      path: 'output.format',
      message: 'Missing output format; defaulted to "json".',
      severity: 'warning',
    });
  });

  it('keeps schema references and output examples that are JSON', () => {
    const result = validatePromptDocument(
      minimal({ output: { format: 'json', schemaRef: ' schema-1 ', example: { ok: true } } }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.output).toEqual({
      format: 'json',
      schemaRef: 'schema-1',
      example: { ok: true },
    });
  });

  it('validates context, examples, and metadata shapes', () => {
    expect(errorPaths(minimal({ context: [] }))).toEqual(['context']);
    expect(errorPaths(minimal({ context: { description: 5 } }))).toEqual(['context.description']);
    expect(errorPaths(minimal({ context: { references: 'a' } }))).toEqual(['context.references']);
    expect(errorPaths(minimal({ context: { data: () => undefined } }))).toEqual(['context.data']);

    expect(errorPaths(minimal({ examples: {} }))).toEqual(['examples']);
    expect(errorPaths(minimal({ examples: ['a'] }))).toEqual(['examples[0]']);

    expect(errorPaths(minimal({ metadata: 'x' }))).toEqual(['metadata']);
    expect(errorPaths(minimal({ metadata: { author: 5 } }))).toEqual(['metadata.author']);

    const result = validatePromptDocument(
      minimal({
        examples: [{}, { input: 'a', output: 'b' }],
        metadata: { tags: ['Release Notes', 'release-notes', '  Docs '] },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.examples).toEqual([{ input: 'a', output: 'b' }]);
    expect(result.value.metadata.tags).toEqual(['release-notes', 'docs']);
    expect(result.issues).toContainEqual({
      path: 'examples[0]',
      message: 'Example has neither an input nor an output.',
      severity: 'warning',
    });
  });

  it('preserves unknown top-level fields and reports them once', () => {
    const result = validatePromptDocument(
      minimal({ vendor: { id: 7 }, legacyFlag: true, note: undefined }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.extras).toEqual({ vendor: { id: 7 }, legacyFlag: true });
    expect(result.issues.map((issue) => issue.path)).toEqual(['vendor', 'legacyFlag', 'note']);
    expect(result.issues[0]?.message).toMatch(/preserved on round-trip/);
    expect(result.issues[2]?.message).toMatch(/not JSON data and was dropped/);
  });

  it('warns about unknown nested fields but accepts the document', () => {
    const result = validatePromptDocument(
      minimal({ output: { format: 'text', mystery: 1 }, metadata: { author: 'me', extra: 'x' } }),
    );

    expect(result.ok).toBe(true);
    expect(result.issues.map((issue) => issue.path)).toEqual(['output.mystery', 'metadata.extra']);
  });

  it('deduplicates includes', () => {
    const result = validatePromptDocument(
      minimal({ includes: ['snippet-a', 'snippet-a', ' snippet-b '] }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.includes).toEqual(['snippet-a', 'snippet-b']);
  });

  it('returns errors as values and never throws', () => {
    expect(() => validatePromptDocument(undefined)).not.toThrow();
    expect(() => validatePromptDocument(Symbol('x'))).not.toThrow();
    const result = validatePromptDocument(minimal({ name: '' }));
    expect(result.ok).toBe(false);
    expect(Array.isArray(result.issues)).toBe(true);
  });
});

describe('normalizeDocument', () => {
  it('is idempotent', () => {
    const once = normalizeDocument(createSampleDocument());
    const twice = normalizeDocument(once);
    expect(twice).toEqual(once);
  });

  it('trims strings, drops empty list entries and duplicate variables', () => {
    const document: PromptDocument = {
      ...createBlankDocument(),
      name: '  Name  ',
      role: '  Role ',
      instructions: [' one ', ' ', 'one'],
      context: { description: '  ctx  ', references: [' a ', 'a'] },
      metadata: { author: ' me ', notes: '  ', tags: ['Alpha Beta', 'alpha-beta'] },
      includes: [' s ', 's'],
    };

    const result = normalizeDocument(document);

    expect(result.name).toBe('Name');
    expect(result.role).toBe('Role');
    expect(result.instructions).toEqual(['one']);
    expect(result.context).toEqual({ description: 'ctx', references: ['a'] });
    expect(result.metadata).toEqual({ author: 'me', tags: ['alpha-beta'] });
    expect(result.includes).toEqual(['s']);
  });
});

describe('canonical documents', () => {
  it('creates a blank document that validates cleanly', () => {
    const document = createBlankDocument();
    const result = validatePromptDocument(document);

    expect(document.name).toBe('Untitled prompt');
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([
      {
        path: 'role',
        message: '"role" is empty; prompts are clearer with one.',
        severity: 'warning',
      },
      {
        path: 'objective',
        message: '"objective" is empty; prompts are clearer with one.',
        severity: 'warning',
      },
    ]);
    expect(isDocumentEmpty(document)).toBe(true);
  });

  it('accepts overrides when creating a blank document', () => {
    const document = createBlankDocument({ name: 'Draft', instructions: ['Do the thing.'] });
    expect(document.name).toBe('Draft');
    expect(document.instructions).toEqual(['Do the thing.']);
  });

  it('provides a sample document that validates without errors', () => {
    const sample = createSampleDocument();
    const result = validatePromptDocument(sample);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(sample.variables).toHaveLength(3);
    expect(sample.examples).toHaveLength(1);
    expect(isDocumentEmpty(sample)).toBe(false);
  });
});

describe('section helpers', () => {
  it('describes every section once', () => {
    const keys = DOCUMENT_SECTIONS.map((section) => section.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(11);
    expect(keys).toContain('instructions');
  });

  it('reads and replaces a section without mutating the document', () => {
    const sample = createSampleDocument();
    const updated = setDocumentSection(sample, 'constraints', ['New rule']);

    expect(getDocumentSection(sample, 'constraints')).not.toEqual(['New rule']);
    expect(getDocumentSection(updated, 'constraints')).toEqual(['New rule']);
    expect(updated.instructions).toEqual(sample.instructions);
    expect(sample.constraints.length).toBeGreaterThan(0);
  });

  it('reports document statistics', () => {
    const stats = documentStats(createSampleDocument());

    expect(stats.instructions).toBe(4);
    expect(stats.constraints).toBe(3);
    expect(stats.variables).toBe(3);
    expect(stats.requiredVariables).toBe(2);
    expect(stats.examples).toBe(1);
    expect(stats.includes).toBe(0);
    expect(stats.characterCount).toBeGreaterThan(100);
    expect(stats.filledSections).toBe(10);
  });

  it('counts a blank document as empty with no filled sections', () => {
    const blank = createBlankDocument();
    // The default name and the default output format count as filled.
    expect(documentStats(blank).filledSections).toBe(2);
    expect(documentStats(blank).characterCount).toBe(0);
  });
});

describe('variable helpers', () => {
  it('normalizes a declaration and drops unusable defaults', () => {
    expect(
      normalizeVariable({ name: ' n ', type: 'number', required: false, defaultValue: Number.NaN }),
    ).toEqual({ name: 'n', type: 'number', required: false });

    expect(
      normalizeVariable({ name: 'x', type: 'boolean', required: true, defaultValue: false }),
    ).toEqual({ name: 'x', type: 'boolean', required: true, defaultValue: false });
  });

  it('dedupes by name and reports the losers', () => {
    const result = dedupeVariables([
      { name: 'a', type: 'string', required: true },
      { name: 'b', type: 'string', required: true },
      { name: 'a', type: 'number', required: false },
    ]);

    expect(result.variables.map((variable) => variable.name)).toEqual(['a', 'b']);
    expect(result.duplicates).toEqual(['a']);
  });
});
