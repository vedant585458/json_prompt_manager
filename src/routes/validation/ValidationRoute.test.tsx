import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import { createDefaultSettings, createPrompt, createPromptSchema } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type { JsonObject, Prompt, PromptSchema } from '@/domain/types';
import { renderAppWithData } from '@/test/renderAppWithData';
import { useUiStore } from '@/store/uiStore';

const COMPLETED_ONBOARDING = '2026-01-02T09:00:00.000Z';
const BASE_TIME = '2026-10-24T09:00:00.000Z';

const INVOICE_SCHEMA: JsonObject = {
  type: 'object',
  required: ['name', 'objective', 'schemaVersion'],
  properties: {
    name: { type: 'string', minLength: 3 },
    objective: { type: 'string' },
    schemaVersion: { const: '1.0' },
  },
};

function makePrompt(overrides: Partial<Prompt> & { id: string; title: string }): Prompt {
  const base = createPrompt(
    {
      title: overrides.title,
      description: 'Summarises a support thread.',
      content: createBlankDocument({ name: overrides.title }),
    },
    { now: () => new Date(BASE_TIME), newId: () => overrides.id },
  );

  return { ...base, ...overrides };
}

function makeSchema(id: string, name: string, content: JsonObject = INVOICE_SCHEMA): PromptSchema {
  return createPromptSchema(
    { name, description: 'Requires a name and an objective.', schemaContent: content },
    { now: () => new Date(BASE_TIME), newId: () => id },
  );
}

function renderStudio(
  seed: {
    prompts?: readonly Prompt[];
    schemas?: readonly PromptSchema[];
    path?: string;
  } = {},
) {
  const repositories = createInMemoryRepositories({
    prompts: seed.prompts ?? [],
    schemas: seed.schemas ?? [],
    settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
  });

  return {
    ...renderAppWithData({ repositories, path: seed.path ?? '/validation' }),
    repositories,
  };
}

async function open(path = '/validation', seed: Parameters<typeof renderStudio>[0] = {}) {
  const harness = renderStudio({ ...seed, path });
  await waitFor(() => expect(harness.store.getState().status).toBe('ready'));
  return harness;
}

beforeEach(() => {
  useUiStore.setState({
    sidebarOpen: true,
    paletteOpen: false,
    helpOpen: false,
    selectedPromptIds: [],
    selectedPromptId: null,
  });
});

describe('validation studio (TASK-016)', () => {
  it('states its scope and says nothing is checked without a prompt', async () => {
    await open();

    expect(await screen.findByRole('heading', { level: 1, name: 'Validation' })).toBeVisible();
    expect(screen.getByText(/not a judgement of prompt quality/i)).toBeVisible();
    expect(screen.getByText('No prompts to validate')).toBeVisible();
    expect(screen.getByRole('link', { name: 'New prompt' })).toHaveAttribute(
      'href',
      '/library?new=prompt',
    );
  });

  it('reports a stored document as valid with its scope in words', async () => {
    await open('/validation', { prompts: [makePrompt({ id: 'alpha', title: 'Invoice parser' })] });

    expect(await screen.findByText('Valid JSON')).toBeVisible();
    expect(
      screen.getByText('Valid JSON, and the document matches the PromptForge shape.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open in the editor' })).toHaveAttribute(
      'href',
      '/prompts/alpha',
    );
  });

  it('checks against the attached schema and lists per-path errors', async () => {
    const schema = makeSchema('schema-1', 'Invoice shape');
    const prompt = makePrompt({
      id: 'alpha',
      title: 'Invoice parser',
      schemaId: schema.id,
      content: { ...createBlankDocument({ name: 'x' }) },
    });

    await open('/validation', { prompts: [prompt], schemas: [schema] });

    expect(await screen.findByText('Does not meet the schema')).toBeVisible();
    expect(screen.getByText(/^against$/)).toBeVisible();
    expect(screen.getAllByText('Invoice shape').length).toBeGreaterThan(0);
    expect(screen.getByText(/Must be at least 3 characters/)).toBeVisible();
    expect(screen.getByText('$.name')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Copy the JSON Pointer for $.name' })).toBeVisible();
  });

  it('filters findings by severity', async () => {
    const user = userEvent.setup();
    const schema = makeSchema('schema-1', 'Invoice shape');
    const prompt = makePrompt({
      id: 'alpha',
      title: 'Invoice parser',
      schemaId: schema.id,
      content: { ...createBlankDocument({ name: 'x' }) },
    });

    await open('/validation', { prompts: [prompt], schemas: [schema] });
    await screen.findByText('Does not meet the schema');

    await user.click(screen.getByRole('button', { name: 'Warnings only' }));
    expect(screen.getByText('No warnings in this report.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Errors only' }));
    expect(screen.getByText(/Must be at least 3 characters/)).toBeVisible();
  });

  it('explains a schema it cannot evaluate instead of blaming the document', async () => {
    const schema = makeSchema('schema-1', 'Broken schema', {
      type: 'object',
      if: { required: ['name'] },
    });
    const prompt = makePrompt({ id: 'alpha', title: 'Invoice parser', schemaId: schema.id });

    await open('/validation', { prompts: [prompt], schemas: [schema] });

    expect(await screen.findByText('Schema cannot be checked')).toBeVisible();
    expect(screen.getByText(/does not implement/)).toBeVisible();
    expect(screen.queryByText('Does not meet the schema')).not.toBeInTheDocument();
  });

  it('says when the attached schema is missing from this browser', async () => {
    const prompt = makePrompt({ id: 'alpha', title: 'Invoice parser', schemaId: 'gone' });

    await open('/validation', { prompts: [prompt] });

    expect(await screen.findByText('The attached schema is missing')).toBeVisible();
    expect(screen.getByText(/only\s+syntax and document shape were checked/)).toBeVisible();
  });

  it('creates a schema, attaches it, and checks the prompt against it', async () => {
    const user = userEvent.setup();
    const prompt = makePrompt({ id: 'alpha', title: 'Invoice parser' });
    const { repositories } = await open('/validation', { prompts: [prompt] });

    await user.click(await screen.findByRole('button', { name: 'New schema' }));

    const dialog = await screen.findByRole('dialog', { name: 'New JSON Schema' });
    await user.type(within(dialog).getByLabelText(/Name/), 'Team shape');
    await user.clear(within(dialog).getByLabelText(/Schema JSON/));
    await user.click(within(dialog).getByLabelText(/Schema JSON/));
    await user.paste(
      JSON.stringify({
        type: 'object',
        required: ['objective'],
        properties: { objective: { type: 'string', minLength: 10 } },
      }),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Create schema' }));

    expect(await screen.findAllByText('Team shape')).not.toHaveLength(0);
    await waitFor(async () => {
      await expect(repositories.schemas.list()).resolves.toHaveLength(1);
    });

    const select = screen.getByLabelText('Schema attached to this prompt');
    const stored = await repositories.schemas.list();
    await user.selectOptions(select, stored[0]?.id ?? '');

    expect(await screen.findByText('Does not meet the schema')).toBeVisible();
    await waitFor(async () => {
      await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({
        schemaId: stored[0]?.id,
      });
    });
  });

  it('refuses to save a schema with a misspelled keyword', async () => {
    const user = userEvent.setup();
    await open('/validation', { prompts: [makePrompt({ id: 'alpha', title: 'Invoice parser' })] });

    await user.click(await screen.findByRole('button', { name: 'New schema' }));
    const dialog = await screen.findByRole('dialog', { name: 'New JSON Schema' });
    await user.type(within(dialog).getByLabelText(/Name/), 'Typo');
    await user.clear(within(dialog).getByLabelText(/Schema JSON/));
    await user.click(within(dialog).getByLabelText(/Schema JSON/));
    await user.paste('{"requird":["name"]}');

    expect(await within(dialog).findByText(/Unrecognised keyword/)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Create schema' })).toBeDisabled();
  });

  it('warns how many prompts a schema change affects, and deletes with the same count', async () => {
    const user = userEvent.setup();
    const schema = makeSchema('schema-1', 'Invoice shape');
    const prompts = [
      makePrompt({ id: 'alpha', title: 'Invoice parser', schemaId: schema.id }),
      makePrompt({ id: 'beta', title: 'Second parser', schemaId: schema.id }),
    ];

    const { repositories } = await open('/validation', { prompts, schemas: [schema] });

    expect(await screen.findByText('2 prompts')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Delete Invoice shape' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete “Invoice shape”?' });
    expect(within(confirm).getByText(/2 prompts use this schema/)).toBeVisible();

    await user.click(within(confirm).getByRole('button', { name: 'Delete schema' }));

    await waitFor(async () => {
      await expect(repositories.schemas.list()).resolves.toHaveLength(0);
    });
    await waitFor(async () => {
      const stored = await repositories.prompts.list();
      expect(stored.every((prompt) => prompt.schemaId === null)).toBe(true);
    });
    expect(await screen.findByText('Schema deleted')).toBeVisible();
  });

  it('shows syntax findings for a document that cannot be stored any more', async () => {
    // A stored record is typed, but storage is untrusted input: this is what a
    // hand-edited row looks like when it is read back.
    const prompt = makePrompt({ id: 'alpha', title: 'Broken prompt' });
    const broken = {
      ...prompt,
      content: { name: 'x' } as unknown as Prompt['content'],
    };

    await open('/validation', { prompts: [broken] });

    expect(await screen.findByText('Shape warnings')).toBeVisible();
    expect(screen.getAllByText(/schemaVersion/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('document').length).toBeGreaterThan(0);
  });

  it('opens the studio already aimed at a prompt from the URL', async () => {
    const prompts = [
      makePrompt({ id: 'alpha', title: 'First prompt' }),
      makePrompt({ id: 'beta', title: 'Second prompt' }),
    ];

    await open('/validation?prompt=beta', { prompts });

    expect(await screen.findByRole('combobox', { name: 'Prompt' })).toHaveValue('beta');
    expect(screen.getByRole('link', { name: 'Open in the editor' })).toHaveAttribute(
      'href',
      '/prompts/beta',
    );
  });
});
