import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import {
  createDefaultSettings,
  createPrompt,
  createPromptSchema,
  createRevision,
  createTestCase,
} from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type {
  Prompt,
  PromptDocument,
  PromptRevision,
  PromptSchema,
  TestCase,
} from '@/domain/types';
import { readPlaygroundValues, writePlaygroundValues } from '@/features/playground/valuesStorage';
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
      { name: 'team', type: 'string', required: false, defaultValue: 'general' },
    ],
    output: { format: 'text' },
  });
}

function promptFixture(content: PromptDocument, id = 'p-triage'): Prompt {
  return createPrompt(
    { title: 'Support triage', description: 'Classify inbound mail.', content },
    { now: () => NOW, newId: () => id },
  );
}

function caseFixture(
  promptId: string,
  name: string,
  inputValues: Record<string, string | number | boolean>,
  id: string,
): ReturnType<typeof createTestCase> {
  return createTestCase(
    { promptId, name, inputValues, expectedStructure: null },
    { now: () => NOW, newId: () => id },
  );
}

async function openLab(
  path: string,
  seed: {
    readonly prompts?: readonly Prompt[];
    readonly testCases?: readonly TestCase[];
    readonly schemas?: readonly PromptSchema[];
    readonly revisions?: readonly PromptRevision[];
  } = {},
) {
  const repositories = createInMemoryRepositories({
    prompts: [...(seed.prompts ?? [promptFixture(documentWith({}))])],
    testCases: [...(seed.testCases ?? [])],
    schemas: [...(seed.schemas ?? [])],
    revisions: [...(seed.revisions ?? [])],
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

function resultsCard(): HTMLElement {
  const heading = screen.getByRole('heading', { name: 'Results', level: 2 });
  const card = heading.closest('div')?.parentElement;
  if (!card) throw new Error('Results card not found');
  return card;
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
  vi.unstubAllGlobals();
});

describe('laboratory route', () => {
  it('states the scope of a run permanently and never implies a model answered', async () => {
    await openLab('/prompts/p-triage/lab');

    expect(screen.getByRole('heading', { name: 'Laboratory', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Local rendering only')).toBeInTheDocument();
    expect(
      screen.getByText(/No AI model provider is connected; PromptForge does not execute prompts/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/model output/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\btokens\b/i)).not.toBeInTheDocument();
  });

  it('says when there is nothing saved to run', async () => {
    await openLab('/prompts/p-triage/lab');

    expect(screen.getByText('No saved test cases yet')).toBeInTheDocument();
    expect(screen.getByText(/Nothing has been run yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run all cases/ })).toBeDisabled();
  });

  it('explains a stored prompt that cannot be read instead of rendering part of it', async () => {
    const valid = promptFixture(documentWith({}));
    const broken = {
      ...valid,
      id: 'p-broken',
      content: 'not a prompt document',
    } as unknown as Prompt;

    await openLab('/prompts/p-broken/lab', { prompts: [broken] });

    expect(screen.getByText('This version cannot be rendered')).toBeInTheDocument();
    expect(screen.getByText(/does not pass its own shape checks/)).toBeInTheDocument();
  });

  it('saves a case through the form and keeps it after a reload', async () => {
    const user = setupUser();
    const harness = await openLab('/prompts/p-triage/lab');

    await user.click(screen.getAllByRole('button', { name: 'New test case' })[0]!);
    await user.type(screen.getByLabelText(/^Case name/), 'Billing');
    await user.type(screen.getByLabelText(/^ticket/), 'Billing');
    await user.click(screen.getByRole('button', { name: 'Save test case' }));

    const items = await screen.findAllByText('Billing');
    expect(items.length).toBeGreaterThan(0);
    expect(screen.getByText(/Saved the test case/)).toBeInTheDocument();

    const stored = await harness.repositories.testCases.list();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ promptId: 'p-triage', name: 'Billing' });
    // The blank `team` field was not stored as an empty answer.
    expect(stored[0]?.inputValues).toEqual({ ticket: 'Billing' });

    // A fresh mount reads the same repository, so the case is still there.
    harness.unmount();
    const reopened = renderAppWithData({
      repositories: harness.repositories,
      path: '/prompts/p-triage/lab',
      mode: 'durable',
    });
    await waitFor(() => expect(reopened.store.getState().status).toBe('ready'));
    expect((await screen.findAllByText('Billing')).length).toBeGreaterThan(0);
  });

  it('blocks a run with an incomplete case and separates where each problem came from', async () => {
    const user = setupUser();
    await openLab('/prompts/p-triage/lab', {
      testCases: [caseFixture('p-triage', 'Incomplete', {}, 'c-1')],
    });

    await user.click(screen.getByRole('button', { name: /^Run all cases/ }));

    const card = await waitFor(() => resultsCard());
    const results = within(card);

    expect(results.getByText('Blocked')).toBeInTheDocument();
    expect(results.getByText('1 problem blocked this run.')).toBeInTheDocument();
    expect(results.getByText('Inputs problems')).toBeInTheDocument();
    expect(results.queryByText('Document problems')).not.toBeInTheDocument();
    expect(
      results.getByText('“ticket” is required and this case has no value for it.'),
    ).toBeInTheDocument();
    expect(results.getByText(/Nothing was rendered/)).toBeInTheDocument();
  });

  it('renders a complete case, counts characters, and labels them as characters', async () => {
    const user = setupUser();
    await openLab('/prompts/p-triage/lab', {
      testCases: [caseFixture('p-triage', 'Billing', { ticket: 'Billing' }, 'c-1')],
    });

    await user.click(screen.getByRole('button', { name: /^Run all cases/ }));

    const card = await waitFor(() => resultsCard());
    const results = within(card);

    expect(results.getByText('Rendered')).toBeInTheDocument();
    expect(results.getByText('Characters')).toBeInTheDocument();
    expect(results.getByText(/Queue the Billing for general\./)).toBeInTheDocument();
    expect(results.queryByText(/token/i)).not.toBeInTheDocument();
    expect(results.getByText(/rendered prompts, not model output/)).toBeInTheDocument();
  });

  it('compares two runs line by line and reports identical variants as identical', async () => {
    const user = setupUser();
    await openLab('/prompts/p-triage/lab', {
      testCases: [
        caseFixture('p-triage', 'Billing', { ticket: 'Billing' }, 'c-1'),
        caseFixture('p-triage', 'Refund', { ticket: 'Refund' }, 'c-2'),
      ],
    });

    await user.click(screen.getByRole('button', { name: /^Run all cases/ }));
    await screen.findByText('1 line added, 1 line removed.');

    expect(screen.getByText('−1')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText(/Before: Billing/)).toBeInTheDocument();
    expect(screen.getByText(/After: Refund/)).toBeInTheDocument();
    expect(screen.getAllByText(/Queue the (Billing|Refund) for general\./).length).toBeGreaterThan(
      2,
    );
  });

  it('reports identical rendered variants instead of inventing a difference', async () => {
    const user = setupUser();
    await openLab('/prompts/p-triage/lab', {
      testCases: [
        caseFixture('p-triage', 'First', { ticket: 'Billing' }, 'c-1'),
        caseFixture('p-triage', 'Second', { ticket: 'Billing' }, 'c-2'),
      ],
    });

    await user.click(screen.getByRole('button', { name: /^Run all cases/ }));

    expect(await screen.findByText('The two rendered variants are identical.')).toBeInTheDocument();
    expect(screen.getByText('Identical')).toBeInTheDocument();
    expect(screen.getByText(/Nothing was substituted differently/)).toBeInTheDocument();
  });

  it('does not touch the network while a run happens', async () => {
    const user = setupUser();
    const fetchSpy = vi.fn(() => {
      throw new Error('A laboratory run must not make a network request.');
    });
    vi.stubGlobal('fetch', fetchSpy);

    await openLab('/prompts/p-triage/lab', {
      testCases: [caseFixture('p-triage', 'Billing', { ticket: 'Billing' }, 'c-1')],
    });

    await user.click(screen.getByRole('button', { name: /^Run all cases/ }));
    await screen.findByText('Rendered');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
  });

  it('loads a case into the playground for this tab', async () => {
    const user = setupUser();
    await openLab('/prompts/p-triage/lab', {
      testCases: [caseFixture('p-triage', 'Billing', { ticket: 'Billing' }, 'c-1')],
    });

    await user.click(screen.getByRole('button', { name: /Open in playground/ }));

    await screen.findByRole('heading', { name: 'Playground', level: 1 });
    expect(readPlaygroundValues('p-triage', sessionStorage)?.values).toEqual({
      ticket: 'Billing',
    });
  });

  it('offers this tab’s playground inputs when a case is created from the playground', async () => {
    writePlaygroundValues('p-triage', { ticket: 'From the playground' }, sessionStorage);

    await openLab('/prompts/p-triage/lab?new=1&from=playground');

    expect(await screen.findByRole('heading', { name: 'New test case' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText(/^ticket/)).toHaveValue('From the playground'),
    );
  });

  it('renames a case and rejects a duplicate name with a reason', async () => {
    const user = setupUser();
    await openLab('/prompts/p-triage/lab', {
      testCases: [
        caseFixture('p-triage', 'Billing', { ticket: 'Billing' }, 'c-1'),
        caseFixture('p-triage', 'Refund', { ticket: 'Refund' }, 'c-2'),
      ],
    });

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!);
    const name = screen.getByLabelText(/^Case name/);
    await user.clear(name);
    await user.type(name, 'Refund');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/already used by another case/)).toBeInTheDocument();

    await user.clear(name);
    await user.type(name, 'Billing refund');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Saved “Billing refund”/)).toBeInTheDocument();
  });

  it('saves, runs, and compares without ever leaving the browser', async () => {
    const user = setupUser();
    await openLab('/prompts/p-triage/lab');

    // Save the first case through the form.
    await user.click(screen.getAllByRole('button', { name: 'New test case' })[0]!);
    await user.type(screen.getByLabelText(/^Case name/), 'Billing');
    await user.type(screen.getByLabelText(/^ticket/), 'Billing');
    await user.click(screen.getByRole('button', { name: 'Save test case' }));
    await screen.findAllByText('Billing');

    // Duplicate it, then change the copy's value so the renders differ.
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect((await screen.findAllByText('Billing (copy)')).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!);
    const ticket = screen.getByLabelText(/^ticket/);
    await user.clear(ticket);
    await user.type(ticket, 'Refund');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findAllByText('Billing (copy)');

    await user.click(screen.getByRole('button', { name: /^Run all cases/ }));
    expect(await screen.findByText('1 line added, 1 line removed.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy comparison' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]?.[0]).toContain('Rendered comparison');
    const copied = writeText.mock.calls[0]?.[0] ?? '';
    expect(copied).toContain('Queue the Refund for general.');
    expect(copied).toContain('Queue the Billing for general.');
    expect(copied).toMatch(/(?:^|\n)[+-] Queue the /);
  });

  it('asks before deleting a case and leaves the prompt alone', async () => {
    const user = setupUser();
    const harness = await openLab('/prompts/p-triage/lab', {
      testCases: [caseFixture('p-triage', 'Billing', { ticket: 'Billing' }, 'c-1')],
    });

    await user.click(screen.getByRole('button', { name: /Delete the “Billing” test case/ }));

    expect(await screen.findByText(/This cannot be undone/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete the case' }));

    await waitFor(() => expect(screen.queryByText('Billing')).not.toBeInTheDocument());
    await expect(harness.repositories.testCases.list()).resolves.toEqual([]);
    expect(harness.store.getState().prompts).toHaveLength(1);
  });

  it('runs a snapshot instead of the stored prompt when one is chosen', async () => {
    const user = setupUser();
    const current = promptFixture(documentWith({ objective: 'Current wording for {{ticket}}.' }));
    const revision = createRevision(
      promptFixture(documentWith({ objective: 'Snapshot wording for {{ticket}}.' })),
      { revisionNumber: 1, kind: 'manual', label: 'First draft' },
      { now: () => NOW, newId: () => 'r-1' },
    );

    await openLab('/prompts/p-triage/lab', {
      prompts: [current],
      revisions: [{ ...revision, promptId: current.id }],
      testCases: [caseFixture('p-triage', 'Billing', { ticket: 'Billing' }, 'c-1')],
    });

    await user.selectOptions(screen.getByLabelText('Prompt version to render'), 'r-1');
    await user.click(screen.getByRole('button', { name: /^Run all cases/ }));

    const card = await waitFor(() => resultsCard());
    expect(within(card).getByText(/Snapshot wording for Billing\./)).toBeInTheDocument();
  });

  it('blocks on the attached prompt schema and names the document category', async () => {
    const user = setupUser();
    const schema = createPromptSchema(
      {
        name: 'Requires an audience',
        schemaContent: { type: 'object', required: ['audience'] },
      },
      { now: () => NOW, newId: () => 's-1' },
    );
    const prompt = { ...promptFixture(documentWith({})), schemaId: 's-1' };

    await openLab('/prompts/p-triage/lab', {
      prompts: [prompt],
      schemas: [schema],
      testCases: [caseFixture('p-triage', 'Billing', { ticket: 'Billing' }, 'c-1')],
    });

    await user.click(screen.getByRole('button', { name: /^Run all cases/ }));

    const card = await waitFor(() => resultsCard());
    const results = within(card);
    expect(results.getByText('Blocked')).toBeInTheDocument();
    expect(results.getByText('Document problems')).toBeInTheDocument();
    expect(results.getAllByText(/audience/).length).toBeGreaterThan(0);
  });

  it('checks an expected structure against the rendered text', async () => {
    const user = setupUser();
    const schema = createPromptSchema(
      {
        name: 'Verdict object',
        schemaContent: { type: 'object', required: ['verdict'] },
      },
      { now: () => NOW, newId: () => 's-1' },
    );
    const testCase = {
      ...caseFixture('p-triage', 'Billing', { ticket: 'Billing' }, 'c-1'),
      expectedStructure: 's-1',
    };

    await openLab('/prompts/p-triage/lab', {
      schemas: [schema],
      testCases: [testCase],
    });

    await user.click(screen.getByRole('button', { name: /^Run all cases/ }));

    const card = await waitFor(() => resultsCard());
    const results = within(card);
    expect(results.getByText('Rendered text is not JSON')).toBeInTheDocument();
    expect(results.getByText(/line 1/)).toBeInTheDocument();
  });

  it('explains a prompt that is not in the library', async () => {
    await openLab('/prompts/missing/lab');

    expect(screen.getByText('This prompt is not in your library')).toBeInTheDocument();
  });

  it('sends a first-time visitor back to the library rather than showing an empty shell', async () => {
    const user = setupUser();
    const harness = await openLab('/prompts/p-triage/lab');

    await act(async () => {
      await harness.router.navigate('/prompts/missing/lab');
    });

    await user.click(screen.getByRole('link', { name: 'Go to the library' }));
    expect(harness.router.state.location.pathname).toBe('/library');
  });
});
