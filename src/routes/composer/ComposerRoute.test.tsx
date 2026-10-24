import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import { createDefaultSettings, createSnippet } from '@/domain/factories';
import type { Snippet } from '@/domain/types';
import { usePreferencesStore } from '@/store/preferences';
import { useUiStore } from '@/store/uiStore';
import { renderAppWithData } from '@/test/renderAppWithData';

const COMPLETED_ONBOARDING = '2026-01-02T09:00:00.000Z';
const BASE_TIME = '2026-10-24T09:00:00.000Z';

function makeSnippet(overrides: Partial<Snippet> = {}): Snippet {
  return {
    ...createSnippet(
      {
        name: 'Tone block',
        description: 'A short style instruction.',
        targetPath: 'instructions',
        value: ['Be brief.'],
      },
      { now: () => new Date(BASE_TIME), newId: () => 'snippet-1' },
    ),
    ...overrides,
  };
}

async function openComposer(snippets: readonly Snippet[] = []) {
  const repositories = createInMemoryRepositories({
    prompts: [],
    snippets: [...snippets],
    settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
  });

  const harness = renderAppWithData({ repositories, path: '/composer', mode: 'durable' });
  await waitFor(() => expect(harness.store.getState().status).toBe('ready'));
  await screen.findByRole('heading', { level: 1, name: 'Compose a prompt' });

  return { ...harness, repositories };
}

function identity() {
  return within(screen.getByRole('group', { name: 'Identity' }));
}

function checks() {
  return within(screen.getByRole('region', { name: 'Composer checks' }));
}

function preview() {
  return screen.getByLabelText('Current prompt document');
}

beforeEach(() => {
  useUiStore.setState({
    sidebarOpen: true,
    rightPanel: 'none',
    paletteOpen: false,
    helpOpen: false,
    recentCommandIds: [],
    selectedPromptId: null,
    selectedPromptIds: [],
  });
  usePreferencesStore.setState({ indentSize: 2 });
});

describe('composer — creating a prompt (TASK-017)', () => {
  it('starts from a blank document and shows the JSON that will be stored', async () => {
    await openComposer();

    expect(identity().getByLabelText(/^Name/)).toHaveValue('Untitled prompt');
    expect(preview().textContent).toContain('"schemaVersion": "1.0"');
    expect(preview().textContent).toContain('"instructions": []');
    expect(checks().getByRole('status').textContent).toMatch(/0 of 6 sections/);
  });

  it('writes every form edit into the JSON preview', async () => {
    const user = userEvent.setup();
    await openComposer();

    const name = identity().getByLabelText(/^Name/);
    await user.clear(name);
    await user.type(name, 'Invoice parser');
    expect(preview().textContent).toContain('"name": "Invoice parser"');

    await user.click(screen.getByRole('button', { name: 'Add an instruction' }));
    await user.type(screen.getByLabelText('instruction 1'), 'Read the invoice.');
    expect(preview().textContent).toContain('"Read the invoice."');

    await user.click(screen.getByRole('button', { name: 'Move instruction 1 down' }));
    // A single item cannot move; the button is disabled rather than lying.
    expect(screen.getByRole('button', { name: 'Move instruction 1 down' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Add an instruction' }));
    await user.type(screen.getByLabelText('instruction 2'), 'Return JSON.');
    expect(preview().textContent).toMatch(/"Read the invoice\.",\s*"Return JSON\."/);
  });

  it('creates the prompt and opens the composer for it', async () => {
    const user = userEvent.setup();
    const harness = await openComposer();

    const name = identity().getByLabelText(/^Name/);
    await user.clear(name);
    await user.type(name, 'Invoice parser');
    await user.type(screen.getByLabelText('Objective'), 'Extract line items.');

    await user.click(screen.getByRole('button', { name: 'Create prompt' }));

    await waitFor(() =>
      expect(harness.router.state.location.pathname).toMatch(/^\/prompts\/[^/]+\/compose$/),
    );

    const [created] = harness.store.getState().prompts;
    expect(created?.title).toBe('Invoice parser');
    expect(created?.content.name).toBe('Invoice parser');
    expect(created?.content.objective).toBe('Extract line items.');
    expect(
      await screen.findByRole('heading', { level: 1, name: /^Compose “Invoice parser”$/ }),
    ).toBeInTheDocument();
  });

  it('refuses to create a prompt without a name, and says why', async () => {
    const user = userEvent.setup();
    const harness = await openComposer();

    await user.clear(identity().getByLabelText(/^Name/));
    await user.click(screen.getByRole('button', { name: 'Create prompt' }));

    expect(await screen.findByText('The prompt was not created')).toBeInTheDocument();
    expect(checks().getByText(/Give the prompt a name/)).toBeInTheDocument();
    expect(harness.store.getState().prompts).toHaveLength(0);
    expect(harness.router.state.location.pathname).toBe('/composer');
  });

  it('blocks creation while a variable name is unusable, and keeps the row visible', async () => {
    const user = userEvent.setup();
    const harness = await openComposer();

    await user.click(screen.getByRole('button', { name: 'Add a variable' }));
    const variable = within(screen.getByRole('group', { name: 'Variable 1' }));
    await user.type(variable.getByLabelText(/^Name/), '2bad');

    expect(screen.getByText('This draft cannot be stored yet')).toBeInTheDocument();
    expect(checks().getByText(/not a usable variable name/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create prompt' }));

    expect(await screen.findByText('The prompt was not created')).toBeInTheDocument();
    expect(harness.store.getState().prompts).toHaveLength(0);
    // The typed row is still there: nothing was normalized behind the user's back.
    expect(variable.getByLabelText(/^Name/)).toHaveValue('2bad');
  });

  it('refuses a JSON field that does not parse, and does not apply it', async () => {
    const user = userEvent.setup();
    const harness = await openComposer();

    await user.click(screen.getByRole('button', { name: 'Add a variable' }));
    const variable = within(screen.getByRole('group', { name: 'Variable 1' }));
    await user.type(variable.getByLabelText(/^Name/), 'count');
    await user.selectOptions(variable.getByLabelText('Type'), 'number');
    await user.type(variable.getByLabelText('Default value'), 'three');

    expect(
      checks().getByText(/Variable 1 default value is not valid JSON yet/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create prompt' }));
    expect(await screen.findByText('The prompt was not created')).toBeInTheDocument();
    expect(harness.store.getState().prompts).toHaveLength(0);
  });

  it('inserts a stored snippet into the chosen section and records it', async () => {
    const user = userEvent.setup();
    await openComposer([makeSnippet()]);

    await user.selectOptions(screen.getByLabelText('Snippet'), 'snippet-1');
    await user.click(screen.getByRole('button', { name: 'Insert' }));

    expect(preview().textContent).toContain('"Be brief."');
    expect(preview().textContent).toContain('"includes": [\n    "snippet-1"\n  ]');
    expect(
      screen.getAllByText(/Added one entry from “Tone block” to instructions/).length,
    ).toBeGreaterThan(0);
  });

  it('replaces the draft from a starter only after asking', async () => {
    const user = userEvent.setup();
    await openComposer();

    await user.type(identity().getByLabelText('Role'), 'Finance analyst');
    await user.click(screen.getByRole('button', { name: 'Worked example' }));

    expect(screen.getByText('Replace this draft?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Replace the draft' }));

    expect(preview().textContent).toContain('Release notes summarizer');
    expect(identity().getByLabelText('Role')).toHaveValue(
      'Senior release manager writing for busy engineers.',
    );
  });

  it('asks before leaving with an unsubmitted draft', async () => {
    const user = userEvent.setup();
    const harness = await openComposer();

    await user.type(identity().getByLabelText(/^Name/), '!');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(await screen.findByText('Leave the composer?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep composing' }));
    expect(harness.router.state.location.pathname).toBe('/composer');

    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard the draft' }));
    await waitFor(() => expect(harness.router.state.location.pathname).toBe('/library'));
  });
});
