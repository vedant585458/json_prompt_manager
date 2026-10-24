import { describe, expect, it } from 'vitest';

import { BUILT_IN_TEMPLATE_IDS, BUILT_IN_TEMPLATES } from '@/data/db/templates';
import { validatePromptDocument } from '@/domain/promptDocument';

/** Categories `tasks.md` TASK-018 requires the shipped catalogue to span. */
const REQUIRED_CATEGORIES = [
  'Extraction',
  'Classification',
  'Summarization',
  'Code review',
  'Analysis',
  'Agents',
  'Content',
  'Transformation',
];

describe('built-in template catalogue', () => {
  it('ships at least eight templates', () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(8);
  });

  it('covers every category the task requires', () => {
    const categories = new Set(BUILT_IN_TEMPLATES.map((template) => template.category));

    for (const required of REQUIRED_CATEGORIES) {
      expect(categories, `missing category ${required}`).toContain(required);
    }
  });

  it('uses unique, stable identifiers and unique names', () => {
    const ids = BUILT_IN_TEMPLATES.map((template) => template.id);
    const names = BUILT_IN_TEMPLATES.map((template) => template.name.toLowerCase());

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    expect(ids).toContain(BUILT_IN_TEMPLATE_IDS.structuredExtraction);
    expect(ids).toContain(BUILT_IN_TEMPLATE_IDS.reviewResponse);
  });

  it('keeps the two seed-v1 ids so an upgrade does not duplicate them', () => {
    expect(BUILT_IN_TEMPLATE_IDS.structuredExtraction).toBe('seed-template-structured-extraction');
    expect(BUILT_IN_TEMPLATE_IDS.reviewResponse).toBe('seed-template-review-response');
  });

  it('builds a valid PromptForge document for every entry', () => {
    for (const entry of BUILT_IN_TEMPLATES) {
      const result = validatePromptDocument(entry.buildContent());

      expect(result.ok ? [] : result.issues, `${entry.name} must validate`).toEqual([]);
      expect(result.ok && result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    }
  });

  it('gives every template a role, an objective, instructions, and variables', () => {
    for (const entry of BUILT_IN_TEMPLATES) {
      const document = entry.buildContent();

      expect(document.name.trim().length, `${entry.name}: document name`).toBeGreaterThan(0);
      expect(document.role.trim().length, `${entry.name}: role`).toBeGreaterThan(0);
      expect(document.objective.trim().length, `${entry.name}: objective`).toBeGreaterThan(0);
      expect(document.instructions.length, `${entry.name}: instructions`).toBeGreaterThan(0);
      expect(document.variables.length, `${entry.name}: variables`).toBeGreaterThan(0);
      expect(document.metadata.tags?.length, `${entry.name}: tags`).toBeGreaterThan(0);
    }
  });

  it('declares each variable once, with a valid identifier', () => {
    for (const entry of BUILT_IN_TEMPLATES) {
      const names = entry.buildContent().variables.map((variable) => variable.name);

      expect(new Set(names).size, `${entry.name}: duplicate variable names`).toBe(names.length);
      for (const name of names) {
        expect(name, `${entry.name}: ${name}`).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
      }
    }
  });

  it('builds the same document every time, so seeding is deterministic', () => {
    for (const entry of BUILT_IN_TEMPLATES) {
      expect(entry.buildContent()).toEqual(entry.buildContent());
    }
  });
});
