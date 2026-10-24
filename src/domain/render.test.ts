import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createBlankDocument } from '@/domain/promptDocument';
import {
  MAX_RENDER_CHARACTERS,
  describeRenderIssues,
  describeRenderedPrompt,
  missingVariables,
  renderPrompt,
  renderTemplateString,
} from '@/domain/render';
import { scanTemplate } from '@/domain/variables';
import type { JsonValue, PromptDocument, VariableDefinition } from '@/domain/types';

function variable(overrides: Partial<VariableDefinition> & { name: string }): VariableDefinition {
  return { type: 'string', required: false, ...overrides };
}

const DOCUMENT: PromptDocument = createBlankDocument({
  name: 'Ticket triage',
  role: 'You are a support lead for {{team}}.',
  objective: 'Sort {{ticket}} into a queue.',
  instructions: ['Read {{ticket}}.', 'Answer {{customer}} politely.'],
  context: {
    description: 'The team is {{team}}.',
    references: ['Policy for {{ticket}}'],
  },
  constraints: ['Never invent a value for {{customer}}.'],
  variables: [
    variable({ name: 'team', required: true }),
    variable({ name: 'ticket', required: true }),
    variable({ name: 'customer', type: 'string', defaultValue: 'the customer' }),
  ],
  examples: [{ input: { ticket: '{{example_only}}' }, output: { queue: 'billing' } }],
  output: { format: 'json' },
  metadata: { notes: 'Not part of the text.' },
});

describe('renderTemplateString', () => {
  const context = {
    declared: new Map<'team' | 'ticket' | 'count' | 'payload', 'string' | 'number' | 'json'>([
      ['team', 'string'],
      ['ticket', 'string'],
      ['count', 'number'],
      ['payload', 'json'],
    ]),
    values: {
      team: 'Billing',
      ticket: 'my ticket',
      count: 3,
      payload: { a: [1, 2] },
    } as Record<string, JsonValue>,
  };

  it('replaces declared tokens and leaves everything else byte for byte', () => {
    const rendered = renderTemplateString(
      'Team {{team}} handles {{ ticket }} in {{count}} steps: {{payload}}.',
      context,
    );

    expect(rendered.text).toBe('Team Billing handles my ticket in 3 steps: {"a":[1,2]}.');
    expect(rendered.issues).toEqual([]);
    expect(rendered.segments.map((segment) => segment.kind)).toEqual([
      'text',
      'value',
      'text',
      'value',
      'text',
      'value',
      'text',
      'value',
      'text',
    ]);
  });

  it('keeps an unknown token visible and reports it once', () => {
    const rendered = renderTemplateString('{{ghost}} and {{ghost}}', context);

    expect(rendered.text).toBe('{{ghost}} and {{ghost}}');
    expect(rendered.segments.filter((segment) => segment.kind === 'unknown')).toHaveLength(2);
    expect(rendered.issues).toEqual([
      {
        severity: 'warning',
        code: 'undeclared',
        message: '“ghost” is not declared as a variable, so it is shown as written.',
        name: 'ghost',
      },
    ]);
  });

  it('shows an unresolved declared token as written', () => {
    const rendered = renderTemplateString('{{team}}', {
      declared: new Map([['team', 'string' as const]]),
      values: {},
    });

    expect(rendered.text).toBe('{{team}}');
    expect(rendered.segments[0]).toMatchObject({ kind: 'unresolved', name: 'team' });
    expect(rendered.issues[0]).toMatchObject({ code: 'missing-optional', severity: 'warning' });
  });

  it('copies unusable placeholders through with a warning', () => {
    const invalid = renderTemplateString('{{a + b}}', context);
    expect(invalid.text).toBe('{{a + b}}');
    expect(invalid.segments[0]).toMatchObject({ kind: 'invalid', text: '{{a + b}}' });
    expect(invalid.issues[0]).toMatchObject({ code: 'invalid-token', severity: 'warning' });

    const unclosed = renderTemplateString('open {{team', context);
    expect(unclosed.text).toBe('open {{team');
    expect(unclosed.issues[0]).toMatchObject({ code: 'invalid-token' });
  });

  it('reports a type mismatch as an error instead of inserting a wrong value', () => {
    const rendered = renderTemplateString('{{count}}', {
      declared: new Map([['count', 'number' as const]]),
      values: { count: 'three' },
    });

    expect(rendered.text).toBe('{{count}}');
    expect(rendered.segments[0]?.kind).toBe('unresolved');
    expect(rendered.issues[0]).toMatchObject({ code: 'type-mismatch', severity: 'error' });
  });

  it('carries the field path into each warning', () => {
    const rendered = renderTemplateString('{{ghost}}', { ...context, path: 'instructions[2]' });
    expect(rendered.issues[0]?.path).toBe('instructions[2]');
  });

  it('is exact with Unicode, newlines, and braces that are not tokens', () => {
    const rendered = renderTemplateString('🙂 { "a": 1 }\n{{team}}\nline two ✅', {
      declared: new Map([['team', 'string' as const]]),
      values: { team: 'Déjà vu' },
    });

    expect(rendered.text).toBe('🙂 { "a": 1 }\nDéjà vu\nline two ✅');
  });
});

describe('renderPrompt', () => {
  const values = { team: 'Billing', ticket: 'TKT-9' } as Record<string, JsonValue>;

  it('lays out the prose sections in a fixed order', () => {
    const rendered = renderPrompt(DOCUMENT, values);

    expect(rendered.blocked).toBe(false);
    expect(rendered.sections.map((section) => section.title)).toEqual([
      'Role',
      'Objective',
      'Instructions',
      'Context',
      'References',
      'Constraints',
    ]);
    expect(rendered.text).toBe(
      [
        'ROLE',
        'You are a support lead for Billing.',
        '',
        'OBJECTIVE',
        'Sort TKT-9 into a queue.',
        '',
        'INSTRUCTIONS',
        '1. Read TKT-9.',
        '2. Answer the customer politely.',
        '',
        'CONTEXT',
        'The team is Billing.',
        '',
        'REFERENCES',
        '- Policy for TKT-9',
        '',
        'CONSTRAINTS',
        '- Never invent a value for the customer.',
      ].join('\n'),
    );
    expect(rendered.characters).toBe(rendered.text.length);
    expect(rendered.issues).toEqual([]);
  });

  it('uses a default when a value is omitted and reports the effective values', () => {
    const rendered = renderPrompt(DOCUMENT, values);

    expect(rendered.values).toEqual({
      team: 'Billing',
      ticket: 'TKT-9',
      customer: 'the customer',
    });
    expect(rendered.text).toContain('Answer the customer politely.');
  });

  it('blocks the render when a required variable is missing, and says which', () => {
    const rendered = renderPrompt(DOCUMENT, { team: 'Billing' });

    expect(rendered.blocked).toBe(true);
    expect(rendered.text).toBe('');
    expect(rendered.sections).toEqual([]);
    expect(rendered.characters).toBe(0);
    expect(rendered.missing).toEqual(['ticket']);
    expect(rendered.issues).toEqual([
      {
        severity: 'error',
        code: 'missing-required',
        message: '“ticket” is required and has no value.',
        name: 'ticket',
      },
    ]);
  });

  it('renders around a missing optional variable and leaves its placeholder visible', () => {
    const document = createBlankDocument({
      role: 'Hello {{nickname}}',
      objective: 'Sort it.',
      variables: [variable({ name: 'nickname' })],
    });

    const rendered = renderPrompt(document, {});

    expect(rendered.blocked).toBe(false);
    expect(rendered.text).toBe('ROLE\nHello {{nickname}}\n\nOBJECTIVE\nSort it.');
    expect(rendered.issues).toEqual([
      expect.objectContaining({ code: 'missing-optional', severity: 'warning', name: 'nickname' }),
    ]);
    expect(rendered.missing).toEqual(['nickname']);
  });

  it('reports an undeclared token once, even across sections', () => {
    const document = createBlankDocument({
      role: '{{ghost}}',
      objective: '{{ghost}} again',
      instructions: ['{{ghost}}'],
    });

    const rendered = renderPrompt(document, {});

    expect(rendered.blocked).toBe(false);
    expect(rendered.text).toBe(
      'ROLE\n{{ghost}}\n\nOBJECTIVE\n{{ghost}} again\n\nINSTRUCTIONS\n1. {{ghost}}',
    );
    expect(rendered.issues).toHaveLength(1);
    expect(rendered.issues[0]).toMatchObject({ code: 'undeclared', name: 'ghost' });
  });

  it('blocks a document whose default contradicts its declared type', () => {
    const document = createBlankDocument({
      role: 'Count {{n}}',
      variables: [variable({ name: 'n', type: 'number', defaultValue: 'three' })],
    });

    const rendered = renderPrompt(document, {});

    expect(rendered.blocked).toBe(true);
    expect(rendered.issues).toEqual([
      expect.objectContaining({ code: 'type-mismatch', severity: 'error', name: 'n' }),
    ]);
  });

  it('omits empty sections instead of printing empty headings', () => {
    const document = createBlankDocument({ objective: 'Only this.' });
    const rendered = renderPrompt(document, {});

    expect(rendered.sections.map((section) => section.id)).toEqual(['objective']);
    expect(rendered.text).toBe('OBJECTIVE\nOnly this.');
  });

  it('does not render examples, output configuration, or metadata', () => {
    const rendered = renderPrompt(DOCUMENT, values);

    expect(rendered.text).not.toContain('example_only');
    expect(rendered.text).not.toContain('Not part of the text');
    expect(rendered.text).not.toContain('"format"');
  });

  it('renders nothing for an empty document without blocking', () => {
    const rendered = renderPrompt(createBlankDocument({}), {});

    expect(rendered).toMatchObject({ blocked: false, text: '', characters: 0, sections: [] });
    expect(describeRenderedPrompt(rendered)).toBe('Nothing to render.');
  });

  it('is deterministic', () => {
    const first = renderPrompt(DOCUMENT, values);
    const second = renderPrompt(DOCUMENT, values);
    expect(second.text).toBe(first.text);
    expect(second.issues).toEqual(first.issues);
  });

  it('preserves newlines and Unicode in substituted values', () => {
    const document = createBlankDocument({
      role: 'You are {{role}}.',
      variables: [variable({ name: 'role', required: true })],
    });
    const rendered = renderPrompt(document, { role: 'a “senior”\nreviewer 🙂' });

    expect(rendered.text).toBe('ROLE\nYou are a “senior”\nreviewer 🙂.');
  });

  it('blocks a render that would exceed the size limit', () => {
    const document = createBlankDocument({ role: 'x'.repeat(MAX_RENDER_CHARACTERS + 1) });
    const rendered = renderPrompt(document, {});

    expect(rendered.blocked).toBe(true);
    expect(rendered.text).toBe('');
    expect(rendered.issues).toEqual([
      expect.objectContaining({ code: 'too-large', severity: 'error' }),
    ]);
  });

  it('blocks a field with more placeholders than it will resolve', () => {
    const text = `${'{{a}}'.repeat(1_001)}`;
    const document = createBlankDocument({
      role: text,
      variables: [variable({ name: 'a', defaultValue: 'x' })],
    });

    const rendered = renderPrompt(document, {});

    expect(rendered.blocked).toBe(true);
    expect(rendered.issues).toEqual([
      expect.objectContaining({ code: 'too-many-tokens', severity: 'error' }),
    ]);
  });

  it('summarises what it produced', () => {
    const rendered = renderPrompt(DOCUMENT, values);
    expect(describeRenderedPrompt(rendered)).toBe(
      `6 sections, ${rendered.characters.toLocaleString()} characters.`,
    );
    expect(describeRenderIssues(rendered.issues)).toBeNull();
  });
});

describe('render summaries', () => {
  it('describes blocked renders as not rendered', () => {
    const rendered = renderPrompt(DOCUMENT, {});
    expect(describeRenderedPrompt(rendered)).toBe('Not rendered.');
  });

  it('counts errors and warnings separately', () => {
    expect(
      describeRenderIssues([
        { severity: 'error', code: 'missing-required', message: 'a' },
        { severity: 'warning', code: 'undeclared', message: 'b' },
        { severity: 'warning', code: 'undeclared', message: 'c' },
      ]),
    ).toBe('1 problem blocks the preview, 2 warnings.');

    expect(describeRenderIssues([{ severity: 'warning', code: 'undeclared', message: 'b' }])).toBe(
      '1 warning.',
    );
  });

  it('lists variables with neither a value nor a default', () => {
    expect(
      missingVariables([variable({ name: 'a' }), variable({ name: 'b', defaultValue: 'x' })], {
        c: 1,
      } as Record<string, JsonValue>).map((entry) => entry.name),
    ).toEqual(['a']);
  });
});

describe('the renderer is not an evaluator', () => {
  it('uses no eval, Function, timers, or dynamic import', () => {
    const files = ['render.ts', 'variables.ts'];

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), 'src', 'domain', file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');

      for (const forbidden of [
        /\beval\s*\(/,
        /\bnew\s+Function\b/,
        /\bFunction\s*\(/,
        /\bsetTimeout\s*\(/,
        /\bimport\s*\(/,
      ]) {
        expect(forbidden.test(source), `${file} must not use ${String(forbidden)}`).toBe(false);
      }
    }
  });

  it('treats expressions as text, never as code', () => {
    const document = createBlankDocument({
      role: '{{1 + 1}} {{constructor}} {{__proto__}} {{toString}}',
      variables: [],
    });
    const rendered = renderPrompt(document, {});

    expect(rendered.text).toBe('ROLE\n{{1 + 1}} {{constructor}} {{__proto__}} {{toString}}');
    expect(rendered.blocked).toBe(false);
    expect(rendered.issues.filter((issue) => issue.code === 'undeclared').length).toBe(3);
    expect(scanTemplate('{{constructor}}').tokens[0]?.name).toBe('constructor');
  });
});
