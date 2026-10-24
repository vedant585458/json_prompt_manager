import { describe, expect, it } from 'vitest';

import {
  COMPOSER_STARTERS,
  SNIPPET_TARGETS,
  applyComposerPatch,
  applySnippet,
  composerIssues,
  createComposerDocument,
  defaultSnippetTarget,
  describeCompleteness,
  describeJsonFieldKey,
  hasComposerErrors,
  issueForField,
  moveListItem,
  readComposerView,
  snippetValueFits,
  type ComposerVariable,
} from '@/domain/composer';
import { validatePromptDocument } from '@/domain/promptDocument';
import { formatDocumentJson } from '@/domain/serialization';
import type { JsonObject, Snippet } from '@/domain/types';

const NOW = '2026-10-24T09:00:00.000Z';

function baseRaw(): JsonObject {
  return {
    schemaVersion: '1.0',
    name: 'Invoice parser',
    role: 'Finance analyst',
    objective: 'Extract line items.',
    instructions: ['Read the invoice.', 'Return JSON.'],
    context: {
      description: 'Invoices come from email.',
      references: ['Policy'],
      data: { currency: 'EUR' },
    },
    constraints: ['Do not invent totals.'],
    variables: [
      { name: 'invoice', type: 'string', required: true, description: 'Raw text' },
      { name: 'strict', type: 'boolean', required: false, defaultValue: true },
    ],
    output: { format: 'json', schemaRef: 'schema-1', example: { total: 10 } },
    examples: [{ input: { a: 1 }, output: { b: 2 } }],
    metadata: { author: 'Ada', tags: ['finance'], notes: ' Reviewed. ' },
    includes: ['snippet-1'],
  };
}

function snippet(overrides: Partial<Snippet> = {}): Snippet {
  return {
    id: 'snippet-1',
    name: 'Tone block',
    description: 'A short tone instruction.',
    targetPath: 'context.description',
    value: 'Concise.',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function variable(overrides: Partial<ComposerVariable> = {}): ComposerVariable {
  return {
    name: 'invoice',
    type: 'string',
    required: true,
    description: '',
    extras: {},
    ...overrides,
  };
}

describe('readComposerView', () => {
  it('reads every section of a complete document', () => {
    const view = readComposerView(baseRaw());

    expect(view).toMatchObject({
      name: 'Invoice parser',
      role: 'Finance analyst',
      objective: 'Extract line items.',
      instructions: ['Read the invoice.', 'Return JSON.'],
      constraints: ['Do not invent totals.'],
      contextDescription: 'Invoices come from email.',
      contextReferences: ['Policy'],
      contextData: { currency: 'EUR' },
      outputFormat: 'json',
      outputSchemaRef: 'schema-1',
      outputExample: { total: 10 },
      author: 'Ada',
      tags: ['finance'],
      includes: ['snippet-1'],
    });
    expect(view.variables).toHaveLength(2);
    expect(view.variables[1]).toMatchObject({
      name: 'strict',
      type: 'boolean',
      defaultValue: true,
    });
    expect(view.extras).toEqual([]);
  });

  it('tolerates a document that is missing or has wrong types', () => {
    const view = readComposerView({
      name: 42,
      instructions: 'not a list',
      context: [],
      output: { format: 'csv' },
      variables: 'nope',
      examples: null,
      metadata: 'nope',
    } as unknown as JsonObject);

    expect(view.name).toBe('');
    expect(view.instructions).toEqual([]);
    expect(view.contextDescription).toBe('');
    expect(view.outputFormat).toBe('json');
    expect(view.variables).toEqual([]);
    expect(view.examples).toEqual([]);
    expect(view.author).toBe('');
    expect(view.outputExample).toBeUndefined();
  });

  it('drops non-string list entries instead of inventing text', () => {
    const view = readComposerView({
      instructions: ['Keep me', 3, null],
      metadata: { tags: ['a', 7] },
    } as unknown as JsonObject);

    expect(view.instructions).toEqual(['Keep me']);
    expect(view.tags).toEqual(['a']);
  });

  it('names the top-level fields the form does not render', () => {
    const view = readComposerView({ ...baseRaw(), temperature: 0.2, notes2: 'x' });
    expect(view.extras).toEqual(['temperature', 'notes2']);
  });

  it('carries an unreadable variable and example through verbatim', () => {
    const view = readComposerView({
      ...baseRaw(),
      variables: ['loose', { name: 'ok', type: 'string', required: true }],
      examples: [7],
    });

    expect(view.variables[0]?.unreadable).toBe('loose');
    expect(view.examples[0]?.unreadable).toBe(7);
  });
});

describe('applyComposerPatch', () => {
  it('edits scalar fields without touching anything else', () => {
    const raw = baseRaw();
    const next = applyComposerPatch(raw, { field: 'role', value: 'Support lead' });

    expect(next.role).toBe('Support lead');
    expect(next.objective).toBe(raw.objective);
    expect(next.context).toEqual(raw.context);
    expect(raw.role).toBe('Finance analyst');
  });

  it('keeps unknown top-level and nested fields through every patch', () => {
    const raw: JsonObject = {
      ...baseRaw(),
      temperature: 0.4,
      context: { description: 'Kept', retrieval: { topK: 3 } },
      metadata: { author: 'Ada', reviewState: 'approved' },
      output: { format: 'json', strictMode: true },
    };

    let next = applyComposerPatch(raw, { field: 'objective', value: 'New goal' });
    next = applyComposerPatch(next, { field: 'context.description', value: 'Changed' });
    next = applyComposerPatch(next, { field: 'metadata.author', value: 'Grace' });
    next = applyComposerPatch(next, { field: 'output.format', value: 'text' });

    expect(next.temperature).toBe(0.4);
    expect(next.context).toEqual({ description: 'Changed', retrieval: { topK: 3 } });
    expect(next.metadata).toEqual({ author: 'Grace', reviewState: 'approved' });
    expect(next.output).toEqual({ format: 'text', strictMode: true });
  });

  it('removes a nested key when the field is cleared, and nothing else', () => {
    const raw: JsonObject = { ...baseRaw(), context: { description: 'x', retrieval: true } };

    const noDescription = applyComposerPatch(raw, { field: 'context.description', value: '   ' });
    expect(noDescription.context).toEqual({ retrieval: true });

    const noData = applyComposerPatch(raw, { field: 'context.data', value: undefined });
    expect(noData.context).toEqual({ description: 'x', retrieval: true });

    const noSchema = applyComposerPatch(raw, { field: 'output.schemaRef', value: '' });
    expect(noSchema.output).toEqual({ format: 'json', example: { total: 10 } });
  });

  it('writes variables with their extra keys and omits an empty description', () => {
    const next = applyComposerPatch(baseRaw(), {
      field: 'variables',
      value: [
        variable({ name: 'a', description: '  ' }),
        variable({
          name: 'b',
          type: 'json',
          required: false,
          defaultValue: { any: true },
          extras: { deprecated: false },
        }),
      ],
    });

    expect(next.variables).toEqual([
      { name: 'a', type: 'string', required: true },
      {
        deprecated: false,
        name: 'b',
        type: 'json',
        required: false,
        defaultValue: { any: true },
      },
    ]);
  });

  it('writes an unreadable entry back unchanged', () => {
    const raw: JsonObject = { ...baseRaw(), variables: ['loose'] };
    const view = readComposerView(raw);
    const next = applyComposerPatch(raw, { field: 'variables', value: view.variables });

    expect(next.variables).toEqual(['loose']);
  });

  it('writes examples with extras and skips empty sides', () => {
    const next = applyComposerPatch(baseRaw(), {
      field: 'examples',
      value: [
        { input: 'text', extras: { note: 'kept' } },
        { extras: {} },
        { output: { total: 1 }, extras: {} },
      ],
    });

    expect(next.examples).toEqual([{ note: 'kept', input: 'text' }, {}, { output: { total: 1 } }]);
  });

  it('sets the output format and metadata lists', () => {
    let next = applyComposerPatch(baseRaw(), { field: 'output.format', value: 'markdown' });
    expect(next.output).toMatchObject({ format: 'markdown' });

    next = applyComposerPatch(next, { field: 'metadata.tags', value: ['a', 'b'] });
    expect(next.metadata).toMatchObject({ tags: ['a', 'b'] });

    next = applyComposerPatch(next, { field: 'metadata.tags', value: [] });
    expect(next.metadata).not.toHaveProperty('tags');
  });
});

describe('moveListItem', () => {
  it('moves an entry and returns a new list', () => {
    const list = ['a', 'b', 'c'];
    expect(moveListItem(list, 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveListItem(list, 2, -1)).toEqual(['a', 'c', 'b']);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('does nothing at the edges or with a nonsense index', () => {
    expect(moveListItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveListItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(moveListItem(['a', 'b'], 9, -1)).toEqual(['a', 'b']);
  });
});

describe('composerIssues', () => {
  it('says nothing about a complete, valid draft', () => {
    expect(composerIssues(readComposerView(baseRaw()))).toEqual([]);
  });

  it('requires a name and warns about an empty objective', () => {
    const issues = composerIssues(readComposerView({ ...baseRaw(), name: '  ', objective: '' }));

    expect(issueForField(issues, 'name')).toMatchObject({ severity: 'error' });
    expect(issueForField(issues, 'objective')).toMatchObject({ severity: 'warning' });
    expect(hasComposerErrors(issues)).toBe(true);
  });

  it('rejects an invalid variable name and a duplicate', () => {
    const issues = composerIssues(
      readComposerView({
        ...baseRaw(),
        variables: [
          { name: 'good', type: 'string', required: true },
          { name: '2bad', type: 'string', required: true },
          { name: 'good', type: 'string', required: true },
        ],
      }),
    );

    const messages = issues.map((issue) => issue.message);
    expect(messages.some((message) => message.includes('not a usable variable name'))).toBe(true);
    expect(messages.some((message) => message.includes('already declared at position 1'))).toBe(
      true,
    );
    expect(issues.every((issue) => issue.severity === 'error')).toBe(true);
  });

  it('rejects a default that does not match the declared type', () => {
    const issues = composerIssues(
      readComposerView({
        ...baseRaw(),
        variables: [{ name: 'count', type: 'number', required: false, defaultValue: 'three' }],
      }),
    );

    expect(issues[0]).toMatchObject({
      field: 'variables',
      path: 'variables[0].defaultValue',
      severity: 'error',
    });
  });

  it('warns about unreadable rows and an empty example', () => {
    const issues = composerIssues(
      readComposerView({
        ...baseRaw(),
        variables: [3],
        examples: [{}],
      }),
    );

    expect(issues.filter((issue) => issue.severity === 'warning')).toHaveLength(2);
    expect(hasComposerErrors(issues)).toBe(false);
  });

  it('warns about a schema reference that is not stored', () => {
    const issues = composerIssues(readComposerView(baseRaw()), { schemaIds: ['other'] });
    expect(issueForField(issues, 'output.schemaRef')).toMatchObject({ severity: 'warning' });
  });

  it('warns about an include that is not in the snippet library', () => {
    const issues = composerIssues(readComposerView(baseRaw()), { snippetIds: [] });
    expect(issueForField(issues, 'includes')?.message).toMatch(/not in this library/);
  });

  it('names fields outside the form so they are never a surprise', () => {
    const issues = composerIssues(readComposerView({ ...baseRaw(), temperature: 0.2 }));
    expect(issueForField(issues, 'extras')?.message).toMatch(/outside this form \(temperature\)/);
  });
});

describe('describeCompleteness', () => {
  it('counts filled sections and names the empty ones', () => {
    const completeness = describeCompleteness(readComposerView(baseRaw()));
    expect(completeness.completed).toBe(6);
    expect(completeness.missing).toEqual([]);
  });

  it('starts at zero for a blank document, which is honest rather than a score', () => {
    const completeness = describeCompleteness(readComposerView(createComposerDocument()));
    expect(completeness.completed).toBe(0);
    expect(completeness.total).toBe(6);
    expect(completeness.missing).toEqual([
      'Identity',
      'Task',
      'Context',
      'Variables',
      'Output',
      'Metadata',
    ]);
  });
});

describe('snippets', () => {
  it('offers the sections a snippet can fill, and falls back honestly', () => {
    expect(SNIPPET_TARGETS.map((target) => target.id)).toContain('context.description');
    expect(defaultSnippetTarget(snippet())).toBe('context.description');
    expect(defaultSnippetTarget(snippet({ targetPath: 'context.data' }))).toBe('instructions');
  });

  it('checks that a value fits the chosen section', () => {
    const text = SNIPPET_TARGETS.find((target) => target.id === 'objective');
    const list = SNIPPET_TARGETS.find((target) => target.id === 'instructions');
    if (!text || !list) throw new Error('targets missing');

    expect(snippetValueFits(text, 'hello')).toBe(true);
    expect(snippetValueFits(text, ['hello'])).toBe(false);
    expect(snippetValueFits(list, ['a', 'b'])).toBe(true);
    expect(snippetValueFits(list, ['a', ''])).toBe(false);
  });

  it('inserts text into an empty section and records the include', () => {
    const result = applySnippet(
      { ...baseRaw(), objective: '' },
      snippet({ id: 's9', value: 'Extract tables.', targetPath: 'objective' }),
      'objective',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.raw.objective).toBe('Extract tables.');
    expect(result.raw.includes).toEqual(['snippet-1', 's9']);
    expect(result.message).toMatch(/^Inserted/);
  });

  it('replaces text that is already there and says so', () => {
    const result = applySnippet(baseRaw(), snippet({ value: 'Verbose.' }), 'context.description');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.raw.context).toMatchObject({ description: 'Verbose.', references: ['Policy'] });
    expect(result.message).toMatch(/^Replaced the context description/);
  });

  it('appends list entries, skipping duplicates', () => {
    const once = applySnippet(
      baseRaw(),
      snippet({ value: ['Be brief.', 'Cite sources.'] }),
      'instructions',
    );
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    expect(once.raw.instructions).toEqual([
      'Read the invoice.',
      'Return JSON.',
      'Be brief.',
      'Cite sources.',
    ]);

    const twice = applySnippet(once.raw, snippet({ value: ['Be brief.'] }), 'instructions');
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(twice.raw.instructions).toEqual(once.raw.instructions);
    expect(twice.message).toMatch(/already in instructions/);
  });

  it('refuses a value that does not fit, and changes nothing', () => {
    const raw = baseRaw();
    const result = applySnippet(raw, snippet({ value: ['list'] }), 'objective');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/does not fit objective/);
    expect(raw.objective).toBe('Extract line items.');
  });
});

describe('starters', () => {
  it('makes a blank document that passes the document rules', () => {
    const result = validatePromptDocument(createComposerDocument());
    expect(result.ok).toBe(true);
  });

  it('offers a blank and a worked starter that both validate', () => {
    expect(COMPOSER_STARTERS.map((starter) => starter.id)).toEqual(['blank', 'sample']);

    for (const starter of COMPOSER_STARTERS) {
      const result = validatePromptDocument(starter.create());
      expect(result.ok, starter.id).toBe(true);
    }
  });

  it('serializes a draft with the canonical key order and keeps extras last', () => {
    const text = formatDocumentJson({ ...createComposerDocument(), zeta: 1, alpha: 2 });
    const keys = Object.keys(JSON.parse(text) as Record<string, unknown>);

    expect(keys[0]).toBe('schemaVersion');
    expect(keys.slice(-2)).toEqual(['zeta', 'alpha']);
    expect(text).toContain('\n  "name"');
  });
});

describe('describeJsonFieldKey', () => {
  it('names the JSON fields a person can point at', () => {
    expect(describeJsonFieldKey('context.data')).toBe('Structured data');
    expect(describeJsonFieldKey('output.example')).toBe('Example output');
    expect(describeJsonFieldKey('variables[2].defaultValue')).toBe('Variable 3 default value');
    expect(describeJsonFieldKey('examples[0].input')).toBe('Example 1 input');
    expect(describeJsonFieldKey('something.else')).toBe('something.else');
  });
});

describe('more patch and snippet paths', () => {
  it('clears and sets the remaining metadata, context, output, and include fields', () => {
    const raw = baseRaw();

    expect(
      applyComposerPatch(raw, { field: 'metadata.author', value: '' }).metadata,
    ).not.toHaveProperty('author');
    expect(
      applyComposerPatch(raw, { field: 'context.references', value: [] }).context,
    ).not.toHaveProperty('references');
    expect(
      applyComposerPatch(raw, { field: 'output.example', value: undefined }).output,
    ).not.toHaveProperty('example');
    expect(
      applyComposerPatch(raw, { field: 'output.example', value: { total: 2 } }).output,
    ).toMatchObject({
      example: { total: 2 },
    });
    expect(applyComposerPatch(raw, { field: 'includes', value: ['snippet-2'] }).includes).toEqual([
      'snippet-2',
    ]);
    expect(
      applyComposerPatch(raw, { field: 'metadata.notes', value: 'New note' }).metadata,
    ).toMatchObject({
      notes: 'New note',
    });
  });

  it('writes an unreadable example back unchanged', () => {
    const raw: JsonObject = { ...baseRaw(), examples: [7] };
    const view = readComposerView(raw);
    expect(applyComposerPatch(raw, { field: 'examples', value: view.examples }).examples).toEqual([
      7,
    ]);
  });

  it('inserts a text snippet into notes and a list snippet into references', () => {
    const notes = applySnippet(
      baseRaw(),
      snippet({ id: 's2', value: 'Reviewed by Ada.' }),
      'metadata.notes',
    );
    expect(notes.ok).toBe(true);
    if (!notes.ok) return;
    expect(notes.raw.metadata).toMatchObject({ notes: 'Reviewed by Ada.' });
    expect(notes.raw.includes).toEqual(['snippet-1', 's2']);

    const references = applySnippet(
      baseRaw(),
      snippet({ id: 's3', value: ['Style guide'] }),
      'context.references',
    );
    expect(references.ok).toBe(true);
    if (!references.ok) return;
    expect(references.raw.context).toMatchObject({ references: ['Policy', 'Style guide'] });
  });

  it('reports a variable with no name at all as unusable', () => {
    const issues = composerIssues(
      readComposerView({
        ...baseRaw(),
        variables: [{ type: 'string', required: true }],
      }),
    );

    expect(issues[0]?.message).toMatch(/^“” is not a usable variable name/);
  });
});
