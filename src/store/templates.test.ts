import { describe, expect, it } from 'vitest';

import { createInMemoryRepositories, RecordNotFoundError, type Repositories } from '@/data';
import { createBlankDocument } from '@/domain/promptDocument';
import { RuleViolationError } from '@/domain/errors';
import {
  createPrompt as createPromptEntity,
  createPromptSchema,
  createTemplate as createTemplateEntity,
} from '@/domain/factories';
import type { PromptDocument, PromptTemplate } from '@/domain/types';
import { createDataStore, type DataStore } from '@/store/dataStore';

const NOW = new Date('2026-10-24T09:00:00.000Z');

const deps = { now: () => NOW, newId: () => 'fixed-id' };

function documentWith(overrides: Partial<PromptDocument> = {}): PromptDocument {
  return createBlankDocument({
    name: 'Meeting summary',
    role: 'Analyst',
    objective: 'Summarise a transcript.',
    instructions: ['List decisions first.'],
    variables: [{ name: 'transcript', type: 'string', required: true }],
    metadata: { tags: ['meetings'] },
    ...overrides,
  });
}

function builtIn(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  return createTemplateEntity(
    {
      name: overrides.name ?? 'Built-in template',
      description: overrides.description ?? 'Ships with the app.',
      category: overrides.category ?? 'Extraction',
      content: overrides.content ?? documentWith(),
      isBuiltIn: true,
    },
    { now: () => NOW, newId: () => overrides.id ?? 'built-in-1' },
  );
}

interface Harness {
  readonly repositories: Repositories;
  readonly store: DataStore;
}

async function createHarness(
  seed?: (repositories: Repositories) => Promise<void>,
): Promise<Harness> {
  const repositories = await createInMemoryRepositories();
  if (seed) await seed(repositories);

  let counter = 0;
  const store = createDataStore({
    now: () => new Date(NOW.getTime() + counter++ * 1000),
    newId: () => `generated-${counter}`,
  });
  store.getState().attach(repositories, 'durable');
  await store.getState().hydrate();

  return { repositories, store };
}

describe('createTemplate', () => {
  it('stores a user template and records the event', async () => {
    const { repositories, store } = await createHarness();

    const saved = await store.getState().createTemplate({
      name: '  Weekly digest ',
      description: '  Summarise a week ',
      category: 'Analysis',
      content: documentWith(),
    });

    expect(saved).toMatchObject({
      name: 'Weekly digest',
      description: 'Summarise a week',
      category: 'Analysis',
      isBuiltIn: false,
    });
    expect(await repositories.templates.get(saved.id)).toEqual(saved);
    expect(store.getState().activity[0]).toMatchObject({ type: 'template' });
    expect(store.getState().activity[0]?.summary).toContain('Weekly digest');

    await repositories.close();
  });

  it('keeps the catalogue ordered by name', async () => {
    const { repositories, store } = await createHarness();

    await store.getState().createTemplate({ name: 'Zebra', content: documentWith() });
    await store.getState().createTemplate({ name: 'Aardvark', content: documentWith() });

    expect(store.getState().templates.map((template) => template.name)).toEqual([
      'Aardvark',
      'Zebra',
    ]);

    await repositories.close();
  });

  it('defaults the category when none is supplied', async () => {
    const { repositories, store } = await createHarness();

    const saved = await store.getState().createTemplate({ name: 'Plain', content: documentWith() });

    expect(saved.category).toBe('General');

    await repositories.close();
  });

  it('refuses a duplicate name, including case and spacing variants', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.templates.create(builtIn({ name: 'Code review' }));
    });

    await expect(
      store.getState().createTemplate({ name: '  code REVIEW ', content: documentWith() }),
    ).rejects.toBeInstanceOf(RuleViolationError);

    expect(store.getState().templates).toHaveLength(1);
    expect(await repositories.templates.list()).toHaveLength(1);

    await repositories.close();
  });

  it('refuses a document that would not be a valid prompt', async () => {
    const { repositories, store } = await createHarness();

    await expect(
      store.getState().createTemplate({
        name: 'Broken',
        content: documentWith({ name: '   ' }),
      }),
    ).rejects.toBeInstanceOf(RuleViolationError);

    expect(await repositories.templates.list()).toHaveLength(0);

    await repositories.close();
  });
});

describe('createTemplateFromPrompt', () => {
  it('copies the document, clears snippet references, and borrows the description', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.prompts.create(
        createPromptEntity(
          {
            title: 'Quarterly review',
            description: 'Draft the quarterly email.',
            content: documentWith({ includes: ['snippet-1'] }),
          },
          deps,
        ),
      );
    });

    const prompt = store.getState().prompts[0];
    expect(prompt).toBeDefined();
    if (!prompt) return;

    const template = await store.getState().createTemplateFromPrompt(prompt.id, {
      name: '',
      category: 'Writing',
    });

    expect(template.name).toBe('Quarterly review');
    expect(template.description).toBe('Draft the quarterly email.');
    expect(template.category).toBe('Writing');
    expect(template.isBuiltIn).toBe(false);
    expect(template.content.includes).toEqual([]);
    expect(template.content.instructions).toEqual(['List decisions first.']);

    await repositories.close();
  });

  it('fails when the prompt does not exist', async () => {
    const { repositories, store } = await createHarness();

    await expect(
      store.getState().createTemplateFromPrompt('missing', { name: 'X' }),
    ).rejects.toBeInstanceOf(RecordNotFoundError);

    await repositories.close();
  });
});

describe('updateTemplate', () => {
  it('renames a user template and records the rename', async () => {
    const { repositories, store } = await createHarness();
    const template = await store.getState().createTemplate({
      name: 'Draft name',
      category: 'Content',
      content: documentWith(),
    });

    const updated = await store.getState().updateTemplate(template.id, {
      name: 'Final name',
      category: '  Writing ',
    });

    expect(updated).toMatchObject({ name: 'Final name', category: 'Writing' });
    expect(updated.updatedAt >= template.updatedAt).toBe(true);
    expect(store.getState().activity[0]?.summary).toBe(
      'Renamed the “Draft name” template to “Final name”',
    );
    expect(await repositories.templates.get(template.id)).toEqual(updated);

    await repositories.close();
  });

  it('refuses a rename that collides with another template', async () => {
    const { repositories, store } = await createHarness();
    await store.getState().createTemplate({ name: 'Taken', content: documentWith() });
    const other = await store.getState().createTemplate({
      name: 'Free',
      content: documentWith(),
    });

    await expect(
      store.getState().updateTemplate(other.id, { name: 'taken' }),
    ).rejects.toBeInstanceOf(RuleViolationError);

    expect(store.getState().templates.find((item) => item.id === other.id)?.name).toBe('Free');

    await repositories.close();
  });

  it('refuses to edit a built-in', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.templates.create(builtIn({ id: 'built-in-1', name: 'Extraction' }));
    });

    await expect(
      store.getState().updateTemplate('built-in-1', { name: 'Mine now' }),
    ).rejects.toBeInstanceOf(RuleViolationError);

    expect((await repositories.templates.get('built-in-1'))?.name).toBe('Extraction');

    await repositories.close();
  });

  it('fails for an unknown template', async () => {
    const { repositories, store } = await createHarness();

    await expect(store.getState().updateTemplate('missing', { name: 'X' })).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );

    await repositories.close();
  });
});

describe('duplicateTemplate', () => {
  it('copies a built-in into a customisable user template', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.templates.create(builtIn({ id: 'built-in-1', name: 'Extraction' }));
    });

    const copy = await store.getState().duplicateTemplate('built-in-1');

    expect(copy).toMatchObject({ name: 'Extraction (copy)', isBuiltIn: false });
    expect(copy.id).not.toBe('built-in-1');
    expect(copy.content).toEqual(documentWith());
    expect((await repositories.templates.get('built-in-1'))?.name).toBe('Extraction');
    expect(store.getState().templates).toHaveLength(2);

    await repositories.close();
  });

  it('does not share the document with its source', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.templates.create(builtIn({ id: 'built-in-1', name: 'Extraction' }));
    });

    const copy = await store.getState().duplicateTemplate('built-in-1');
    const edited = await store.getState().updateTemplate(copy.id, {
      name: 'Extraction (mine)',
    });

    expect(edited.content).toEqual(documentWith());
    expect((await repositories.templates.get('built-in-1'))?.content).toEqual(documentWith());

    await repositories.close();
  });

  it('numbers second copies and accepts explicit overrides', async () => {
    const { repositories, store } = await createHarness();
    const source = await store.getState().createTemplate({
      name: 'Digest',
      content: documentWith(),
    });

    const first = await store.getState().duplicateTemplate(source.id);
    const second = await store.getState().duplicateTemplate(source.id);
    const named = await store.getState().duplicateTemplate(source.id, { name: 'Digest (mine)' });

    expect(first.name).toBe('Digest (copy)');
    expect(second.name).toBe('Digest (copy 2)');
    expect(named.name).toBe('Digest (mine)');

    await repositories.close();
  });
});

describe('deleteTemplate', () => {
  it('deletes a user template and records it', async () => {
    const { repositories, store } = await createHarness();
    const template = await store.getState().createTemplate({
      name: 'Disposable',
      content: documentWith(),
    });

    const removed = await store.getState().deleteTemplate(template.id);

    expect(removed.id).toBe(template.id);
    expect(await repositories.templates.get(template.id)).toBeNull();
    expect(store.getState().templates).toHaveLength(0);
    expect(store.getState().activity[0]?.summary).toBe('Deleted the “Disposable” template');

    await repositories.close();
  });

  it('refuses to delete a built-in', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.templates.create(builtIn({ id: 'built-in-1', name: 'Extraction' }));
    });

    await expect(store.getState().deleteTemplate('built-in-1')).rejects.toBeInstanceOf(
      RuleViolationError,
    );

    expect(await repositories.templates.get('built-in-1')).not.toBeNull();

    await repositories.close();
  });
});

describe('useTemplate', () => {
  it('creates an independent prompt and records the usage', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.templates.create(builtIn({ id: 'built-in-1', name: 'Meeting summary' }));
    });

    const prompt = await store.getState().useTemplate('built-in-1');

    expect(prompt.id).not.toBe('built-in-1');
    expect(prompt.version).toBe(1);
    expect(prompt.title).toBe('Meeting summary');
    expect(prompt.content).toEqual(documentWith());
    expect(prompt.tags).toEqual(['meetings']);
    expect(prompt.variables).toEqual(documentWith().variables);
    expect(store.getState().prompts[0]).toEqual(prompt);
    expect(store.getState().activity[0]).toMatchObject({
      type: 'template',
      promptId: prompt.id,
      promptTitle: prompt.title,
    });
    expect(store.getState().activity[0]?.summary).toBe(
      'Created “Meeting summary” from the “Meeting summary” template',
    );
    expect(await repositories.templates.list()).toHaveLength(1);

    await repositories.close();
  });

  it('gives every use a fresh identity and an unshared document', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.templates.create(builtIn({ id: 'built-in-1', name: 'Meeting summary' }));
    });

    const first = await store.getState().useTemplate('built-in-1');
    const second = await store.getState().useTemplate('built-in-1');

    expect(second.id).not.toBe(first.id);
    expect(second.content).not.toBe(first.content);

    const edited = await store.getState().editPrompt(first.id, {
      content: { ...first.content, objective: 'Only the first prompt changed.' },
    });
    expect(edited.content.objective).toBe('Only the first prompt changed.');
    expect((await store.getState().useTemplate('built-in-1')).content.objective).toBe(
      'Summarise a transcript.',
    );
    expect((await repositories.templates.get('built-in-1'))?.content.objective).toBe(
      'Summarise a transcript.',
    );

    await repositories.close();
  });

  it('drops snippet references and an unknown schema reference', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.templates.create(
        builtIn({
          id: 'built-in-1',
          name: 'With references',
          content: documentWith({
            includes: ['snippet-1'],
            output: { format: 'json', schemaRef: 'missing-schema' },
          }),
        }),
      );
    });

    const prompt = await store.getState().useTemplate('built-in-1');

    expect(prompt.content.includes).toEqual([]);
    expect(prompt.content.output.schemaRef).toBeUndefined();

    await repositories.close();
  });

  it('keeps a schema reference this browser stores', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.schemas.create(
        createPromptSchema(
          { name: 'Invoice', schemaContent: { type: 'object' } },
          { now: () => NOW, newId: () => 'schema-1' },
        ),
      );
      await repos.templates.create(
        builtIn({
          id: 'built-in-1',
          name: 'With schema',
          content: documentWith({ output: { format: 'json', schemaRef: 'schema-1' } }),
        }),
      );
    });

    const prompt = await store.getState().useTemplate('built-in-1');

    expect(prompt.content.output.schemaRef).toBe('schema-1');

    await repositories.close();
  });

  it('accepts a title override', async () => {
    const { repositories, store } = await createHarness(async (repos) => {
      await repos.templates.create(builtIn({ id: 'built-in-1', name: 'Meeting summary' }));
    });

    const prompt = await store.getState().useTemplate('built-in-1', { title: 'Q3 kickoff' });

    expect(prompt.title).toBe('Q3 kickoff');

    await repositories.close();
  });

  it('fails for an unknown template', async () => {
    const { repositories, store } = await createHarness();

    await expect(store.getState().useTemplate('missing')).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );
    expect(store.getState().prompts).toHaveLength(0);

    await repositories.close();
  });
});
