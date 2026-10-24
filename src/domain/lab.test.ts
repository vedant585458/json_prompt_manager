import { describe, expect, it } from 'vitest';

import {
  LAB_LIMITS,
  checkStructure,
  describeCoverage,
  describeLabRun,
  formatCaseInputs,
  resolveCaseInputs,
  runTestCase,
  summarizeLabRuns,
  type LabCase,
} from '@/domain/lab';
import { createBlankDocument } from '@/domain/promptDocument';
import type { JsonValue, PromptDocument, VariableDefinition } from '@/domain/types';

function variables(): VariableDefinition[] {
  return [
    { name: 'ticket', type: 'string', required: true },
    { name: 'team', type: 'string', required: true, defaultValue: 'general' },
    { name: 'priority', type: 'number', required: false },
  ];
}

function documentWith(overrides: {
  readonly variables?: VariableDefinition[];
  readonly objective?: string;
  readonly context?: string;
}): PromptDocument {
  return createBlankDocument({
    name: 'Support triage',
    role: 'Support lead',
    objective: overrides.objective ?? 'Queue the {{ticket}} for {{team}}.',
    instructions: ['Read the ticket.', 'Return the queue.'],
    constraints: ['Never invent a value.'],
    variables: overrides.variables ?? variables(),
    ...(overrides.context === undefined ? {} : { context: { description: overrides.context } }),
  });
}

function labCase(inputValues: Record<string, JsonValue>, name = 'Billing'): LabCase {
  return { id: 'case-1', name, inputValues };
}

const EXPECTED_OBJECT_SCHEMA = { type: 'object', required: ['verdict'] } as const;

describe('case inputs', () => {
  it('accepts a fully answered case and reports full coverage', () => {
    const report = resolveCaseInputs(variables(), { ticket: 'Billing', priority: 2 });

    expect(report.problems).toEqual([]);
    expect(report.values).toEqual({ ticket: 'Billing', priority: 2 });
    expect(report.unresolved).toEqual([]);
    expect(report.unused).toEqual([]);
    expect(report.coverage).toEqual({ declared: 3, answered: 3, percent: 100 });
    expect(describeCoverage(report.coverage)).toBe('3 of 3 variables answered.');
  });

  it('counts a declared default as answered without copying it into the values', () => {
    const report = resolveCaseInputs(variables(), { ticket: 'Billing' });

    expect(report.values).toEqual({ ticket: 'Billing' });
    expect(report.coverage.answered).toBe(2);
    expect(report.coverage.percent).toBe(67);
    expect(report.problems).toEqual([
      {
        category: 'inputs',
        severity: 'warning',
        name: 'priority',
        message: '“priority” is optional and unanswered; its placeholder will stay visible.',
      },
    ]);
  });

  it('blocks a required variable with no value and no default', () => {
    const report = resolveCaseInputs(
      [{ name: 'ticket', type: 'string', required: true }],
      {} as Record<string, JsonValue>,
    );

    expect(report.unresolved).toEqual(['ticket']);
    expect(report.problems).toEqual([
      {
        category: 'inputs',
        severity: 'error',
        name: 'ticket',
        message: '“ticket” is required and this case has no value for it.',
      },
    ]);
    expect(report.coverage).toEqual({ declared: 1, answered: 0, percent: 0 });
  });

  it('rejects a value that does not match its declared type', () => {
    const report = resolveCaseInputs(variables(), {
      ticket: 'Billing',
      priority: 'high',
    } as unknown as Record<string, JsonValue>);

    expect(report.problems).toContainEqual(
      expect.objectContaining({
        category: 'inputs',
        severity: 'error',
        name: 'priority',
        message: expect.stringContaining('does not match its declared number type'),
      }),
    );
    expect(report.values).toEqual({ ticket: 'Billing' });
    expect(report.unresolved).toContain('priority');
  });

  it('reports stored values the document no longer declares, without blocking', () => {
    const report = resolveCaseInputs(variables(), { ticket: 'Billing', legacy: 'kept' });

    expect(report.unused).toEqual(['legacy']);
    expect(report.problems).toContainEqual({
      category: 'inputs',
      severity: 'warning',
      name: 'legacy',
      message: '“legacy” is stored on this case but the document no longer declares it.',
    });
  });

  it('treats a document with no variables as fully covered', () => {
    const report = resolveCaseInputs([], { anything: 1 });
    expect(report.coverage).toEqual({ declared: 0, answered: 0, percent: 100 });
    expect(report.unused).toEqual(['anything']);
    expect(describeCoverage(report.coverage)).toBe('The document declares no variables.');
  });

  it('formats stored values as the playground text for every type', () => {
    const definitions: VariableDefinition[] = [
      { name: 'text', type: 'string', required: true },
      { name: 'count', type: 'number', required: true },
      { name: 'flag', type: 'boolean', required: true },
      { name: 'payload', type: 'json', required: true },
    ];

    expect(
      formatCaseInputs(definitions, {
        text: 'Hello',
        count: 3,
        flag: true,
        payload: { a: [1, 2] },
      }),
    ).toEqual({
      text: 'Hello',
      count: '3',
      flag: 'true',
      payload: '{\n  "a": [\n    1,\n    2\n  ]\n}',
    });

    // A value for a name that is not declared produces no field.
    expect(
      formatCaseInputs([{ name: 'text', type: 'string', required: true }], {
        text: 'Hello',
        gone: 'x',
      }),
    ).toEqual({ text: 'Hello' });
  });
});

describe('structure checks', () => {
  it('says when a case expects no structure', () => {
    expect(checkStructure({ schema: null, text: 'anything' })).toEqual({
      status: 'none',
      message: 'This case does not expect a structure.',
      findings: [],
    });
  });

  it('reports a missing schema by id instead of checking nothing quietly', () => {
    const check = checkStructure({ schema: null, missingSchemaId: 'schema-9', text: '{}' });
    expect(check.status).toBe('missing-schema');
    expect(check.message).toContain('schema-9');
  });

  it('rejects a schema that is not usable', () => {
    const check = checkStructure({ schema: { type: 'nonsense' }, text: '{}' });
    expect(check.status).toBe('invalid-schema');
    expect(check.findings.length).toBeGreaterThan(0);
  });

  it('does not call prose a schema failure', () => {
    const check = checkStructure({ schema: EXPECTED_OBJECT_SCHEMA, text: 'ROLE\nSupport lead' });
    expect(check.status).toBe('not-json');
    expect(check.message).toContain('line 1');
  });

  it('passes and fails against the rendered JSON, with paths', () => {
    const passing = checkStructure({
      schema: EXPECTED_OBJECT_SCHEMA,
      text: '{"verdict":"refund"}',
    });
    expect(passing.status).toBe('pass');
    expect(passing.message).toBe('The rendered text matches the expected structure.');

    const failing = checkStructure({ schema: EXPECTED_OBJECT_SCHEMA, text: '{"other":1}' });
    expect(failing.status).toBe('fail');
    expect(failing.findings.length).toBe(1);
    expect(failing.findings[0]?.path).toMatch(/^\$/);
  });
});

describe('running a case', () => {
  it('renders a valid case and reports exactly what it produced', () => {
    const run = runTestCase({
      document: documentWith({}),
      promptSchema: null,
      testCase: labCase({ ticket: 'Billing' }),
      expectedSchema: null,
    });

    expect(run.status).toBe('rendered');
    expect(run.text).toContain('Queue the Billing for general.');
    expect(run.characters).toBe(run.text.length);
    expect(run.problems).toContainEqual(
      expect.objectContaining({ category: 'inputs', severity: 'warning', name: 'priority' }),
    );
    expect(run.unresolved).toEqual(['priority']);
    expect(run.structure.status).toBe('none');
    expect(describeLabRun(run)).toBe(
      `Rendered · ${run.characters.toLocaleString()} characters · 1 warning · 1 unresolved variable.`,
    );
  });

  it('blocks on an invalid document and renders nothing', () => {
    const document = documentWith({});
    // A document that is not shaped like a document at all: the shape check
    // fails before any rendering happens, and the renderer is never reached.
    const broken = { ...document, instructions: 'not an array' } as unknown as PromptDocument;

    const run = runTestCase({
      document: broken,
      promptSchema: null,
      testCase: labCase({ ticket: 'Billing' }),
      expectedSchema: null,
    });

    expect(run.status).toBe('blocked');
    expect(run.text).toBe('');
    expect(run.characters).toBe(0);
    expect(run.rendered).toBeNull();
    expect(run.problems).toContainEqual(
      expect.objectContaining({ category: 'document', severity: 'error' }),
    );
    expect(run.structure.status).toBe('none');
    expect(describeLabRun(run)).toMatch(/blocked this run\.$/);
  });

  it('blocks on a missing required value from the case', () => {
    const run = runTestCase({
      document: documentWith({}),
      promptSchema: null,
      testCase: labCase({}),
      expectedSchema: null,
    });

    expect(run.status).toBe('blocked');
    expect(run.problems).toContainEqual({
      category: 'inputs',
      severity: 'error',
      name: 'ticket',
      message: '“ticket” is required and this case has no value for it.',
    });
  });

  it('keeps an unanswered optional variable visible and calls it a warning', () => {
    const run = runTestCase({
      document: documentWith({
        objective: 'Queue the {{ticket}}.',
        variables: [{ name: 'ticket', type: 'string', required: false }],
      }),
      promptSchema: null,
      testCase: labCase({}),
      expectedSchema: null,
    });

    expect(run.status).toBe('rendered');
    expect(run.text).toContain('{{ticket}}');
    expect(run.unresolved).toEqual(['ticket']);
    // One finding per variable: the input problem is the actionable one, so the
    // renderer's duplicate copy of it is dropped.
    expect(run.problems).toEqual([
      expect.objectContaining({ category: 'inputs', severity: 'warning', name: 'ticket' }),
    ]);
  });

  it('reports an undeclared placeholder as a documented warning', () => {
    const run = runTestCase({
      document: documentWith({
        objective: 'Queue the {{ticket}} for {{ghost}}.',
        variables: [{ name: 'ticket', type: 'string', required: true }],
      }),
      promptSchema: null,
      testCase: labCase({ ticket: 'Billing' }),
      expectedSchema: null,
    });

    expect(run.status).toBe('rendered');
    expect(run.text).toContain('{{ghost}}');
    expect(run.problems).toContainEqual(
      expect.objectContaining({ category: 'render', severity: 'warning', name: 'ghost' }),
    );
    expect(run.unresolved).toEqual(['ghost']);
  });

  it('blocks when the render itself refuses to produce text', () => {
    const huge = 'x'.repeat(LAB_LIMITS.maxRunCharacters + 10);
    const run = runTestCase({
      document: documentWith({
        objective: 'Summary: {{text}}',
        variables: [{ name: 'text', type: 'string', required: true, defaultValue: huge }],
      }),
      promptSchema: null,
      testCase: labCase({}),
      expectedSchema: null,
    });

    expect(run.status).toBe('blocked');
    expect(run.text).toBe('');
    expect(run.problems).toContainEqual(
      expect.objectContaining({ category: 'render', severity: 'error' }),
    );
  });

  it('checks the expected structure against the rendered text and says why it skipped', () => {
    const document = documentWith({
      objective: 'Return {"verdict": "{{verdict}}"}',
      variables: [{ name: 'verdict', type: 'string', required: true }],
    });

    const run = runTestCase({
      document,
      promptSchema: null,
      testCase: labCase({ verdict: 'refund' }),
      expectedSchema: EXPECTED_OBJECT_SCHEMA,
    });

    // The rendered prompt still has section headings around the JSON line, so
    // the text is prose and the check says exactly that.
    expect(run.status).toBe('rendered');
    expect(run.structure.status).toBe('not-json');
  });

  it('uses the prompt schema for document conformance', () => {
    const run = runTestCase({
      document: documentWith({}),
      promptSchema: { type: 'object', required: ['definitelyMissing'] },
      testCase: labCase({ ticket: 'Billing' }),
      expectedSchema: null,
    });

    expect(run.status).toBe('blocked');
    expect(run.problems).toContainEqual(
      expect.objectContaining({ category: 'document', severity: 'error' }),
    );
  });
});

describe('run summaries', () => {
  it('counts rendered and blocked runs', () => {
    const rendered = runTestCase({
      document: documentWith({}),
      promptSchema: null,
      testCase: labCase({ ticket: 'Billing' }),
      expectedSchema: null,
    });
    const blocked = runTestCase({
      document: documentWith({}),
      promptSchema: null,
      testCase: labCase({}),
      expectedSchema: null,
    });

    expect(summarizeLabRuns([rendered, blocked])).toEqual({ rendered: 1, blocked: 1, total: 2 });
    expect(summarizeLabRuns([])).toEqual({ rendered: 0, blocked: 0, total: 0 });
  });
});
