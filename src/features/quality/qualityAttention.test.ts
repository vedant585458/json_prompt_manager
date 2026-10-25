import { describe, expect, it } from 'vitest';

import { createPrompt } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import { createDismissal, inspectQuality } from '@/domain/quality';
import type { Prompt } from '@/domain/types';
import {
  collectQualityAttention,
  describeQualityAttention,
} from '@/features/quality/qualityAttention';

const NOW = new Date('2026-10-25T09:00:00.000Z');

function prompt(
  id: string,
  overrides: Partial<Prompt> = {},
  document: Parameters<typeof createBlankDocument>[0] = {},
): Prompt {
  return createPrompt(
    {
      title: overrides.title ?? id,
      description: overrides.description ?? 'What this prompt does.',
      tags: [],
      folderId: null,
      collectionIds: [],
      favorite: false,
      pinned: false,
      archived: overrides.archived ?? false,
      content: createBlankDocument({
        name: overrides.title ?? id,
        role: 'Support lead',
        objective: 'Classify each ticket.',
        instructions: ['Read the ticket.'],
        examples: [{ input: 'A', output: 'B' }],
        ...(overrides.content ?? document),
      }),
    },
    { now: () => NOW, newId: () => id },
  );
}

/** A prompt whose document refers to a variable it never declared. */
function withIssues(id: string, overrides: Partial<Prompt> = {}): Prompt {
  return prompt(id, {
    ...overrides,
    content: createBlankDocument({
      name: id,
      role: 'Support lead',
      objective: 'Classify {{ghost}}.',
      instructions: ['Read it.'],
      examples: [{ input: 'A', output: 'B' }],
    }),
  });
}

describe('quality attention', () => {
  it('lists a prompt whose document has errors, with counts', () => {
    const items = collectQualityAttention([withIssues('broken')]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ promptId: 'broken', title: 'broken', errors: 1, warnings: 0 });
  });

  it('ignores an unfinished draft: missing pieces are not defects', () => {
    const draft = prompt('draft', {
      content: createBlankDocument({ name: 'Draft', role: '', objective: '', instructions: [] }),
    });

    expect(collectQualityAttention([draft])).toEqual([]);
  });

  it('says nothing about a clean prompt', () => {
    expect(collectQualityAttention([prompt('clean')])).toEqual([]);
  });

  it('ignores suggestions: a rule of thumb is not "needs attention"', () => {
    const suggestionOnly = prompt('polite', {
      content: createBlankDocument({
        name: 'Polite',
        role: '',
        objective: 'Classify each ticket.',
        instructions: ['Read it.'],
        examples: [{ input: 'A', output: 'B' }],
      }),
    });

    expect(collectQualityAttention([suggestionOnly])).toEqual([]);
  });

  it('skips archived prompts and documents that do not parse', () => {
    const archived = withIssues('archived', { archived: true });
    const corrupt = {
      ...prompt('corrupt'),
      content: { not: 'a document' } as unknown as Prompt['content'],
    };

    expect(collectQualityAttention([archived])).toEqual([]);
    expect(collectQualityAttention([corrupt])).toEqual([]);
  });

  it('respects dismissals, so a dismissed finding does not nag', () => {
    const target = withIssues('broken');
    const report = inspectQuality({
      document: target.content,
      record: { description: target.description },
      snippetIds: [],
      schemaIds: [],
    });
    const errors = report.findings.filter((finding) => finding.severity === 'error');
    const dismissal = createDismissal(
      errors[0]!,
      'Known, tracked elsewhere.',
      '2026-10-25T09:00:00.000Z',
    );

    expect(dismissal.ok).toBe(true);
    if (!dismissal.ok) return;

    const before = collectQualityAttention([target]);
    const after = collectQualityAttention([target], { dismissedFor: () => [dismissal.dismissal] });

    expect(before[0]?.errors).toBe(1);
    expect(after).toEqual([]);

    // Dismissing every finding takes the prompt off the list entirely.
    const all = report.findings.map((finding) => {
      const created = createDismissal(finding, 'Handled elsewhere.', '2026-10-25T09:00:00.000Z');
      if (!created.ok) throw new Error(created.error);
      return created.dismissal;
    });

    expect(collectQualityAttention([target], { dismissedFor: () => all })).toEqual([]);
  });

  it('puts the prompt with the most errors first', () => {
    const twoErrors = prompt('more', {
      content: createBlankDocument({
        name: 'More',
        role: 'Support lead',
        objective: 'Classify {{ghost}} and {{phantom}}.',
        instructions: ['Read it.'],
        examples: [{ input: 'A', output: 'B' }],
      }),
    });
    const oneError = withIssues('fewer');

    const items = collectQualityAttention([oneError, twoErrors]);

    expect(items.map((item) => [item.promptId, item.errors])).toEqual([
      ['more', 2],
      ['fewer', 1],
    ]);
  });

  it('words the counts as a sentence', () => {
    expect(
      describeQualityAttention({
        promptId: 'p',
        title: 'P',
        updatedAt: '',
        errors: 2,
        warnings: 1,
      }),
    ).toBe('3 structural findings: 2 errors, 1 warning');
    expect(
      describeQualityAttention({
        promptId: 'p',
        title: 'P',
        updatedAt: '',
        errors: 0,
        warnings: 1,
      }),
    ).toBe('1 structural finding: 1 warning');
  });
});
