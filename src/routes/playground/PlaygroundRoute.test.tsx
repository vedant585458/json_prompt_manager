import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import { createDefaultSettings, createPrompt } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type { Prompt, PromptDocument } from '@/domain/types';
import { playgroundStorageKey } from '@/features/playground/valuesStorage';
import { usePreferencesStore } from '@/store/preferences';
import { useUiStore } from '@/store/uiStore';
import { renderAppWithData } from '@/test/renderAppWithData';

const COMPLETED_ONBOARDING = '2026-01-02T09:00:00.000Z';
const NOW = new Date('2026-10-24T09:00:00.000Z');

const writeText = vi.fn<(text: string) => Promise<void>>();

function documentWith(overrides: {
  readonly objective?: string;
  readonly variables?: PromptDocument['variables'];
}): PromptDocument {
  return createBlankDocument({
    name: 'Support triage',
    role: 'Support lead',
    objective: overrides.objective ?? 'Queue the {{ticket}} for {{team}}.',
    instructions: ['Read the ticket.', 'Return the queue.'],
    constraints: ['Never invent a value.'],
    variables: overrides.variables ?? [
      { name: 'ticket', type: 'string', required: true },
      { name: 'team', type: 'string', required: true, defaultValue: 'general' },
    ],
    output: { format: 'json' },
  });
}

function promptFixture(content: PromptDocument, id = 'p-triage'): Prompt {
  return createPrompt(
    { title: 'Support triage', description: 'Classify inbound mail.', content },
    { now: () => NOW, newId: () => id },
  );
}

async function openPlayground(
  path: string,
  prompts: readonly Prompt[] = [promptFixture(documentWith({}))],
) {
  const repositories = createInMemoryRepositories({
    prompts: [...prompts],
    settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
  });

  const harness = renderAppWithData({ repositories, path, mode: 'durable' });
  await waitFor(() => expect(harness.store.getState().status).toBe('ready'));
  await screen.findByRole('heading', { level: 1 });

  return harness;
}

function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  return user;
}

beforeEach(() => {
  sessionStorage.clear();
  useUiStore.setState({
    sidebarOpen: true,
    rightPanel: 'none',
    paletteOpen: false,
    helpOpen: false,
  });
  usePreferencesStore.setState({ indentSize: 2 });
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
});

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
});

describe('variable playground (TASK-021)', () => {
  it('blocks the render until the required variable is answered, with a precise reason', async () => {
    await openPlayground('/prompts/p-triage/playground');

    expect(screen.getByText('Rendering is paused')).toBeInTheDocument();
    expect(screen.getByText(/“ticket” is required and has no value\./)).toBeInTheDocument();
    // No copy control for text that does not exist.
    expect(screen.queryByRole('button', { name: /Copy rendered text/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Rendered prompt text' })).not.toBeInTheDocument();
  });

  it('fills the form and updates the rendered prompt', async () => {
    const user = setupUser();
    await openPlayground('/prompts/p-triage/playground');

    const ticket = screen.getByRole('textbox', { name: 'ticket' });
    await user.type(ticket, 'Billing question');

    const output = await screen.findByRole('region', { name: 'Rendered prompt text' });
    await waitFor(() =>
      expect(output).toHaveTextContent('Queue the Billing question for general.'),
    );
    expect(output).toHaveTextContent('INSTRUCTIONS');
    expect(output).toHaveTextContent('1. Read the ticket.');
    expect(output).toHaveTextContent('CONSTRAINTS');

    // The count describes the same text the block shows.
    const text = output.textContent ?? '';
    expect(
      screen.getByText(new RegExp(`${text.length.toLocaleString()} characters`)),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Copy rendered text/ }));
    expect(writeText).toHaveBeenCalledWith(text);
  });

  it('renders typed values, rejects bad input, and never shows a stale preview', async () => {
    const user = setupUser();
    await openPlayground('/prompts/p-mixed/playground', [
      promptFixture(
        documentWith({
          objective: 'Spend {{budget}} on {{payload}} for {{team}}.',
          variables: [
            { name: 'budget', type: 'number', required: true },
            { name: 'payload', type: 'json', required: true },
            { name: 'team', type: 'string', required: true, defaultValue: 'general' },
          ],
        }),
        'p-mixed',
      ),
    ]);

    await user.type(screen.getByRole('textbox', { name: 'budget' }), '250');
    await user.type(screen.getByRole('textbox', { name: 'payload' }), '{{"id":7,"ok":true}');

    const output = await screen.findByRole('region', { name: 'Rendered prompt text' });
    await waitFor(() =>
      expect(output).toHaveTextContent('Spend 250 on {"id":7,"ok":true} for general.'),
    );

    // A number that isn't a number: the field says so and the preview stops.
    await user.clear(screen.getByRole('textbox', { name: 'budget' }));
    await user.type(screen.getByRole('textbox', { name: 'budget' }), '2,5');
    expect(await screen.findByText('Enter a number, for example 42 or 3.5.')).toBeInTheDocument();
    expect(await screen.findByText('Rendering is paused')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'budget' })).toHaveAttribute('aria-invalid', 'true');

    // Malformed JSON is reported with its position rather than swallowed.
    await user.clear(screen.getByRole('textbox', { name: 'payload' }));
    await user.type(screen.getByRole('textbox', { name: 'payload' }), '{{"id": }');
    expect(await screen.findByText(/Line 1, column \d+/)).toBeInTheDocument();
  });

  it('answers a boolean with a switch, and says that unset is not false', async () => {
    const user = setupUser();
    await openPlayground('/prompts/p-flag/playground', [
      promptFixture(
        documentWith({
          objective: 'Mark the result strict: {{strict}}.',
          variables: [{ name: 'strict', type: 'boolean', required: true }],
        }),
        'p-flag',
      ),
    ]);

    expect(screen.getByText('not set')).toBeInTheDocument();
    expect(screen.getByText('Rendering is paused')).toBeInTheDocument();

    const toggle = screen.getByRole('switch', { name: /Value/ });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    const output = await screen.findByRole('region', { name: 'Rendered prompt text' });
    await waitFor(() => expect(output).toHaveTextContent('Mark the result strict: true.'));

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Rendered prompt text' })).toHaveTextContent(
        'Mark the result strict: false.',
      ),
    );
  });

  it('reports undeclared placeholders and unused declarations instead of hiding them', async () => {
    await openPlayground('/prompts/p-odd/playground', [
      promptFixture(
        documentWith({
          objective: 'Queue the {{ticket}} for {{ghost}}.',
          variables: [
            { name: 'ticket', type: 'string', required: true, defaultValue: 'mail' },
            { name: 'unused', type: 'string', required: false },
          ],
        }),
        'p-odd',
      ),
    ]);

    expect(screen.getByText(/Declared but never used:/).parentElement).toHaveTextContent('unused');
    expect(screen.getByText(/Used but not declared:/).parentElement).toHaveTextContent('ghost');

    const output = screen.getByRole('region', { name: 'Rendered prompt text' });
    // The undeclared token is still in the text — marked, not dropped.
    expect(output).toHaveTextContent('Queue the mail for {{ghost}}.');
    expect(screen.getByText(/“ghost” is not declared as a variable/)).toBeInTheDocument();
  });

  it('says a document with no variables renders exactly as written', async () => {
    await openPlayground('/prompts/p-plain/playground', [
      promptFixture(documentWith({ objective: 'Summarise the ticket.', variables: [] }), 'p-plain'),
    ]);

    expect(screen.getByText('This prompt declares no variables.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Rendered prompt text' })).toHaveTextContent(
      'Summarise the ticket.',
    );
  });

  it('remembers inputs for this tab and forgets them afterwards only when cleared', async () => {
    const user = setupUser();
    const { router } = await openPlayground('/prompts/p-triage/playground');

    await user.type(screen.getByRole('textbox', { name: 'ticket' }), 'Billing');
    await waitFor(() =>
      expect(sessionStorage.getItem(playgroundStorageKey('p-triage'))).toContain('Billing'),
    );

    // Leaving and coming back inside the same tab keeps the work.
    await act(async () => {
      await router.navigate('/prompts/p-triage');
    });
    // Wait for the editor to actually commit, so the return is a real remount.
    await screen.findByRole('tab', { name: 'Preview' });
    await act(async () => {
      await router.navigate('/prompts/p-triage/playground');
    });
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'ticket' })).toHaveValue('Billing'),
    );
    expect(screen.getByText(/restored from earlier in this tab/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Rendered prompt text' })).toHaveTextContent(
      'Queue the Billing for general.',
    );

    // Reset all puts every field back to its declared default.
    await user.click(screen.getByRole('button', { name: /Reset all to defaults/ }));
    expect(screen.getByRole('textbox', { name: 'ticket' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'team' })).toHaveValue('general');
  });

  it('explains a stored document it cannot read instead of rendering half of it', async () => {
    // Built by hand: `createPrompt` refuses to make one, which is the point —
    // this row came from somewhere older or was edited outside the app.
    const broken = {
      ...promptFixture(documentWith({})),
      id: 'p-broken',
      content: 'a string is not a prompt document',
    } as unknown as Prompt;

    await openPlayground('/prompts/p-broken/playground', [broken]);

    expect(screen.getByText('The stored document cannot be read')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Rendered prompt text' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the editor' })).toHaveAttribute(
      'href',
      '/prompts/p-broken',
    );
  });

  it('offers a way back when the prompt is gone', async () => {
    await openPlayground('/prompts/missing/playground', []);

    expect(screen.getByText('This prompt is not in your library')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the library' })).toHaveAttribute(
      'href',
      '/library',
    );
  });

  it('shows what the screen does and does not do, and offers no execution', async () => {
    await openPlayground('/prompts/p-triage/playground');

    const scope = screen.getByRole('region', { name: /What this does/ });
    expect(
      within(scope).getByText(/There are no expressions, helpers, or loops/),
    ).toBeInTheDocument();
    expect(within(scope).getByText(/It does not call a model/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run|Execute|Send/ })).not.toBeInTheDocument();
    // "Save as test case" belongs to TASK-022 and must not be faked here.
    expect(screen.queryByRole('button', { name: /test case/i })).not.toBeInTheDocument();
  });
});
