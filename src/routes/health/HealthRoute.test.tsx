import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryRepositories, type Repositories } from '@/data';
import {
  createActivityEvent,
  createCollection,
  createDefaultSettings,
  createFolder,
  createPrompt,
  createRevision,
  type DomainDependencies,
} from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type {
  ActivityEvent,
  Collection,
  Folder,
  Prompt,
  PromptDocument,
  PromptRevision,
  PromptSchema,
  Settings,
} from '@/domain/types';
import { DEFAULT_HEALTH_THRESHOLDS } from '@/domain/health';
import { renderAppWithData } from '@/test/renderAppWithData';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useUiStore } from '@/store/uiStore';

/**
 * Health dashboard integration tests (TASK-025).
 *
 * The real shell, router, store, and in-memory repositories are used, with seed
 * data skipped so each test owns its library. Records are written through the
 * repository layer — the screen is never handed a report object — so every
 * figure has travelled the path a real record does.
 */

const NOW = new Date('2026-10-25T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const COMPLETED_ONBOARDING = '2026-01-02T09:00:00.000Z';

let sequence = 0;

function deps(now: string): DomainDependencies {
  return {
    now: () => new Date(now),
    newId: () => `fixture-${String(++sequence).padStart(3, '0')}`,
  };
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

interface PromptOptions {
  readonly title: string;
  readonly description?: string;
  readonly archived?: boolean;
  readonly updatedAt?: string;
  readonly content?: PromptDocument;
  readonly collectionIds?: readonly string[];
  readonly folderId?: string;
  readonly schemaId?: string;
}

function prompt(options: PromptOptions): Prompt {
  return createPrompt(
    {
      title: options.title,
      description: options.description ?? `${options.title} description`,
      ...(options.content ? { content: options.content } : {}),
      ...(options.collectionIds ? { collectionIds: options.collectionIds } : {}),
      ...(options.folderId ? { folderId: options.folderId } : {}),
      ...(options.schemaId ? { schemaId: options.schemaId } : {}),
      archived: options.archived ?? false,
    },
    deps(options.updatedAt ?? daysAgo(1)),
  );
}

function broken(title: string, updatedAt = daysAgo(2)): Prompt {
  const base = prompt({ title, updatedAt });
  return { ...base, content: { schemaVersion: 'broken' } as unknown as PromptDocument };
}

function events(count: number): ActivityEvent[] {
  return Array.from({ length: count }, (_, index) =>
    createActivityEvent(
      {
        type: index % 2 === 0 ? 'created' : 'updated',
        summary: `Event ${index}`,
        promptId: `prompt-${index}`,
        promptTitle: `Prompt ${index}`,
      },
      deps(new Date(NOW.getTime() - index * 60 * 60 * 1000).toISOString()),
    ),
  );
}

interface HarnessOptions {
  readonly prompts?: readonly Prompt[];
  readonly collections?: readonly Collection[];
  readonly folders?: readonly Folder[];
  readonly revisions?: readonly PromptRevision[];
  readonly schemas?: readonly PromptSchema[];
  readonly activity?: readonly ActivityEvent[];
  readonly settings?: Settings | null;
  readonly repositories?: Repositories;
}

function renderHealth(options: HarnessOptions = {}) {
  const repositories =
    options.repositories ??
    createInMemoryRepositories({
      prompts: options.prompts ?? [],
      collections: options.collections ?? [],
      folders: options.folders ?? [],
      revisions: options.revisions ?? [],
      schemas: options.schemas ?? [],
      activity: options.activity ?? [],
      settings:
        options.settings === undefined
          ? { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING }
          : options.settings,
    });

  return {
    ...renderAppWithData({ repositories, path: '/health' }),
    repositories,
  };
}

async function openHealth(options: HarnessOptions = {}) {
  const harness = renderHealth(options);
  await screen.findByRole('heading', { level: 1, name: 'Health' });
  return harness;
}

function section(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing section #${id}`);
  return element;
}

beforeEach(() => {
  sequence = 0;
  useUiStore.setState({
    sidebarOpen: true,
    rightPanel: 'none',
    paletteOpen: false,
    helpOpen: false,
    recentCommandIds: [],
    selectedPromptId: null,
    selectedPromptIds: [],
  });
  usePreferencesStore.setState({ healthThresholds: DEFAULT_HEALTH_THRESHOLDS });
});

describe('health route summary', () => {
  it('renders the totals from stored records and links each metric to a real view', async () => {
    const collection = createCollection({ name: 'Support' }, deps(daysAgo(5)));
    await openHealth({
      prompts: [
        prompt({ title: 'Support triage', collectionIds: [collection.id] }),
        prompt({ title: 'Set aside', archived: true }),
      ],
      collections: [collection],
    });

    expect(screen.getByText('2 stored in total')).toBeVisible();
    expect(screen.getByText('outside the working set')).toBeVisible();

    expect(screen.getByRole('link', { name: /Active prompts/ })).toHaveAttribute(
      'href',
      '/library',
    );
    expect(screen.getByRole('link', { name: /Archived/ })).toHaveAttribute(
      'href',
      '/library?filter=archived',
    );
    expect(screen.getByRole('link', { name: /Will not parse/ })).toHaveAttribute(
      'href',
      '/library?validation=unparsable',
    );
    expect(screen.getByRole('link', { name: /Fail their schema/ })).toHaveAttribute(
      'href',
      '/validation',
    );

    // Metrics with no exact filter are not links, so nothing looks clickable.
    expect(screen.queryByRole('link', { name: /Undeclared variables/ })).toBeNull();
  });

  it('states the thresholds it used and where to change them', async () => {
    await openHealth();

    expect(screen.getByText(/Stale after/)).toHaveTextContent('30 / 60 / 90 days');
    expect(screen.getByRole('link', { name: '30 / 60 / 90 days' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('uses the stored thresholds rather than a hard-coded number', async () => {
    await openHealth({
      prompts: [prompt({ title: 'Quiet', updatedAt: daysAgo(10) })],
      settings: {
        ...createDefaultSettings(),
        onboardedAt: COMPLETED_ONBOARDING,
        healthThresholds: { attentionDays: 7, staleDays: 14, dormantDays: 21 },
      },
    });

    expect(screen.getByText('7 / 14 / 21 days')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Untouched for 7 days' })).toBeVisible();
    expect(
      within(section('health-stale-attention')).getByRole('link', { name: /Quiet/ }),
    ).toHaveAttribute('href', expect.stringContaining('/prompts/'));
  });

  it('writes the one-line summary from the same numbers the cards show', async () => {
    await openHealth({ prompts: [broken('Corrupt')] });

    expect(
      screen.getByText(/1 stored document will not parse\. Everything else here describes/),
    ).toBeVisible();
  });
});

describe('health route attention lists', () => {
  it('links every broken document to the exact prompt and filters the library', async () => {
    const corrupt = broken('Corrupt');
    await openHealth({ prompts: [corrupt, prompt({ title: 'Fine' })] });

    const list = section('health-invalid');
    expect(
      within(list).getByRole('heading', { name: 'Documents that will not parse (1)' }),
    ).toBeVisible();

    const row = within(list).getByRole('link', { name: /Corrupt/ });
    expect(row).toHaveAttribute('href', `/prompts/${corrupt.id}`);

    expect(within(list).getByRole('link', { name: /Filter the library/ })).toHaveAttribute(
      'href',
      '/library?validation=unparsable',
    );
  });

  it('keeps archived prompts out of the attention lists but in the total', async () => {
    await openHealth({
      prompts: [broken('Archived mess', daysAgo(3))].map((item) => ({ ...item, archived: true })),
    });

    const list = section('health-invalid');
    expect(within(list).getByText('Every stored document parses')).toBeVisible();
    expect(screen.getByText('1 stored in total')).toBeVisible();
  });

  it('lists undeclared variables with the names behind the count', async () => {
    const document = createBlankDocument({
      name: 'Needs inputs',
      instructions: ['Address {{audience}} about {{topic}}.'],
      variables: [{ name: 'audience', type: 'string', required: true }],
    });

    await openHealth({ prompts: [prompt({ title: 'Needs inputs', content: document })] });

    const list = section('health-variables');
    expect(within(list).getByRole('link', { name: /Needs inputs/ })).toBeVisible();
    expect(within(list).getByText(/Not declared: topic/)).toBeVisible();
  });
});

describe('health route distribution', () => {
  it('renders real counts as bars, a table, and links into the filtered library', async () => {
    const support = createCollection({ name: 'Support' }, deps(daysAgo(5)));
    const research = createCollection({ name: 'Research' }, deps(daysAgo(5)));

    await openHealth({
      collections: [support, research],
      prompts: [
        prompt({ title: 'One', collectionIds: [support.id] }),
        prompt({ title: 'Two', collectionIds: [support.id] }),
        prompt({ title: 'Three', collectionIds: [research.id] }),
        prompt({ title: 'Loose' }),
      ],
    });

    const list = section('health-collections');
    const table = within(list).getByRole('table');
    expect(within(table).getByRole('rowheader', { name: 'Support' })).toBeVisible();
    expect(within(table).getByRole('cell', { name: '2' })).toBeVisible();
    expect(within(table).getByRole('cell', { name: '1' })).toBeVisible();

    expect(within(list).getByRole('link', { name: /1 not in a collection/ })).toHaveAttribute(
      'href',
      '/library',
    );
    expect(within(list).getAllByRole('link', { name: 'Support' })[0]).toHaveAttribute(
      'href',
      `/library?collection=${support.id}`,
    );
  });

  it('groups prompts by folder and counts the unfiled ones', async () => {
    const folder = createFolder({ name: 'Compliance' }, deps(daysAgo(5)));

    await openHealth({
      folders: [folder],
      prompts: [prompt({ title: 'Filed', folderId: folder.id }), prompt({ title: 'Unfiled' })],
    });

    const list = section('health-folders');
    expect(within(list).getByRole('link', { name: 'Compliance' })).toHaveAttribute(
      'href',
      `/library?folder=${folder.id}`,
    );
    expect(within(list).getByRole('link', { name: /1 unfiled prompts/ })).toHaveAttribute(
      'href',
      '/library?folder=unfiled',
    );
  });

  it('says so plainly when there is nothing to distribute', async () => {
    await openHealth();

    expect(
      within(section('health-collections')).getByText('No collections hold prompts'),
    ).toBeVisible();
    expect(within(section('health-folders')).getByText('No folders hold prompts')).toBeVisible();
  });
});

describe('health route history and activity', () => {
  it('counts revisions and shows the newest revision timestamp', async () => {
    const record = prompt({ title: 'History' });
    const revision = createRevision(
      record,
      { revisionNumber: 1, kind: 'manual' },
      deps('2026-10-20T09:00:00.000Z'),
    );

    await openHealth({ prompts: [record], revisions: [revision] });

    expect(screen.getByText('1 prompt has history')).toBeVisible();
    expect(screen.getByText(/Newest revision/)).toHaveTextContent('20 Oct 2026, 09:00');
  });

  it('pages the timeline without repeating an event, and filters by type', async () => {
    const user = userEvent.setup();
    await openHealth({ activity: events(45) });

    const timeline = section('health-activity');
    expect(within(timeline).getByText(/Showing the 20 most recent of 45 events/)).toBeVisible();
    expect(within(timeline).getAllByText(/^Event \d+$/)).toHaveLength(20);

    await user.click(within(timeline).getByRole('button', { name: /Load 20 older/ }));

    expect(within(timeline).getByText(/Showing the 40 most recent of 45 events/)).toBeVisible();
    const summaries = within(timeline)
      .getAllByText(/^Event \d+$/)
      .map((node) => node.textContent);
    expect(summaries).toHaveLength(40);
    expect(new Set(summaries).size).toBe(40);

    await user.selectOptions(within(timeline).getByLabelText('Event type'), 'created');

    // The filter resets paging, so the first page of the filtered list is shown.
    expect(within(timeline).getByText(/Showing the 20 most recent of 23 events/)).toBeVisible();
    expect(within(timeline).getByText(/A new prompt was added/)).toBeVisible();
    expect(within(timeline).queryByText(/^Event 1$/)).toBeNull();
  });

  it('links an event to the prompt it names and says when none is attached', async () => {
    await openHealth({
      activity: [
        createActivityEvent(
          { type: 'updated', summary: 'Edited one', promptId: 'prompt-1', promptTitle: 'One' },
          deps(daysAgo(1)),
        ),
        createActivityEvent({ type: 'settings', summary: 'Saved preferences' }, deps(daysAgo(2))),
      ],
    });

    const timeline = section('health-activity');
    expect(within(timeline).getByRole('link', { name: 'Open One' })).toHaveAttribute(
      'href',
      '/prompts/prompt-1',
    );
    expect(within(timeline).getByText('No prompt attached')).toBeVisible();
  });

  it('shows an honest empty timeline on a fresh library', async () => {
    await openHealth();

    const timeline = section('health-activity');
    expect(within(timeline).getByText('No activity recorded yet')).toBeVisible();
    expect(within(timeline).getByRole('link', { name: 'Create a prompt' })).toHaveAttribute(
      'href',
      '/composer',
    );
  });
});

describe('health route definitions and storage', () => {
  it('defines every metric and prints the measured timestamps', async () => {
    await openHealth({ prompts: [prompt({ title: 'Fresh', updatedAt: daysAgo(2) })] });

    const definitions = section('health-definitions');
    expect(within(definitions).getByText('Will not parse')).toBeVisible();
    expect(within(definitions).getByText(/capped at the 500 most recent/)).toBeVisible();
    expect(within(definitions).getByText(/Archived prompts/)).toBeVisible();
    expect(within(definitions).getByText('Oldest edit')).toBeVisible();
  });

  it('states that this browser does not report storage instead of inventing a number', async () => {
    await openHealth();

    expect(await screen.findByText(/This browser does not report storage usage/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Storage' })).toBeVisible();
  });

  it('recomputes without changing the records it read', async () => {
    const user = userEvent.setup();
    const { repositories } = await openHealth({
      prompts: [prompt({ title: 'Stable' }), broken('Corrupt')],
    });

    await user.click(screen.getByRole('button', { name: /Recompute/ }));

    expect(screen.getByRole('heading', { name: 'Health' })).toBeVisible();
    await expect(repositories.prompts.list()).resolves.toHaveLength(2);
  });
});
