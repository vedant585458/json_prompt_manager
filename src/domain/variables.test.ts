import { describe, expect, it } from 'vitest';

import { createBlankDocument } from '@/domain/promptDocument';
import {
  VARIABLE_NAME_PATTERN,
  coerceVariableText,
  describeVariableDefault,
  describeVariableType,
  extractVariableReferences,
  formatVariableInput,
  parseVariableInput,
  reconcileVariables,
  scanTemplate,
} from '@/domain/variables';
import type { JsonValue, PromptDocument, VariableDefinition } from '@/domain/types';

function variable(overrides: Partial<VariableDefinition> & { name: string }): VariableDefinition {
  return {
    type: 'string',
    required: false,
    ...overrides,
  };
}

function documentWith(overrides: Partial<PromptDocument>): PromptDocument {
  return createBlankDocument({
    name: 'Triage',
    role: 'Support lead',
    objective: 'Sort the queue.',
    instructions: ['Read the ticket.'],
    ...overrides,
  });
}

describe('variable names', () => {
  it('accepts identifiers only', () => {
    for (const name of ['ticket', '_private', 'a1', 'A_b_2']) {
      expect(VARIABLE_NAME_PATTERN.test(name), name).toBe(true);
    }
    for (const name of ['1ticket', 'a-b', 'a.b', 'a b', 'a+b', 'é']) {
      expect(VARIABLE_NAME_PATTERN.test(name), name).toBe(false);
    }
  });

  it('labels the four types', () => {
    expect(describeVariableType('string')).toBe('Text');
    expect(describeVariableType('number')).toBe('Number');
    expect(describeVariableType('boolean')).toBe('Boolean');
    expect(describeVariableType('json')).toBe('JSON');
  });
});

describe('scanTemplate', () => {
  it('finds tokens with their exact positions and names', () => {
    const scan = scanTemplate('Hello {{name}}, meet {{ other }}.');

    expect(scan.tokens).toEqual([
      { start: 6, end: 14, raw: '{{name}}', name: 'name', problem: null },
      { start: 21, end: 32, raw: '{{ other }}', name: 'other', problem: null },
    ]);
    expect(scan.truncated).toBe(false);
  });

  it('treats single braces as text', () => {
    expect(scanTemplate('{ "a": 1 }')).toEqual({ tokens: [], truncated: false });
    expect(scanTemplate('} {{x}} {')).toEqual({
      tokens: [{ start: 2, end: 7, raw: '{{x}}', name: 'x', problem: null }],
      truncated: false,
    });
  });

  it('reports an empty name', () => {
    expect(scanTemplate('{{}}').tokens[0]).toMatchObject({ problem: 'empty-name', name: null });
    expect(scanTemplate('{{   }}').tokens[0]).toMatchObject({ problem: 'empty-name' });
  });

  it('reports expressions and nested braces as unusable instead of evaluating them', () => {
    for (const text of ['{{a + b}}', '{{a.b}}', '{{a|upper}}', '{{"x"}}']) {
      const [token] = scanTemplate(text).tokens;
      expect(token, text).toMatchObject({ problem: 'invalid-name', name: null });
      expect(token?.raw, text).toBe(text);
    }

    // Nested braces end the token at the first `}}`, which leaves an unusable
    // name — never a nested evaluation.
    const [nested] = scanTemplate('{{outer {{inner}}}}').tokens;
    expect(nested).toMatchObject({ problem: 'invalid-name', name: null });
    expect(nested?.raw).toBe('{{outer {{inner}}');
  });

  it('reports an unclosed token and stops there', () => {
    const scan = scanTemplate('Before {{name and more text');
    expect(scan.tokens).toHaveLength(1);
    expect(scan.tokens[0]).toMatchObject({
      problem: 'unclosed',
      name: null,
      raw: '{{name and more text',
      end: 27,
    });

    const long = scanTemplate(`{{${'x'.repeat(100)}`);
    expect(long.tokens[0]?.raw.endsWith('…')).toBe(true);
  });

  it('caps the number of tokens and says so', () => {
    const text = '{{a}}'.repeat(5);
    expect(scanTemplate(text, 2)).toMatchObject({ truncated: true });
    expect(scanTemplate(text, 2).tokens).toHaveLength(2);
    expect(scanTemplate(text, 10).truncated).toBe(false);
  });

  it('keeps Unicode and newlines around tokens intact', () => {
    const scan = scanTemplate('🙂 line one\n{{x}}\nline three ✅');
    expect(scan.tokens[0]).toMatchObject({ name: 'x', raw: '{{x}}' });
  });
});

describe('extractVariableReferences', () => {
  const document = documentWith({
    role: 'Analyst for {{team}}',
    instructions: ['Read {{ticket}} carefully.', 'Answer {{ticket}} politely.', '{{nested}}'],
    constraints: ['Never guess {{missing}}'],
    variables: [variable({ name: 'ticket' }), variable({ name: 'team' })],
    context: { description: 'Context for {{team}}', references: ['Ref {{source}}'] },
    metadata: { author: 'Written by {{writer}}', notes: 'Notes {{note}}' },
  });

  it('collects references from every string with their paths', () => {
    const scan = extractVariableReferences(document);
    const pathsOf = (name: string) =>
      scan.references
        .filter((reference) => reference.name === name)
        .map((reference) => reference.path);

    expect(pathsOf('ticket')).toEqual(['instructions[0]', 'instructions[1]']);
    expect(pathsOf('team')).toEqual(['context.description', 'role']);
    expect(pathsOf('source')).toEqual(['context.references[0]']);
    expect(pathsOf('writer')).toEqual(['metadata.author']);
    expect(pathsOf('note')).toEqual(['metadata.notes']);

    // One reference per (name, path), so the same name in one string counts.
    expect(
      extractVariableReferences(documentWith({ objective: '{{a}} and {{a}}' })).references,
    ).toEqual([{ name: 'a', path: 'objective', occurrences: 2 }]);

    // Deterministic: sorted by name, then path.
    const names = scan.references.map((reference) => reference.name);
    expect(names).toEqual([...names].sort());
  });

  it('finds tokens inside examples and imported extras too, so none is invisible', () => {
    const scan = extractVariableReferences(
      documentWith({
        examples: [{ input: { ticket: '{{example_ticket}}' } }],
        extras: { custom: '{{from_import}}' },
      }),
    );

    expect(scan.references.map((reference) => reference.name)).toEqual(
      expect.arrayContaining(['example_ticket', 'from_import']),
    );
  });

  it('records unusable tokens with their path', () => {
    const scan = extractVariableReferences(
      documentWith({ instructions: ['Broken {{a + b}} here.', 'Unclosed {{oops'] }),
    );

    expect(scan.problems.map((problem) => problem.path)).toEqual([
      'instructions[0]',
      'instructions[1]',
    ]);
    expect(scan.problems[0]?.token.problem).toBe('invalid-name');
    expect(scan.problems[1]?.token.problem).toBe('unclosed');
  });

  it('returns nothing for a document without tokens', () => {
    expect(extractVariableReferences(documentWith({}))).toEqual({
      references: [],
      problems: [],
      truncated: false,
    });
  });
});

describe('reconcileVariables', () => {
  const variables = [
    variable({ name: 'ticket', required: true }),
    variable({ name: 'team' }),
    variable({ name: 'unused' }),
  ];
  const scan = extractVariableReferences(
    documentWith({
      objective: 'Sort {{ticket}} for {{team}}.',
      instructions: ['Also {{ghost}} and {{another}}'],
    }),
  );

  it('separates used, unused, and undeclared', () => {
    const reconciliation = reconcileVariables(variables, scan.references);

    expect(reconciliation.used.map((entry) => entry.name)).toEqual(['ticket', 'team']);
    expect(reconciliation.unused.map((entry) => entry.name)).toEqual(['unused']);
    expect(reconciliation.undeclared.map((entry) => entry.name)).toEqual(['another', 'ghost']);
  });

  it('counts paths and occurrences per variable', () => {
    const reconciliation = reconcileVariables(variables, scan.references);
    const ticket = reconciliation.used.find((entry) => entry.name === 'ticket');

    expect(ticket).toMatchObject({ paths: ['objective'], occurrences: 1 });
  });

  it('reports every declaration as unused when nothing references it', () => {
    const reconciliation = reconcileVariables(variables, []);
    expect(reconciliation.used).toEqual([]);
    expect(reconciliation.unused).toHaveLength(3);
    expect(reconciliation.undeclared).toEqual([]);
  });
});

describe('parseVariableInput', () => {
  it('takes text verbatim, including an empty string', () => {
    const definition = variable({ name: 'text' });
    expect(parseVariableInput(definition, ' hello\nworld ')).toEqual({
      state: 'value',
      value: ' hello\nworld ',
    });
    expect(parseVariableInput(definition, '')).toEqual({ state: 'value', value: '' });
  });

  it('parses numbers strictly', () => {
    const definition = variable({ name: 'n', type: 'number' });

    expect(parseVariableInput(definition, '42')).toEqual({ state: 'value', value: 42 });
    expect(parseVariableInput(definition, ' -3.5 ')).toEqual({ state: 'value', value: -3.5 });
    expect(parseVariableInput(definition, '1e3')).toEqual({ state: 'value', value: 1000 });
    expect(parseVariableInput(definition, '.5')).toEqual({ state: 'value', value: 0.5 });

    expect(parseVariableInput(definition, '')).toEqual({ state: 'empty' });
    expect(parseVariableInput(definition, '   ')).toEqual({ state: 'empty' });
    for (const bad of ['0x10', 'NaN', 'Infinity', '1,000', '3 apples']) {
      expect(parseVariableInput(definition, bad).state, bad).toBe('invalid');
    }
  });

  it('parses booleans only from true and false', () => {
    const definition = variable({ name: 'flag', type: 'boolean' });

    expect(parseVariableInput(definition, 'true')).toEqual({ state: 'value', value: true });
    expect(parseVariableInput(definition, 'false')).toEqual({ state: 'value', value: false });
    expect(parseVariableInput(definition, '')).toEqual({ state: 'empty' });
    expect(parseVariableInput(definition, 'yes').state).toBe('invalid');
  });

  it('parses JSON and locates the error when it cannot', () => {
    const definition = variable({ name: 'data', type: 'json' });

    expect(parseVariableInput(definition, '{"a":1}')).toEqual({
      state: 'value',
      value: { a: 1 },
    });
    expect(parseVariableInput(definition, '[1,2]')).toEqual({ state: 'value', value: [1, 2] });
    expect(parseVariableInput(definition, 'null')).toEqual({ state: 'value', value: null });
    expect(parseVariableInput(definition, '')).toEqual({ state: 'empty' });

    const invalid = parseVariableInput(definition, '{\n  "a": 1,\n}');
    expect(invalid.state).toBe('invalid');
    if (invalid.state === 'invalid') expect(invalid.error).toMatch(/^Line 3, column 1:/);
  });

  it('says what a number field expects', () => {
    const invalid = parseVariableInput(variable({ name: 'n', type: 'number' }), 'x');
    expect(invalid).toEqual({
      state: 'invalid',
      error: 'Enter a number, for example 42 or 3.5.',
    });
  });
});

describe('formats for fields and defaults', () => {
  it('initialises a field from a value', () => {
    expect(formatVariableInput(variable({ name: 's' }), 'text')).toBe('text');
    expect(formatVariableInput(variable({ name: 's' }), 5)).toBe('5');
    expect(formatVariableInput(variable({ name: 'n', type: 'number' }), 3.5)).toBe('3.5');
    expect(formatVariableInput(variable({ name: 'b', type: 'boolean' }), false)).toBe('false');
    expect(formatVariableInput(variable({ name: 'j', type: 'json' }), { a: [1] })).toBe(
      '{\n  "a": [\n    1\n  ]\n}',
    );
  });

  it('describes a default without pretending there is one', () => {
    expect(describeVariableDefault(variable({ name: 's' }))).toBeNull();
    expect(describeVariableDefault(variable({ name: 's', defaultValue: 'hello' }))).toBe('hello');
    expect(
      describeVariableDefault(variable({ name: 'j', type: 'json', defaultValue: { a: 1 } })),
    ).toBe('{ "a": 1 }');
    expect(
      describeVariableDefault(variable({ name: 's', defaultValue: 'x'.repeat(200) }), 20),
    ).toHaveLength(21);
  });
});

describe('coerceVariableText', () => {
  it('inserts text unchanged and JSON as compact JSON', () => {
    expect(coerceVariableText('line one\nline two', 'string')).toEqual({
      ok: true,
      text: 'line one\nline two',
    });
    expect(coerceVariableText({ a: [1, 2] }, 'json')).toEqual({ ok: true, text: '{"a":[1,2]}' });
    expect(coerceVariableText('x', 'json')).toEqual({ ok: true, text: '"x"' });
    expect(coerceVariableText(42, 'number')).toEqual({ ok: true, text: '42' });
    expect(coerceVariableText(false, 'boolean')).toEqual({ ok: true, text: 'false' });
  });

  it('refuses a value that contradicts the declaration instead of guessing', () => {
    const asNumber = coerceVariableText('42', 'number');
    expect(asNumber.ok).toBe(false);

    const asBoolean = coerceVariableText('true', 'boolean');
    expect(asBoolean.ok).toBe(false);
  });

  it('stringifies a non-string into a text variable rather than dropping it', () => {
    expect(coerceVariableText(7, 'string')).toEqual({ ok: true, text: '7' });
    expect(coerceVariableText({ a: 1 } as JsonValue, 'string')).toEqual({
      ok: true,
      text: '{"a":1}',
    });
  });
});
