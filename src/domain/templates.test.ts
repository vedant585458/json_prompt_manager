import { describe, expect, it } from 'vitest';

import { createBlankDocument } from '@/domain/promptDocument';
import { createPrompt, createTemplate } from '@/domain/factories';
import {
  BUILT_IN_LOCKED_MESSAGE,
  MAX_TEMPLATE_NAME_LENGTH,
  builtInTemplateIssue,
  checkTemplateName,
  filterTemplates,
  instantiateTemplate,
  nextTemplateName,
  sortTemplates,
  sortUserTemplatesByRecency,
  summariseTemplate,
  templateCategories,
  templateDraftFromPrompt,
  templateIsEditable,
  templateIssues,
  templateTags,
} from '@/domain/templates';
import type { PromptDocument, PromptTemplate } from '@/domain/types';

const NOW = new Date('2026-10-24T09:00:00.000Z');

function documentWith(overrides: Partial<PromptDocument> = {}): PromptDocument {
  return createBlankDocument({
    name: 'Meeting summary',
    role: 'Analyst',
    objective: 'Summarise a transcript into decisions and actions.',
    instructions: ['List decisions first.', 'Then list action items.'],
    constraints: ['Never invent a decision.'],
    variables: [
      { name: 'transcript', type: 'string', required: true },
      { name: 'max_actions', type: 'number', required: false, defaultValue: 8 },
    ],
    output: { format: 'markdown' },
    examples: [{ input: { transcript: '…' } }],
    metadata: { tags: ['meetings', 'summary'], author: 'PromptForge' },
    ...overrides,
  });
}

let counter = 0;

function makeTemplate(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  counter += 1;
  return {
    ...createTemplate(
      {
        name: overrides.name ?? `Template ${counter}`,
        description: overrides.description ?? 'A reusable starting point.',
        category: overrides.category ?? 'Analysis',
        content: overrides.content ?? documentWith(),
        isBuiltIn: overrides.isBuiltIn ?? false,
      },
      { now: () => NOW, newId: () => `template-${counter}` },
    ),
    ...overrides,
  };
}

describe('templateTags', () => {
  it('reads the document’s own metadata tags', () => {
    expect(templateTags(makeTemplate())).toEqual(['meetings', 'summary']);
  });

  it('returns an empty list when the document declares no tags', () => {
    expect(templateTags(makeTemplate({ content: documentWith({ metadata: {} }) }))).toEqual([]);
  });
});

describe('summariseTemplate', () => {
  it('counts what the card and the preview show', () => {
    const summary = summariseTemplate(makeTemplate());

    expect(summary.variables).toHaveLength(2);
    expect(summary.requiredVariables).toBe(1);
    expect(summary.optionalVariables).toBe(1);
    expect(summary.instructions).toBe(2);
    expect(summary.constraints).toBe(1);
    expect(summary.examples).toBe(1);
    expect(summary.tags).toEqual(['meetings', 'summary']);
    expect(summary.jsonCharacters).toBeGreaterThan(100);
  });

  it('gives identical documents the same hash and different ones different hashes', () => {
    const first = summariseTemplate(makeTemplate({ name: 'A' }));
    const second = summariseTemplate(makeTemplate({ name: 'B' }));
    const changed = summariseTemplate(
      makeTemplate({ content: documentWith({ objective: 'Something else entirely.' }) }),
    );

    expect(first.hash).toBe(second.hash);
    expect(changed.hash).not.toBe(first.hash);
  });
});

describe('ordering', () => {
  it('puts built-ins first, then sorts by name', () => {
    const sorted = sortTemplates([
      makeTemplate({ name: 'zeta', isBuiltIn: false }),
      makeTemplate({ name: 'Beta', isBuiltIn: true }),
      makeTemplate({ name: 'alpha', isBuiltIn: true }),
    ]);

    expect(
      sorted.map((template) => `${template.isBuiltIn ? 'built-in' : 'custom'}:${template.name}`),
    ).toEqual(['built-in:alpha', 'built-in:Beta', 'custom:zeta']);
  });

  it('orders user templates newest first', () => {
    const older = makeTemplate({ name: 'Older' });
    const newer = { ...makeTemplate({ name: 'Newer' }), updatedAt: '2026-10-25T09:00:00.000Z' };

    expect(sortUserTemplatesByRecency([older, newer]).map((template) => template.name)).toEqual([
      'Newer',
      'Older',
    ]);
  });

  it('dedupes categories case-insensitively, sorts them, and skips blanks', () => {
    const categories = templateCategories([
      makeTemplate({ category: 'Extraction' }),
      makeTemplate({ category: 'extraction' }),
      makeTemplate({ category: 'Analysis' }),
      makeTemplate({ category: '   ' }),
    ]);

    expect(categories).toEqual(['Analysis', 'Extraction']);
  });
});

describe('filterTemplates', () => {
  const builtIn = makeTemplate({
    name: 'Structured field extraction',
    description: 'Turn text into JSON.',
    category: 'Extraction',
    isBuiltIn: true,
    content: documentWith({
      objective: 'Extract fields from invoices.',
      metadata: { tags: ['extraction'] },
      variables: [{ name: 'source_text', type: 'string', required: true }],
    }),
  });
  const custom = makeTemplate({
    name: 'Meeting summary',
    description: 'Decisions and actions.',
    category: 'Summarization',
    isBuiltIn: false,
  });

  it('returns everything without a filter', () => {
    expect(filterTemplates([custom, builtIn])).toHaveLength(2);
  });

  it('matches the query across name, description, category, tags, objective, and variables', () => {
    expect(filterTemplates([builtIn, custom], { query: 'invoice' })).toEqual([builtIn]);
    expect(filterTemplates([builtIn, custom], { query: 'decisions' })).toEqual([custom]);
    expect(filterTemplates([builtIn, custom], { query: 'summarization' })).toEqual([custom]);
    expect(filterTemplates([builtIn, custom], { query: 'meetings' })).toEqual([custom]);
    expect(filterTemplates([builtIn, custom], { query: 'source_text' })).toEqual([builtIn]);
  });

  it('requires every word of a multi-word query', () => {
    expect(filterTemplates([builtIn, custom], { query: 'field extraction' })).toEqual([builtIn]);
    expect(filterTemplates([builtIn, custom], { query: 'field meeting' })).toEqual([]);
  });

  it('filters by kind', () => {
    expect(filterTemplates([builtIn, custom], { kind: 'built-in' })).toEqual([builtIn]);
    expect(filterTemplates([builtIn, custom], { kind: 'custom' })).toEqual([custom]);
    expect(filterTemplates([builtIn, custom], { kind: 'all' })).toHaveLength(2);
  });

  it('filters by category, ignoring case, and treats an empty category as “all”', () => {
    expect(filterTemplates([builtIn, custom], { category: 'extraction' })).toEqual([builtIn]);
    expect(filterTemplates([builtIn, custom], { category: '' })).toHaveLength(2);
    expect(filterTemplates([builtIn, custom], { category: null })).toHaveLength(2);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterTemplates([builtIn, custom], { query: 'nothing here' })).toEqual([]);
    expect(filterTemplates([builtIn, custom], { category: 'Agents' })).toEqual([]);
  });
});

describe('templateIssues', () => {
  it('accepts a well-formed template', () => {
    expect(templateIssues(makeTemplate()).filter((issue) => issue.severity === 'error')).toEqual(
      [],
    );
  });

  it('rejects a blank name', () => {
    const issues = templateIssues(makeTemplate({ name: '   ' }));

    expect(issues).toContainEqual({
      path: 'name',
      message: 'A template needs a name.',
      severity: 'error',
    });
  });

  it('rejects a name longer than the documented limit', () => {
    const issues = templateIssues(makeTemplate({ name: 'x'.repeat(MAX_TEMPLATE_NAME_LENGTH + 1) }));

    expect(issues.some((issue) => issue.path === 'name' && issue.severity === 'error')).toBe(true);
  });

  it('warns about a missing description', () => {
    const issues = templateIssues(makeTemplate({ description: '  ' }));

    expect(issues).toContainEqual(
      expect.objectContaining({ path: 'description', severity: 'warning' }),
    );
  });

  it('warns about a template without variables', () => {
    const issues = templateIssues(makeTemplate({ content: documentWith({ variables: [] }) }));

    expect(issues).toContainEqual(
      expect.objectContaining({ path: 'content.variables', severity: 'warning' }),
    );
  });

  it('prefixes document problems with “content.”', () => {
    const broken = {
      ...makeTemplate(),
      content: { ...documentWith(), schemaVersion: '9.9' } as unknown as PromptDocument,
    };

    const errors = templateIssues(broken).filter((issue) => issue.severity === 'error');
    expect(errors.map((issue) => issue.path)).toContain('content.schemaVersion');
  });
});

describe('checkTemplateName', () => {
  const first = makeTemplate({ name: 'Code review' });

  it('accepts a fresh name', () => {
    expect(checkTemplateName('Agent prompt', [first])).toEqual([]);
  });

  it('rejects a blank name', () => {
    expect(checkTemplateName('  ', [first])).toContainEqual(
      expect.objectContaining({ path: 'name', severity: 'error' }),
    );
  });

  it('rejects a duplicate regardless of case and spacing', () => {
    const issues = checkTemplateName('  code REVIEW ', [first]);

    expect(issues).toContainEqual(expect.objectContaining({ path: 'name', severity: 'error' }));
    expect(issues[0]?.message).toContain('already exists');
  });

  it('lets a template keep its own name when excluded', () => {
    expect(checkTemplateName('Code review', [first], { excludeId: first.id })).toEqual([]);
  });

  it('rejects names beyond the limit', () => {
    expect(checkTemplateName('x'.repeat(MAX_TEMPLATE_NAME_LENGTH + 1), [])).toContainEqual(
      expect.objectContaining({ severity: 'error' }),
    );
  });
});

describe('nextTemplateName', () => {
  it('starts with “(copy)” and skips names already taken', () => {
    const base = makeTemplate({ name: 'Meeting summary' });
    const copy = makeTemplate({ name: 'Meeting summary (copy)' });

    expect(nextTemplateName('Meeting summary', [])).toBe('Meeting summary (copy)');
    expect(nextTemplateName('Meeting summary', [base])).toBe('Meeting summary (copy)');
    expect(nextTemplateName('Meeting summary', [base, copy])).toBe('Meeting summary (copy 2)');
  });

  it('falls back to a usable name for a blank base', () => {
    expect(nextTemplateName('   ', [])).toBe('Template (copy)');
  });
});

describe('built-in protection', () => {
  it('treats only user templates as editable', () => {
    expect(templateIsEditable(makeTemplate({ isBuiltIn: true }))).toBe(false);
    expect(templateIsEditable(makeTemplate({ isBuiltIn: false }))).toBe(true);
  });

  it('explains how to customise a built-in in both messages', () => {
    expect(builtInTemplateIssue('edit').message).toBe(BUILT_IN_LOCKED_MESSAGE);
    expect(builtInTemplateIssue('delete').message).toContain('cannot be deleted');
    expect(builtInTemplateIssue('delete').message).toContain('Duplicate one');
    expect(builtInTemplateIssue('edit').severity).toBe('error');
  });
});

describe('instantiateTemplate', () => {
  function templateWithSchema(schemaRef: string): PromptTemplate {
    return makeTemplate({
      name: 'Invoice extraction',
      description: 'Extract invoice fields.',
      content: documentWith({ output: { format: 'json', schemaRef }, includes: ['snippet-a'] }),
    });
  }

  it('copies the document so the prompt cannot edit the template', () => {
    const template = templateWithSchema('schema-1');
    const result = instantiateTemplate(template);

    expect(result.content).not.toBe(template.content);
    expect(result.content.instructions).not.toBe(template.content.instructions);

    (result.content.instructions as string[]).push('Injected later.');
    expect(template.content.instructions).toHaveLength(2);
  });

  it('produces independent documents for two uses of the same template', () => {
    const template = templateWithSchema('schema-1');
    const first = instantiateTemplate(template);
    const second = instantiateTemplate(template);

    expect(first.content).not.toBe(second.content);
    expect(first.variables).not.toBe(second.variables);
  });

  it('always drops snippet references and reports them', () => {
    const result = instantiateTemplate(templateWithSchema('schema-1'));

    expect(result.content.includes).toEqual([]);
    expect(result.droppedIncludes).toEqual(['snippet-a']);
  });

  it('keeps a schema reference when that schema is stored', () => {
    const result = instantiateTemplate(templateWithSchema('schema-1'), {
      knownSchemaIds: new Set(['schema-1']),
    });

    expect(result.content.output.schemaRef).toBe('schema-1');
    expect(result.droppedSchemaRef).toBeNull();
  });

  it('drops and reports a schema reference this browser does not store', () => {
    const result = instantiateTemplate(templateWithSchema('schema-missing'), {
      knownSchemaIds: new Set(['schema-1']),
    });

    expect(result.content.output.schemaRef).toBeUndefined();
    expect(result.droppedSchemaRef).toBe('schema-missing');
  });

  it('keeps the schema reference when the caller cannot answer', () => {
    const result = instantiateTemplate(templateWithSchema('schema-1'));

    expect(result.content.output.schemaRef).toBe('schema-1');
    expect(result.droppedSchemaRef).toBeNull();
  });

  it('copies the name, description, tags, and variables', () => {
    const result = instantiateTemplate(templateWithSchema('schema-1'));

    expect(result.title).toBe('Invoice extraction');
    expect(result.description).toBe('Extract invoice fields.');
    expect(result.tags).toEqual(['meetings', 'summary']);
    expect(result.variables.map((variable) => variable.name)).toEqual([
      'transcript',
      'max_actions',
    ]);
  });

  it('uses an explicit title, and falls back to the name when it is blank', () => {
    const template = templateWithSchema('schema-1');

    expect(instantiateTemplate(template, { title: 'Q3 invoices' }).title).toBe('Q3 invoices');
    expect(instantiateTemplate(template, { title: '   ' }).title).toBe('Invoice extraction');
  });

  it('leaves the output format and examples intact', () => {
    const result = instantiateTemplate(templateWithSchema('schema-1'));

    expect(result.content.output.format).toBe('json');
    expect(result.content.examples).toHaveLength(1);
    expect(result.content.metadata.tags).toEqual(['meetings', 'summary']);
  });
});

describe('templateDraftFromPrompt', () => {
  const prompt = createPrompt(
    {
      title: 'Quarterly review',
      description: 'Draft the quarterly review email.',
      content: documentWith({ includes: ['snippet-1', 'snippet-2'] }),
    },
    { now: () => NOW, newId: () => 'prompt-1' },
  );

  it('takes the name and description from the prompt and leaves the category empty', () => {
    const draft = templateDraftFromPrompt(prompt);

    expect(draft.name).toBe('Quarterly review');
    expect(draft.description).toBe('Draft the quarterly review email.');
    expect(draft.category).toBe('');
  });

  it('clears snippet references and reports which ones', () => {
    const draft = templateDraftFromPrompt(prompt);

    expect(draft.content.includes).toEqual([]);
    expect(draft.droppedIncludes).toEqual(['snippet-1', 'snippet-2']);
  });

  it('copies the document deeply', () => {
    const draft = templateDraftFromPrompt(prompt);

    (draft.content.constraints as string[]).push('Added after the draft.');
    expect(prompt.content.constraints).toHaveLength(1);
  });
});
