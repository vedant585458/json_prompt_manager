import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import { createBlankDocument } from '@/domain/promptDocument';
import { createDefaultSettings, createPrompt, createTemplate } from '@/domain/factories';
import type { Prompt, PromptTemplate } from '@/domain/types';
import { usePreferencesStore } from '@/store/preferences';
import { useUiStore } from '@/store/uiStore';
import { renderAppWithData } from '@/test/renderAppWithData';

const COMPLETED_ONBOARDING = '2026-01-02T09:00:00.000Z';
const BASE_TIME = '2026-10-24T09:00:00.000Z';

function documentWith(name: string, objective: string, tag: string) {
  return createBlankDocument({
    name,
    role: 'Analyst',
    objective,
    instructions: ['Read the input.', 'Return the result.'],
    constraints: ['Never invent a value.'],
    variables: [
      { name: 'source_text', type: 'string', required: true },
      { name: 'fields', type: 'json', required: false },
    ],
    output: { format: 'json' },
    metadata: { tags: [tag] },
  });
}

function templateFixture(overrides: {
  id: string;
  name: string;
  category: string;
  description?: string;
  isBuiltIn?: boolean;
  tag?: string;
}): PromptTemplate {
  return createTemplate(
    {
      name: overrides.name,
      description: overrides.description ?? `${overrides.name} description.`,
      category: overrides.category,
      content: documentWith(
        overrides.name,
        `Do the ${overrides.name} job.`,
        overrides.tag ?? 'starter',
      ),
      isBuiltIn: overrides.isBuiltIn ?? true,
    },
    { now: () => new Date(BASE_TIME), newId: () => overrides.id },
  );
}

function promptFixture(id: string, title: string): Prompt {
  return createPrompt(
    {
      title,
      description: `${title} description.`,
      content: documentWith(title, 'Draft something.', 'writing'),
    },
    { now: () => new Date(BASE_TIME), newId: () => id },
  );
}

const BUILT_IN = templateFixture({
  id: 'tpl-extraction',
  name: 'Structured field extraction',
  category: 'Extraction',
  tag: 'extraction',
});
const BUILT_IN_TWO = templateFixture({
  id: 'tpl-review',
  name: 'Pull request review',
  category: 'Code review',
  tag: 'code',
});
const CUSTOM = templateFixture({
  id: 'tpl-custom',
  name: 'My digest',
  category: 'Writing',
  isBuiltIn: false,
});

async function openTemplates(
  options: {
    readonly templates?: readonly PromptTemplate[];
    readonly prompts?: readonly Prompt[];
    readonly path?: string;
  } = {},
) {
  const repositories = createInMemoryRepositories({
    prompts: [...(options.prompts ?? [])],
    templates: [...(options.templates ?? [BUILT_IN, BUILT_IN_TWO, CUSTOM])],
    settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
  });

  const harness = renderAppWithData({
    repositories,
    path: options.path ?? '/templates',
    mode: 'durable',
  });
  await waitFor(() => expect(harness.store.getState().status).toBe('ready'));
  // `hidden` on purpose: a `?template=` deep link opens the preview immediately,
  // and Radix marks the page behind an open sheet as aria-hidden.
  await screen.findByRole('heading', { level: 1, name: 'Templates', hidden: true });

  return { ...harness, repositories };
}

function card(name: string) {
  return screen.getByRole('article', { name });
}

function filters() {
  return within(screen.getByRole('region', { name: 'Find a template' }));
}

function openCardMenu(name: string) {
  return userEvent.click(
    within(card(name)).getByRole('button', { name: `More actions for “${name}”` }),
  );
}

beforeEach(() => {
  useUiStore.setState({
    sidebarOpen: true,
    rightPanel: 'none',
    paletteOpen: false,
    helpOpen: false,
  });
  usePreferencesStore.setState({ indentSize: 2 });
});

describe('templates catalogue', () => {
  it('separates built-in and custom templates and labels both', async () => {
    await openTemplates();

    expect(within(card('Structured field extraction')).getByText('Built-in')).toBeInTheDocument();
    expect(within(card('My digest')).getByText('Custom')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Built-in templates' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Your templates' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Showing 3 of 3 templates.');
  });

  it('shows variable counts, category, and tags before anything is created', async () => {
    await openTemplates();

    const extraction = within(card('Structured field extraction'));
    expect(extraction.getByText('Extraction')).toBeInTheDocument();
    expect(extraction.getByText('2 · 1 req')).toBeInTheDocument();
    expect(extraction.getByText('extraction')).toBeInTheDocument();
    expect(extraction.getByText('Read-only · duplicate to customise')).toBeInTheDocument();
  });

  it('filters by search across name and tag, and reports an empty result', async () => {
    const user = userEvent.setup();
    await openTemplates();

    await user.type(screen.getByLabelText(/^Search templates/), 'code');

    expect(screen.queryByRole('article', { name: 'Structured field extraction' })).toBeNull();
    expect(screen.getByRole('article', { name: 'Pull request review' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Showing 1 of 3 templates after filtering.',
    );

    await user.clear(screen.getByLabelText(/^Search templates/));
    await user.type(screen.getByLabelText(/^Search templates/), 'nothing matches this');

    expect(screen.getByText('No templates match')).toBeInTheDocument();
    await user.click(filters().getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('status')).toHaveTextContent('Showing 3 of 3 templates.');
  });

  it('filters by kind and by category', async () => {
    const user = userEvent.setup();
    await openTemplates();

    const kindGroup = within(screen.getByRole('group', { name: 'Template kind' }));
    await user.click(kindGroup.getByRole('button', { name: 'Built-in' }));

    expect(screen.queryByRole('article', { name: 'My digest' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Your templates' })).toBeNull();

    await user.click(kindGroup.getByRole('button', { name: 'Custom' }));
    expect(screen.getByRole('article', { name: 'My digest' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Built-in templates' })).toBeNull();

    await user.click(kindGroup.getByRole('button', { name: 'All' }));
    await user.selectOptions(screen.getByLabelText(/^Category/), 'Code review');

    expect(screen.getByRole('status')).toHaveTextContent(
      'Showing 1 of 3 templates after filtering.',
    );
    expect(screen.getByRole('article', { name: 'Pull request review' })).toBeInTheDocument();
  });

  it('explains that there are no custom templates yet', async () => {
    await openTemplates({ templates: [BUILT_IN] });

    expect(screen.getByText('No custom templates yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save a prompt as a template' })).toBeInTheDocument();
  });

  it('shows a real empty state when nothing is stored', async () => {
    await openTemplates({ templates: [] });

    expect(screen.getByText('No templates stored')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Showing 0 of 0 templates.');
  });
});

describe('template preview', () => {
  it('opens from a card with the document summary and variables', async () => {
    const user = userEvent.setup();
    await openTemplates();

    await user.click(
      within(card('Structured field extraction')).getByRole('button', { name: 'Preview' }),
    );

    const sheet = await screen.findByRole('dialog');
    expect(
      within(sheet).getByRole('heading', { name: 'Structured field extraction' }),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole('heading', { name: 'Variables' })).toBeInTheDocument();
    expect(within(sheet).getByRole('rowheader', { name: 'source_text' })).toBeInTheDocument();
    expect(within(sheet).getByText('2 (1 required)')).toBeInTheDocument();
    expect(within(sheet).getByText(/characters of JSON/)).toBeInTheDocument();
    expect(within(sheet).getByText(/Read the input\./)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Use template' })).toBeInTheDocument();
  });

  it('opens from a dashboard deep link and closes back to the catalogue', async () => {
    const user = userEvent.setup();
    const { router } = await openTemplates({ path: '/templates?template=tpl-review' });

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('heading', { name: 'Pull request review' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(router.state.location.search).toBe('');
    // `hidden` includes the catalogue while Radix finishes lifting aria-hidden
    // from the page behind the sheet.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Templates', hidden: true }),
    ).toBeInTheDocument();
  });
});

describe('using a template', () => {
  it('creates an independent prompt and opens the composer for it', async () => {
    const user = userEvent.setup();
    const { store } = await openTemplates();

    await user.click(
      within(card('Structured field extraction')).getByRole('button', { name: 'Use' }),
    );

    await screen.findByRole('heading', { level: 1, name: /^Compose “/ });

    const prompts = store.getState().prompts;
    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.title).toBe('Structured field extraction');
    expect(prompts[0]?.content.objective).toBe('Do the Structured field extraction job.');
    expect(store.getState().templates).toHaveLength(3);
    expect(store.getState().activity[0]).toMatchObject({ type: 'template' });
  });

  it('creates a second, separate prompt from the same template', async () => {
    const user = userEvent.setup();
    const { store, repositories } = await openTemplates();

    await user.click(
      within(card('Structured field extraction')).getByRole('button', { name: 'Use' }),
    );
    await screen.findByRole('heading', { level: 1, name: /^Compose “/ });

    await user.click(screen.getByRole('link', { name: 'Templates' }));
    await screen.findByRole('heading', { level: 1, name: 'Templates' });
    await user.click(
      within(card('Structured field extraction')).getByRole('button', { name: 'Use' }),
    );
    await screen.findByRole('heading', { level: 1, name: /^Compose “/ });

    const prompts = await repositories.prompts.list();
    expect(prompts).toHaveLength(2);
    expect(prompts[0]?.id).not.toBe(prompts[1]?.id);
    expect(await repositories.templates.list()).toHaveLength(3);
    expect(
      store.getState().templates.find((template) => template.id === 'tpl-extraction')?.content,
    ).toEqual(BUILT_IN.content);
  });
});

describe('custom template management', () => {
  it('duplicates a built-in into an editable custom template', async () => {
    const user = userEvent.setup();
    await openTemplates();

    await openCardMenu('Structured field extraction');
    expect(screen.queryByRole('menuitem', { name: /Delete template/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Rename or re-describe/ })).toBeNull();

    await user.click(screen.getByRole('menuitem', { name: 'Duplicate to customise' }));

    await screen.findByRole('article', { name: 'Structured field extraction (copy)' });
    expect(
      within(card('Structured field extraction (copy)')).getByText('Custom'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Showing 4 of 4 templates.');
  });

  it('renames a custom template through the dialog', async () => {
    const user = userEvent.setup();
    const { store } = await openTemplates();

    await openCardMenu('My digest');
    await user.click(screen.getByRole('menuitem', { name: 'Rename or re-describe' }));

    const dialog = await screen.findByRole('dialog');
    const nameField = within(dialog).getByLabelText(/^Name/);
    await user.clear(nameField);
    await user.type(nameField, 'Weekly digest');
    await user.click(within(dialog).getByRole('button', { name: 'Save details' }));

    await waitFor(() =>
      expect(store.getState().templates.find((item) => item.id === 'tpl-custom')?.name).toBe(
        'Weekly digest',
      ),
    );
    expect(await screen.findByRole('article', { name: 'Weekly digest' })).toBeInTheDocument();
  });

  it('refuses a duplicate name in the dialog before writing', async () => {
    const user = userEvent.setup();
    const { store } = await openTemplates();

    await openCardMenu('My digest');
    await user.click(screen.getByRole('menuitem', { name: 'Rename or re-describe' }));

    const dialog = await screen.findByRole('dialog');
    const nameField = within(dialog).getByLabelText(/^Name/);
    await user.clear(nameField);
    await user.type(nameField, 'Pull request review');

    expect(within(dialog).getByText(/already exists/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save details' })).toBeDisabled();
    expect(store.getState().templates.find((item) => item.id === 'tpl-custom')?.name).toBe(
      'My digest',
    );
  });

  it('deletes a custom template after confirmation', async () => {
    const user = userEvent.setup();
    const { store } = await openTemplates();

    await openCardMenu('My digest');
    await user.click(screen.getByRole('menuitem', { name: 'Delete template' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete “My digest”?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete template' }));

    await waitFor(() =>
      expect(store.getState().templates.some((item) => item.id === 'tpl-custom')).toBe(false),
    );
    expect(screen.queryByRole('article', { name: 'My digest' })).toBeNull();
    expect(screen.getByText('No custom templates yet')).toBeInTheDocument();
  });

  it('creates a template from a stored prompt', async () => {
    const user = userEvent.setup();
    const { store } = await openTemplates({
      prompts: [promptFixture('prompt-1', 'Quarterly review')],
    });

    await user.click(screen.getByRole('button', { name: 'New template' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Save a prompt as a template' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/“Quarterly review” has 2 instructions and 2 variables/),
    ).toBeInTheDocument();

    const nameField = within(dialog).getByLabelText(/^Name/);
    await user.type(nameField, 'Quarterly template');
    await user.type(within(dialog).getByLabelText(/^Category/), 'Writing');
    await user.click(within(dialog).getByRole('button', { name: 'Create template' }));

    await waitFor(() => expect(store.getState().templates).toHaveLength(4));
    const created = store.getState().templates.find((item) => item.name === 'Quarterly template');
    expect(created).toMatchObject({ category: 'Writing', isBuiltIn: false });
    expect(created?.content.objective).toBe('Draft something.');
    expect(await screen.findByRole('article', { name: 'Quarterly template' })).toBeInTheDocument();
  });

  it('requires a category and a name before creating a template', async () => {
    const user = userEvent.setup();
    await openTemplates({ prompts: [promptFixture('prompt-1', 'Quarterly review')] });

    await user.click(screen.getByRole('button', { name: 'New template' }));

    const dialog = await screen.findByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Create template' });

    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/^Category/), 'Writing');
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/^Name/), 'Quarterly template');
    expect(submit).toBeEnabled();
  });

  it('says there is nothing to save when no prompts exist', async () => {
    await openTemplates({ prompts: [] });

    await userEvent.click(screen.getByRole('button', { name: 'New template' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('No prompts to save yet')).toBeInTheDocument();
  });
});
