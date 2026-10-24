import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import { createBlankDocument } from '@/domain/promptDocument';
import { createDefaultSettings, createPrompt, createRevision } from '@/domain/factories';
import type { Prompt, PromptRevision } from '@/domain/types';
import { usePreferencesStore } from '@/store/preferences';
import { useUiStore } from '@/store/uiStore';
import { renderAppWithData } from '@/test/renderAppWithData';

const COMPLETED_ONBOARDING = '2026-01-02T09:00:00.000Z';
const NOW = new Date('2026-10-24T09:00:00.000Z');

function documentWith(objective: string) {
  return createBlankDocument({
    name: 'Support triage',
    role: 'Support lead',
    objective,
    instructions: ['Read the ticket.', 'Return the classification.'],
    constraints: ['Never invent a value.'],
    variables: [{ name: 'ticket', type: 'string', required: true }],
    output: { format: 'json' },
  });
}

function promptFixture(objective: string): Prompt {
  return createPrompt(
    {
      title: 'Support triage',
      description: 'Classify inbound support mail.',
      content: documentWith(objective),
    },
    { now: () => NOW, newId: () => 'p-triage' },
  );
}

function revisionFixture(
  prompt: Prompt,
  revisionNumber: number,
  overrides: { id: string; kind?: PromptRevision['kind']; label?: string | null },
): PromptRevision {
  return createRevision(
    prompt,
    {
      revisionNumber,
      kind: overrides.kind ?? 'manual',
      label: overrides.label === undefined ? `Snapshot ${revisionNumber}` : overrides.label,
    },
    {
      now: () => new Date(Date.UTC(2026, 9, 1 + (revisionNumber % 28), 9)),
      newId: () => overrides.id,
    },
  );
}

// The stored prompt has moved on, so v1 is a genuinely *older* state: restoring
// it must change something, which is what the confirmation dialog is for.
const PROMPT = promptFixture('Sort the ticket into a queue.');
const OLDER = promptFixture('Read the ticket and answer it.');
const V1 = revisionFixture(OLDER, 1, { id: 'rev-1' });
const V2 = revisionFixture(OLDER, 2, { id: 'rev-2', label: 'Before rewriting' });
const V3 = revisionFixture(OLDER, 3, { id: 'rev-3', kind: 'restore-safety', label: null });

async function openHistory(
  options: {
    readonly prompts?: readonly Prompt[];
    readonly revisions?: readonly PromptRevision[];
    readonly path?: string;
  } = {},
) {
  const repositories = createInMemoryRepositories({
    prompts: [...(options.prompts ?? [PROMPT])],
    revisions: [...(options.revisions ?? [V1, V2, V3])],
    settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
  });

  const harness = renderAppWithData({
    repositories,
    path: options.path ?? '/prompts/p-triage/history',
    mode: 'durable',
  });
  await waitFor(() => expect(harness.store.getState().status).toBe('ready'));
  await screen.findByRole('heading', { level: 1, name: 'Version history', hidden: true });

  return { ...harness, repositories };
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

describe('version history', () => {
  it('lists snapshots newest first with kind and time, and selects the newest', async () => {
    await openHistory();

    const list = screen.getByRole('region', { name: 'Snapshots' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('v3');
    expect(rows[0]).toHaveTextContent('Safety snapshot');
    expect(rows[2]).toHaveTextContent('v1');

    expect(screen.getByRole('heading', { level: 2, name: 'Snapshot v3' })).toBeInTheDocument();
    expect(screen.getByText('3 snapshots')).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent('No label');
  });

  it('opens the selected snapshot in a read-only viewer from the query string', async () => {
    await openHistory({ path: '/prompts/p-triage/history?revision=rev-1' });

    const viewer = screen.getByRole('region', { name: 'Snapshot 1' });
    expect(within(viewer).getByText('Snapshot v1')).toBeInTheDocument();
    const editor = await within(viewer).findByRole('textbox', { name: /read-only/ });
    expect(editor).toHaveAttribute('contenteditable', 'false');
  });

  it('ignores a revision id that is not in this history', async () => {
    const { router } = await openHistory({ path: '/prompts/p-triage/history?revision=gone' });

    // The viewer falls back to the newest snapshot once the id is dropped.
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.getByRole('heading', { level: 2, name: 'Snapshot v3' })).toBeInTheDocument();
  });

  it('saves a labelled snapshot and toasts its number', async () => {
    const user = userEvent.setup();
    const { repositories } = await openHistory();

    await user.click(screen.getByRole('button', { name: 'Save snapshot' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save a snapshot' });
    await user.type(within(dialog).getByLabelText(/^Label/), 'Before the rewrite');
    await user.click(within(dialog).getByRole('button', { name: 'Save snapshot' }));

    expect(await screen.findByText('Snapshot v4 saved')).toBeInTheDocument();
    const stored = await repositories.revisions.listByPrompt('p-triage');
    expect(stored).toHaveLength(4);
    expect(stored.find((revision) => revision.revisionNumber === 4)?.label).toBe(
      'Before the rewrite',
    );
    expect(within(screen.getByRole('region', { name: 'Snapshots' })).getByText('v4')).toBeVisible();
  });

  it('restores an older snapshot and names the safety snapshot it created', async () => {
    const user = userEvent.setup();
    const { repositories, store } = await openHistory({
      path: '/prompts/p-triage/history?revision=rev-1',
    });

    await user.click(screen.getByRole('button', { name: /^Restore this snapshot/ }));
    const dialog = await screen.findByRole('dialog', { name: /Restore .*v1/ });
    await user.click(within(dialog).getByRole('button', { name: 'Restore and save v4 first' }));

    expect(await screen.findByText('Restored v1')).toBeInTheDocument();
    expect(screen.getByText('The state it replaced is saved as v4.')).toBeInTheDocument();

    const stored = await repositories.revisions.listByPrompt('p-triage');
    expect(stored).toHaveLength(4);
    expect(stored.find((revision) => revision.revisionNumber === 4)?.kind).toBe('restore-safety');
    expect(store.getState().prompts.find((prompt) => prompt.id === 'p-triage')?.version).toBe(
      PROMPT.version + 1,
    );
  });

  it('warns past the retention threshold and prunes only the oldest snapshots', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 26 }, (_, index) =>
      revisionFixture(PROMPT, index + 1, {
        id: `rev-${index + 1}`,
        label: `Snapshot ${index + 1}`,
      }),
    );
    const { repositories } = await openHistory({ revisions: many });

    expect(screen.getByText('26 snapshots on this prompt')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /Prune/ })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Prune old snapshots' });
    await user.selectOptions(within(dialog).getByLabelText(/^Snapshots to keep/), '25');
    await user.click(within(dialog).getByRole('button', { name: 'Remove 1' }));

    expect(await screen.findByText('Removed 1 snapshot')).toBeInTheDocument();
    const stored = await repositories.revisions.listByPrompt('p-triage');
    expect(stored).toHaveLength(25);
    expect(stored.some((revision) => revision.revisionNumber === 1)).toBe(false);
    expect(stored.some((revision) => revision.revisionNumber === 26)).toBe(true);
  });

  it('explains that autosave never creates snapshots when there are none', async () => {
    const user = userEvent.setup();
    const { repositories } = await openHistory({ revisions: [] });

    expect(screen.getByText('No snapshots yet')).toBeInTheDocument();
    expect(screen.getByText(/Autosave never adds one/)).toBeInTheDocument();
    expect(screen.queryByText(/snapshots on this prompt/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Save the first snapshot' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save a snapshot' });
    await user.click(within(dialog).getByRole('button', { name: 'Save snapshot' }));

    expect(await screen.findByText('Snapshot v1 saved')).toBeInTheDocument();
    expect(await repositories.revisions.listByPrompt('p-triage')).toHaveLength(1);
  });

  it('reports a prompt that is not in the library without breaking the route', async () => {
    await openHistory({ prompts: [], revisions: [], path: '/prompts/missing/history' });

    expect(screen.getByText('This prompt is not in your library')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save snapshot' })).toBeNull();
  });
});
