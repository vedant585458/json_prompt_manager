import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryRepositories, type Repositories } from '@/data';
import {
  createActivityEvent,
  createCollection,
  createDefaultSettings,
  createPrompt,
  createTemplate,
  type DomainDependencies,
} from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type {
  ActivityEvent,
  Collection,
  Prompt,
  PromptDocument,
  PromptRevision,
  PromptTemplate,
  Settings,
} from '@/domain/types';
import { renderAppWithData } from '@/test/renderAppWithData';
import { useUiStore } from '@/store/uiStore';

/**
 * Dashboard integration tests (TASK-010).
 *
 * These render the real shell, route table, data store, and in-memory
 * repositories — the dashboard is never handed a fixture object. Records are
 * written through the repository layer first, so every number on screen has
 * travelled the same path a real record does. Only the storage adapter and the
 * seed are injected; boot is exercised for real in `dataBoot.test.ts`.
 */

const COMPLETED_ONBOARDING = '2026-01-02T09:00:00.000Z';

let sequence = 0;

function deps(now = '2026-10-24T09:00:00.000Z'): DomainDependencies {
  return { now: () => new Date(now), newId: () => `fixture-${++sequence}` };
}

function prompt(overrides: {
  title: string;
  updatedAt?: string;
  description?: string;
  archived?: boolean;
  favorite?: boolean;
  pinned?: boolean;
  content?: PromptDocument;
}): Prompt {
  const base = createPrompt(
    {
      title: overrides.title,
      description: overrides.description ?? `${overrides.title} description`,
    },
    deps(overrides.updatedAt),
  );

  return {
    ...base,
    archived: overrides.archived ?? false,
    favorite: overrides.favorite ?? false,
    pinned: overrides.pinned ?? false,
    ...(overrides.content ? { content: overrides.content } : {}),
  };
}

function template(name: string, category: string): PromptTemplate {
  return createTemplate(
    { name, category, description: `${name} starter`, content: createBlankDocument({ name }) },
    deps(),
  );
}

function settings(overrides: Partial<Settings> = {}): Settings {
  return { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING, ...overrides };
}

interface HarnessOptions {
  readonly prompts?: readonly Prompt[];
  readonly collections?: readonly Collection[];
  readonly templates?: readonly PromptTemplate[];
  readonly revisions?: readonly PromptRevision[];
  readonly activity?: readonly ActivityEvent[];
  readonly settings?: Settings | null;
  readonly repositories?: Repositories;
  readonly path?: string;
}

function renderDashboard(options: HarnessOptions = {}) {
  const repositories =
    options.repositories ??
    createInMemoryRepositories({
      prompts: options.prompts ?? [],
      collections: options.collections ?? [],
      templates: options.templates ?? [],
      revisions: options.revisions ?? [],
      activity: options.activity ?? [],
      settings: options.settings === undefined ? settings() : options.settings,
    });

  return {
    ...renderAppWithData({ repositories, path: options.path ?? '/' }),
    repositories,
  };
}

async function openDashboard(options: HarnessOptions = {}) {
  const harness = renderDashboard(options);
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
  return harness;
}

function stat(label: RegExp): HTMLElement {
  return screen.getByRole('link', { name: label });
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
});

describe('dashboard counts and links', () => {
  it('derives every number from stored records and links each to its view', async () => {
    const live = prompt({ title: 'Support triage', favorite: true });
    const archived = prompt({ title: 'Old workshop', archived: true });
    const collection = createCollection({ name: 'Support' }, deps());

    await openDashboard({
      prompts: [live, archived],
      collections: [collection],
      templates: [template('Extraction', 'Extraction')],
    });

    const promptsStat = stat(/^Prompts/);
    expect(within(promptsStat).getByText('1')).toBeVisible();
    expect(within(stat(/^Favorites/)).getByText('1')).toBeVisible();
    expect(within(stat(/^Archived/)).getByText('1')).toBeVisible();
    expect(within(stat(/^Collections/)).getByText('1')).toBeVisible();
    expect(within(stat(/^Snapshots/)).getByText('0')).toBeVisible();
    expect(within(stat(/^Will not parse/)).getByText('0')).toBeVisible();

    expect(promptsStat).toHaveAttribute('href', '/library');
    expect(stat(/^Favorites/)).toHaveAttribute('href', '/library?filter=favorites');
    expect(stat(/^Archived/)).toHaveAttribute('href', '/library?filter=archived');
    expect(stat(/^Collections/)).toHaveAttribute('href', '/library?filter=collections');
    expect(stat(/^Snapshots/)).toHaveAttribute('href', '/library?filter=snapshots');
    expect(stat(/^Will not parse/)).toHaveAttribute('href', '/validation');
  });

  it('writes a summary sentence from the same counts', async () => {
    await openDashboard({
      prompts: [prompt({ title: 'One' })],
      collections: [createCollection({ name: 'Kit' }, deps())],
    });

    expect(
      screen.getByText('1 prompt across 1 collection. Every stored document parses.'),
    ).toBeVisible();
  });

  it('carries the requested library filter into the real library', async () => {
    const user = userEvent.setup();
    const plain = prompt({ title: 'Plain', updatedAt: '2026-10-02T09:00:00.000Z' });
    const { router } = await openDashboard({
      prompts: [prompt({ title: 'Starred', favorite: true }), plain],
    });

    await user.click(stat(/^Favorites/));

    await waitFor(() => expect(router.state.location.pathname).toBe('/library'));
    expect(router.state.location.search).toBe('?filter=favorites');
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeVisible();

    // The shorthand arrives as a visible, removable filter — and it filters.
    expect(await screen.findByRole('button', { name: 'Remove filter: Favorites' })).toBeVisible();
    expect(await screen.findByRole('link', { name: /Starred/ })).toBeVisible();
    expect(screen.queryByRole('link', { name: /Plain/ })).not.toBeInTheDocument();
  });
});

describe('dashboard lists', () => {
  it('orders recents by edited time and opens the prompt route', async () => {
    const user = userEvent.setup();
    const older = prompt({ title: 'Older prompt', updatedAt: '2026-10-01T09:00:00.000Z' });
    const newer = prompt({ title: 'Newer prompt', updatedAt: '2026-10-23T09:00:00.000Z' });
    const pinned = prompt({
      title: 'Pinned prompt',
      pinned: true,
      updatedAt: '2026-09-01T09:00:00.000Z',
    });

    const { router } = await openDashboard({ prompts: [older, newer, pinned] });

    const recent = screen.getByRole('region', { name: 'Recently edited' });
    const rows = within(recent)
      .getAllByRole('listitem')
      .map((item) => within(item).getByRole('link'));
    expect(rows[0]).toHaveTextContent('Newer prompt');
    expect(rows[1]).toHaveTextContent('Older prompt');
    expect(rows[2]).toHaveTextContent('Pinned prompt');

    await user.click(within(rows[0] as HTMLElement).getByText('Newer prompt'));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/prompts/${newer.id}`));
    expect(await screen.findByRole('heading', { level: 1, name: 'Newer prompt' })).toBeVisible();
  });

  it('shows pinned prompts and favorites as separate lists', async () => {
    await openDashboard({
      prompts: [
        prompt({ title: 'Pinned one', pinned: true }),
        prompt({ title: 'Starred one', favorite: true }),
        prompt({ title: 'Plain one' }),
      ],
    });

    const pinnedRail = screen.getByRole('region', { name: 'Pinned' });
    expect(within(pinnedRail).getByText('Pinned one')).toBeVisible();
    expect(within(pinnedRail).queryByText('Plain one')).not.toBeInTheDocument();

    const favorites = screen.getByRole('region', { name: 'Favorites' });
    expect(within(favorites).getByText('Starred one')).toBeVisible();
    expect(within(favorites).queryByText('Plain one')).not.toBeInTheDocument();
  });

  it('previews quick-start templates and deep-links each one into the catalogue', async () => {
    const extraction = template('Structured extraction', 'Extraction');
    const review = template('Review response', 'Review');
    await openDashboard({ templates: [extraction, review] });

    const quickStart = screen.getByRole('region', { name: 'Quick start' });
    expect(within(quickStart).getByText('Structured extraction')).toBeVisible();
    expect(within(quickStart).getByText('Review response')).toBeVisible();
    expect(within(quickStart).getByRole('link', { name: /Structured extraction/ })).toHaveAttribute(
      'href',
      `/templates?template=${extraction.id}`,
    );
    expect(within(quickStart).getByRole('link', { name: /Review response/ })).toHaveAttribute(
      'href',
      `/templates?template=${review.id}`,
    );
  });

  it('shows the eight most recent activity events, newest first', async () => {
    const activity = Array.from({ length: 10 }, (_value, index) =>
      createActivityEvent(
        { type: 'updated', summary: `Event ${index}` },
        deps(new Date(Date.parse('2026-10-24T09:00:00.000Z') - index * 60_000).toISOString()),
      ),
    );

    await openDashboard({ activity });

    const region = screen.getByRole('region', { name: 'Activity' });
    const items = within(region).getAllByRole('listitem');
    expect(items).toHaveLength(8);
    expect(items[0]).toHaveTextContent('Event 0');
    expect(items[7]).toHaveTextContent('Event 7');
    expect(within(region).queryByText('Event 8')).not.toBeInTheDocument();
  });
});

describe('quality findings on the dashboard (TASK-024)', () => {
  it('lists a prompt with a broken reference and links to the inspector tab', async () => {
    const dangling = prompt({
      title: 'Needs a look',
      content: createBlankDocument({
        name: 'Needs a look',
        role: 'Support lead',
        objective: 'Classify {{ghost}}.',
        instructions: ['Read it.'],
        examples: [{ input: 'A', output: 'B' }],
      }),
    });

    await openDashboard({ prompts: [dangling] });

    const attention = screen.getByRole('region', { name: 'Needs attention' });
    const row = within(attention).getByRole('link', { name: /Needs a look/ });

    expect(row).toHaveAttribute('href', '/prompts/fixture-1?panel=quality');
    expect(within(row).getByText('Structural findings')).toBeVisible();
    expect(within(row).getByText('1 structural finding in the inspector')).toBeVisible();
  });

  it('leaves an unfinished draft alone', async () => {
    const draft = prompt({
      title: 'Just started',
      content: createBlankDocument({
        name: 'Just started',
        role: '',
        objective: '',
        instructions: [],
      }),
    });

    await openDashboard({ prompts: [draft] });

    const attention = screen.getByRole('region', { name: 'Needs attention' });
    expect(within(attention).getByText('Nothing needs attention')).toBeVisible();
  });
});

describe('document problems', () => {
  it('reports a document that does not parse instead of calling it valid', async () => {
    const healthy = prompt({ title: 'Healthy prompt' });
    const broken = prompt({
      title: 'Broken prompt',
      content: { schemaVersion: '1.0' } as unknown as PromptDocument,
    });

    await openDashboard({ prompts: [healthy, broken] });

    expect(within(stat(/^Will not parse/)).getByText('1')).toBeVisible();
    expect(screen.getByText(/1 document will not parse and needs a fix\./)).toBeVisible();

    const attention = screen.getByRole('region', { name: 'Needs attention' });
    expect(within(attention).getByText('Broken prompt')).toBeVisible();
    expect(within(attention).queryByText('Healthy prompt')).not.toBeInTheDocument();
  });

  it('says nothing needs attention when every document parses', async () => {
    await openDashboard({ prompts: [prompt({ title: 'Healthy prompt' })] });

    const attention = screen.getByRole('region', { name: 'Needs attention' });
    expect(within(attention).getByText('Nothing needs attention')).toBeVisible();
  });
});

describe('first run', () => {
  it('appears only while onboarding is unset and dismissal persists to storage', async () => {
    const user = userEvent.setup();
    const { repositories, unmount } = await openDashboard({
      settings: settings({ onboardedAt: null }),
    });

    const guide = screen.getByRole('region', {
      name: 'Three things to try before you build your own',
    });
    await user.click(within(guide).getByRole('button', { name: 'Dismiss guide' }));

    await waitFor(() => expect(screen.queryByText('First run')).not.toBeInTheDocument());

    const stored = await repositories.settings.get();
    expect(stored?.onboardedAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(stored?.onboardedAt ?? ''))).toBe(false);

    // A fresh boot against the same storage: the dismissal is permanent.
    unmount();
    await openDashboard({ repositories });
    expect(screen.queryByText('First run')).not.toBeInTheDocument();
  });

  it('stays hidden when onboarding is already complete', async () => {
    await openDashboard({ prompts: [prompt({ title: 'Existing' })] });
    expect(screen.queryByText('First run')).not.toBeInTheDocument();
  });

  it('reports a failed dismissal instead of pretending it was saved', async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories({ settings: settings({ onboardedAt: null }) });
    const failing: Repositories = {
      ...repositories,
      settings: {
        ...repositories.settings,
        save: async () => {
          throw new Error('Quota exceeded while writing settings.');
        },
      },
    };

    await openDashboard({ repositories: failing });

    const guide = screen.getByRole('region', {
      name: 'Three things to try before you build your own',
    });
    await user.click(within(guide).getByRole('button', { name: 'Dismiss guide' }));

    expect(await within(guide).findByRole('alert')).toHaveTextContent(
      /The dismissal could not be saved/,
    );
    expect(screen.getByText('First run')).toBeInTheDocument();
  });
});

describe('empty library', () => {
  it('renders real empty states and zeroed counts', async () => {
    await openDashboard({ prompts: [], collections: [], templates: [], settings: settings() });

    expect(screen.getByText(/Your library is empty/)).toBeVisible();
    expect(screen.getByText('This library is empty')).toBeVisible();
    expect(within(stat(/^Prompts/)).getByText('0')).toBeVisible();

    const recent = screen.getByRole('region', { name: 'Recently edited' });
    expect(within(recent).getByText('No prompts yet')).toBeVisible();

    const pinned = screen.getByRole('region', { name: 'Pinned' });
    expect(within(pinned).getByText('Nothing pinned')).toBeVisible();

    const activity = screen.getByRole('region', { name: 'Activity' });
    expect(within(activity).getByText('No activity yet')).toBeVisible();

    expect(screen.getByRole('region', { name: 'Quick start' }).textContent).toContain(
      'No templates available',
    );
  });

  it('keeps an archived-only library honest about the empty list', async () => {
    await openDashboard({ prompts: [prompt({ title: 'Archived one', archived: true })] });

    const recent = screen.getByRole('region', { name: 'Recently edited' });
    expect(within(recent).getByText('Nothing edited yet')).toBeVisible();
    expect(within(stat(/^Archived/)).getByText('1')).toBeVisible();
    expect(screen.queryByText('This library is empty')).not.toBeInTheDocument();
  });
});

describe('global search', () => {
  it('opens the command palette from the header', async () => {
    const user = userEvent.setup();
    await openDashboard({ prompts: [prompt({ title: 'Searchable' })] });

    await user.click(within(screen.getByRole('main')).getByRole('button', { name: /^Search/ }));

    expect(useUiStore.getState().paletteOpen).toBe(true);
  });
});
