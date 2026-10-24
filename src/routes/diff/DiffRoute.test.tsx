import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import { createDefaultSettings, createPrompt, createRevision } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type { Prompt, PromptDocument, PromptRevision } from '@/domain/types';
import { usePreferencesStore } from '@/store/preferences';
import { useUiStore } from '@/store/uiStore';
import { renderAppWithData } from '@/test/renderAppWithData';

const COMPLETED_ONBOARDING = '2026-01-02T09:00:00.000Z';
const NOW = new Date('2026-10-24T09:00:00.000Z');

const writeText = vi.fn<(text: string) => Promise<void>>();

function documentWith(overrides: {
  readonly objective?: string;
  readonly instructions?: readonly string[];
  readonly tags?: readonly string[];
}): PromptDocument {
  return createBlankDocument({
    name: 'Support triage',
    role: 'Support lead',
    objective: overrides.objective ?? 'Sort the ticket into a queue.',
    instructions: overrides.instructions ?? ['Read the ticket.', 'Return the queue.'],
    constraints: ['Never invent a value.'],
    variables: [{ name: 'ticket', type: 'string', required: true }],
    output: { format: 'json' },
    metadata: { tags: [...(overrides.tags ?? ['support'])] },
  });
}

function promptFixture(content: PromptDocument): Prompt {
  return createPrompt(
    { title: 'Support triage', description: 'Classify inbound mail.', content },
    { now: () => NOW, newId: () => 'p-triage' },
  );
}

function revisionFixture(
  prompt: Prompt,
  revisionNumber: number,
  id: string,
  content: PromptDocument,
): PromptRevision {
  const base = createRevision(
    prompt,
    { revisionNumber, kind: 'manual', label: revisionNumber === 1 ? 'First draft' : null },
    { now: () => NOW, newId: () => id },
  );
  return { ...base, contentSnapshot: content };
}

const CURRENT = promptFixture(documentWith({}));
const OLDER = documentWith({
  objective: 'Read the ticket and answer it.',
  instructions: ['Read the ticket.', 'Answer politely.', 'Return the queue.'],
  tags: ['support', 'triage'],
});

const PROMPT = { ...CURRENT, content: documentWith({}) };
const V1 = revisionFixture(PROMPT, 1, 'rev-1', OLDER);
const V2 = revisionFixture(
  PROMPT,
  2,
  'rev-2',
  documentWith({ objective: 'Sort each ticket into two queues.' }),
);
// Byte-for-byte the stored document, so "identical" can be tested honestly.
const V3 = revisionFixture(PROMPT, 3, 'rev-3', documentWith({}));

async function openDiff(
  path: string,
  seed: { prompts?: readonly Prompt[]; revisions?: readonly PromptRevision[] } = {},
) {
  const repositories = createInMemoryRepositories({
    prompts: [...(seed.prompts ?? [PROMPT])],
    revisions: [...(seed.revisions ?? [V1, V2, V3])],
    settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
  });

  const harness = renderAppWithData({ repositories, path, mode: 'durable' });
  await waitFor(() => expect(harness.store.getState().status).toBe('ready'));
  await screen.findByRole('heading', { level: 1, name: 'Compare documents' });

  return { ...harness, repositories };
}

function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  return user;
}

function changes() {
  return within(screen.getByRole('list', { name: /^Changes between/ }));
}

beforeEach(() => {
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

describe('diff explorer', () => {
  it('compares the newest snapshot with the stored prompt from a prompt link', async () => {
    const { router } = await openDiff('/diff?prompt=p-triage');

    // The newest snapshot (v3) is byte-for-byte the stored document here.
    expect(screen.getByText('Identical')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Before source' })).toHaveValue('revision');
    expect(screen.getByRole('combobox', { name: 'After source' })).toHaveValue('prompt');
    expect(screen.getByRole('combobox', { name: 'Before snapshot' })).toHaveValue('rev-3');
    // The screen reads the URL, so the link keeps working after a reload.
    expect(router.state.location.search).toBe('?prompt=p-triage');
  });

  it('lists changes with paths, both values, and a selected change', async () => {
    await openDiff('/diff?left=revision:rev-1&right=prompt:p-triage');

    const list = screen.getByRole('list', { name: /^Changes between/ });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(0);

    // Instructions gained an element at index 1 and objective changed.
    expect(within(list).getByText('instructions[1]')).toBeInTheDocument();
    expect(within(list).getByText('objective')).toBeInTheDocument();
    expect(within(list).getByText('metadata.tags[1]')).toBeInTheDocument();

    const detail = screen.getByRole('region', { name: /objective/ });
    expect(within(detail).getByText(/Read the ticket and answer it\./)).toBeInTheDocument();
    expect(within(detail).getByText(/Sort the ticket into a queue\./)).toBeInTheDocument();
    expect(within(detail).getByText('/objective')).toBeInTheDocument();
  });

  it('moves between changes from the keyboard and follows the selection', async () => {
    const user = setupUser();
    await openDiff('/diff?left=revision:rev-1&right=prompt:p-triage');

    const first = changes().getAllByRole('button')[0];
    first?.focus();

    await user.keyboard('{ArrowDown}');

    const selected = screen
      .getAllByRole('button', { pressed: true })
      .find((button) => button.closest('ul'));
    expect(selected).toHaveTextContent('instructions[1]');
    expect(screen.getByText('Change 2 of', { exact: false })).toBeInTheDocument();

    await user.keyboard('{End}');
    expect(screen.getByText(/Change \d+ of \d+$/)).toBeInTheDocument();
  });

  it('filters by change type and copies exactly what is shown', async () => {
    const user = setupUser();
    await openDiff('/diff?left=revision:rev-1&right=prompt:p-triage');

    const total = changes().getAllByRole('listitem').length;
    expect(total).toBe(3);
    await user.click(screen.getByRole('button', { name: 'Removed: 2' }));

    const shown = changes().getAllByRole('listitem').length;
    expect(shown).toBe(2);
    expect(changes().queryByText('objective')).toBeNull();

    await user.click(screen.getByRole('button', { name: /^Copy \d+ shown changes? as JSON$/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const payload = JSON.parse(writeText.mock.calls[0]?.[0] ?? '{}') as {
      summary: { total: number };
      filter: string;
      changes: { kind: string }[];
    };
    expect(payload.summary.total).toBe(shown);
    expect(payload.changes.every((change) => change.kind === 'removed')).toBe(true);
    expect(payload.filter).toContain('Filtered view');
    expect(await screen.findByText('Comparison copied')).toBeInTheDocument();
  });

  it('copies the whole comparison when no filter is active', async () => {
    const user = setupUser();
    await openDiff('/diff?left=revision:rev-1&right=prompt:p-triage');

    await user.click(screen.getByRole('button', { name: /^Copy all \d+ changes? as JSON$/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const payload = JSON.parse(writeText.mock.calls[0]?.[0] ?? '{}') as {
      before: string;
      after: string;
      filter?: string;
      changes: { pointer: string }[];
    };
    expect(payload.before).toBe('Support triage · v1 · First draft');
    expect(payload.after).toBe('Support triage');
    expect(payload.filter).toBeUndefined();
    expect(payload.changes.map((change) => change.pointer)).toContain('/instructions/1');
  });

  it('says there are no differences instead of failing', async () => {
    await openDiff('/diff?left=revision:rev-3&right=prompt:p-triage');

    expect(screen.getByText('No differences')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /^Changes between/ })).toBeNull();
    expect(screen.getByText('Identical')).toBeInTheDocument();
  });

  it('switches between unified and split and can show full values', async () => {
    const user = setupUser();
    await openDiff('/diff?left=revision:rev-1&right=prompt:p-triage');

    await user.click(screen.getByRole('button', { name: 'Split' }));
    expect(screen.getByRole('button', { name: 'Split' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(/^Before · Support triage · v1/).length).toBeGreaterThan(0);

    const fullValues = screen.getByRole('checkbox', { name: /Full values/ });
    expect(fullValues).not.toBeChecked();
    await user.click(fullValues);
    expect(fullValues).toHaveAttribute('data-state', 'checked');
  });

  it('disables a filter that has nothing to show, instead of hiding it', async () => {
    await openDiff('/diff?left=revision:rev-1&right=prompt:p-triage');

    // This comparison has no re-ordered arrays and no additions, so those
    // controls are present and disabled rather than vanishing and shifting the
    // row every time the counts change.
    expect(screen.getByRole('button', { name: 'Re-ordered: 0' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Added: 0' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Removed: 2' })).toBeEnabled();
  });

  it('compares pasted JSON without storing it and reports a parse failure in place', async () => {
    const user = setupUser();
    await openDiff('/diff?left=text&right=prompt:p-triage');

    expect(screen.getByText('Two sides are needed')).toBeInTheDocument();
    expect(screen.getByText(/not part of the URL/)).toBeInTheDocument();

    const beforeJson = screen.getByRole('textbox', { name: /^Before JSON/ });
    await user.click(beforeJson);
    await user.paste('{{');
    expect(await screen.findByText('The comparison is paused')).toBeInTheDocument();

    await user.clear(beforeJson);
    await user.click(beforeJson);
    await user.paste('{"name":"Support triage"}');
    expect(await screen.findByRole('list', { name: /^Changes between/ })).toBeInTheDocument();
  });

  it('never puts pasted JSON into the URL', async () => {
    const user = setupUser();
    const { router } = await openDiff('/diff?left=text&right=prompt:p-triage');

    const beforeJson = screen.getByRole('textbox', { name: /^Before JSON/ });
    await user.click(beforeJson);
    await user.paste('{"objective":"Secret"}');

    expect(router.state.location.search).toBe('?left=text&right=prompt:p-triage');
    expect(router.state.location.search).not.toContain('Secret');
  });

  it('explains a snapshot that is no longer stored', async () => {
    await openDiff('/diff?left=revision:rev-gone&right=prompt:p-triage');

    expect(screen.getByText('The Before side cannot be shown')).toBeInTheDocument();
    expect(screen.getByText(/no longer stored/)).toBeInTheDocument();
  });

  it('survives a library without prompts by asking for two sides', async () => {
    await openDiff('/diff', { prompts: [], revisions: [] });

    expect(screen.getByText('Two sides are needed')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Before source' })).toHaveValue('text');
    expect(screen.getByRole('combobox', { name: 'After source' })).toHaveValue('text');
  });

  it('swaps the two sides and keeps both in the URL', async () => {
    const user = setupUser();
    const { router } = await openDiff('/diff?left=revision:rev-1&right=prompt:p-triage');

    await user.click(screen.getByRole('button', { name: 'Swap sides' }));

    await waitFor(() =>
      expect(router.state.location.search).toBe('?left=prompt%3Ap-triage&right=revision%3Arev-1'),
    );
    expect(screen.getByRole('combobox', { name: 'Before source' })).toHaveValue('prompt');
    expect(screen.getByRole('combobox', { name: 'After source' })).toHaveValue('revision');
  });
});
