import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import { createDefaultSettings, createPrompt } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type { Prompt, PromptDocument } from '@/domain/types';
import { usePreferencesStore } from '@/store/preferences';
import { useUiStore } from '@/store/uiStore';
import { renderAppWithData } from '@/test/renderAppWithData';

const COMPLETED_ONBOARDING = '2026-01-02T09:00:00.000Z';
const BASE_TIME = '2026-10-24T09:00:00.000Z';

function makePrompt(content: PromptDocument = createBlankDocument()): Prompt {
  return createPrompt(
    { title: 'Invoice parser', description: '', content },
    { now: () => new Date(BASE_TIME), newId: () => 'alpha' },
  );
}

async function openComposer(prompt: Prompt) {
  const repositories = createInMemoryRepositories({
    prompts: [prompt],
    settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
  });

  const harness = renderAppWithData({
    repositories,
    path: '/prompts/alpha/compose',
    mode: 'durable',
  });
  await waitFor(() => expect(harness.store.getState().status).toBe('ready'));
  await screen.findByRole('heading', { level: 1, name: /^Compose “/ });

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

function stored(harness: Awaited<ReturnType<typeof openComposer>>): Prompt {
  const [prompt] = harness.store.getState().prompts;
  if (!prompt) throw new Error('prompt missing');
  return prompt;
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
  usePreferencesStore.setState({ indentSize: 2, autosaveEnabled: true, autosaveDelayMs: 300 });
});

describe('composer — editing a stored prompt (TASK-017)', () => {
  it('loads the stored document into the form and the preview', async () => {
    const prompt = makePrompt(
      createBlankDocument({
        name: 'Invoice parser',
        role: 'Finance analyst',
        objective: 'Extract line items.',
        instructions: ['Read the invoice.'],
        variables: [{ name: 'invoice', type: 'string', required: true }],
      }),
    );

    await openComposer(prompt);

    expect(identity().getByLabelText(/^Name/)).toHaveValue('Invoice parser');
    expect(identity().getByLabelText('Role')).toHaveValue('Finance analyst');
    expect(screen.getByLabelText('instruction 1')).toHaveValue('Read the invoice.');
    expect(preview().textContent).toContain('"objective": "Extract line items."');
    expect(checks().getByText(/not a judgement of the prompt’s quality/)).toBeInTheDocument();
  });

  it('writes a field edit through the save pipeline and bumps the version', async () => {
    const user = userEvent.setup();
    const harness = await openComposer(makePrompt());

    const role = identity().getByLabelText('Role');
    await user.clear(role);
    await user.type(role, 'Support lead');

    expect(await screen.findByText(/^Saved at /, undefined, { timeout: 3000 })).toBeInTheDocument();

    const saved = stored(harness);
    expect(saved.content.role).toBe('Support lead');
    expect(saved.version).toBeGreaterThan(1);
  });

  it('keeps top-level fields the form does not render', async () => {
    const user = userEvent.setup();
    const harness = await openComposer(
      makePrompt({
        ...createBlankDocument({ name: 'Invoice parser' }),
        extras: { temperature: 0.2 },
      }),
    );

    expect(preview().textContent).toContain('"temperature": 0.2');

    const name = identity().getByLabelText(/^Name/);
    await user.clear(name);
    await user.type(name, 'Invoice reader');
    await screen.findByText(/^Saved at /, undefined, { timeout: 3000 });

    const saved = stored(harness);
    expect(saved.content.name).toBe('Invoice reader');
    expect(saved.content.extras).toEqual({ temperature: 0.2 });
  });

  it('holds saving back while a variable name is duplicated, and never normalizes it away', async () => {
    const user = userEvent.setup();
    const harness = await openComposer(
      makePrompt(
        createBlankDocument({
          name: 'Invoice parser',
          variables: [{ name: 'invoice', type: 'string', required: true }],
        }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Add a variable' }));
    const second = within(screen.getByRole('group', { name: 'Variable 2' }));
    await user.type(second.getByLabelText(/^Name/), 'invoice');

    expect(screen.getByText('Saving is held back')).toBeInTheDocument();
    expect(checks().getByText(/already declared at position 1/)).toBeInTheDocument();

    // The disabled button carries the reason, so it does not read as broken.
    const saveNow = screen.getByRole('button', { name: 'Save now' });
    expect(saveNow).toBeDisabled();
    expect(
      document.getElementById(saveNow.getAttribute('aria-describedby') as string),
    ).toHaveTextContent(/Fix the highlighted fields first/);

    // An explicit shortcut save is refused for the same reason — and the bar says
    // so, instead of the press disappearing.
    await user.keyboard('{Meta>}s{/Meta}');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(
      await screen.findByText(/This draft has problems that would be normalized or dropped/),
    ).toBeVisible();

    expect(stored(harness).content.variables).toHaveLength(1);
    expect(stored(harness).version).toBe(1);
    // Both rows are still on screen: nothing was silently de-duplicated.
    expect(second.getByLabelText(/^Name/)).toHaveValue('invoice');
  });

  it('asks before leaving with unsaved changes', async () => {
    const user = userEvent.setup();
    await openComposer(makePrompt());

    await user.type(identity().getByLabelText('Role'), 'Draft role');
    await user.click(screen.getByRole('link', { name: 'Open the JSON editor' }));

    expect(await screen.findByText('Leave with unsaved changes?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.getByRole('heading', { level: 1, name: /^Compose “/ })).toBeInTheDocument();
  });
});
