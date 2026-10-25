import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppProviders } from '@/app/providers/AppProviders';
import { DataStoreProvider } from '@/app/providers/DataStoreProvider';
import { createInMemoryRepositories, type Repositories } from '@/data';
import {
  createCollection,
  createDefaultSettings,
  createFolder,
  createPrompt,
  createPromptSchema,
  createRevision,
  createTemplate,
  createTestCase,
} from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type {
  Collection,
  Folder,
  Prompt,
  PromptRevision,
  PromptTemplate,
  TestCase,
} from '@/domain/types';
import { LibraryRoute } from '@/routes/library/LibraryRoute';
import { createDataStore, type DataStore } from '@/store/dataStore';
import { useUiStore } from '@/store/uiStore';
import { renderAppWithData } from '@/test/renderAppWithData';
import { stubDownloads } from '@/test/downloads';

/**
 * Library integration tests (TASK-011).
 *
 * The real route, shell, router, store, and in-memory repositories are used;
 * only storage itself is injected. Seeding is done per test so each case owns
 * its dataset, and the URL is asserted directly because it is the state.
 */

const COMPLETED_ONBOARDING = '2026-01-02T09:00:00.000Z';
const BASE_TIME = '2026-10-24T09:00:00.000Z';

interface PromptSeed {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly folderId?: string | null;
  readonly collectionIds?: readonly string[];
  readonly archived?: boolean;
  readonly favorite?: boolean;
  readonly pinned?: boolean;
  readonly status?: Prompt['status'];
  readonly updatedAt?: string;
  readonly objective?: string;
}

function makePrompt(seed: PromptSeed): Prompt {
  return createPrompt(
    {
      title: seed.title,
      description: seed.description ?? `${seed.title} description`,
      tags: seed.tags ?? [],
      folderId: seed.folderId ?? null,
      collectionIds: seed.collectionIds ?? [],
      archived: seed.archived ?? false,
      favorite: seed.favorite ?? false,
      pinned: seed.pinned ?? false,
      status: seed.status ?? 'active',
      content: createBlankDocument({
        name: seed.title,
        objective: seed.objective ?? `Handle ${seed.title.toLowerCase()} well.`,
      }),
    },
    {
      now: () => new Date(seed.updatedAt ?? BASE_TIME),
      newId: () => seed.id,
    },
  );
}

function makeFolder(id: string, name: string, parentId: string | null = null): Folder {
  return createFolder({ name, parentId }, { now: () => new Date(BASE_TIME), newId: () => id });
}

function makeCollection(id: string, name: string): Collection {
  return createCollection(
    { name, description: '' },
    { now: () => new Date(BASE_TIME), newId: () => id },
  );
}

interface LibrarySeed {
  readonly prompts?: readonly Prompt[];
  readonly folders?: readonly Folder[];
  readonly collections?: readonly Collection[];
  readonly templates?: readonly PromptTemplate[];
  readonly revisions?: readonly PromptRevision[];
  readonly testCases?: readonly TestCase[];
  readonly path?: string;
}

function renderLibrary(seed: LibrarySeed = {}) {
  const repositories = createInMemoryRepositories({
    prompts: seed.prompts ?? [],
    folders: seed.folders ?? [],
    collections: seed.collections ?? [],
    templates: seed.templates ?? [],
    revisions: seed.revisions ?? [],
    testCases: seed.testCases ?? [],
    settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
  });

  return {
    ...renderAppWithData({ repositories, path: seed.path ?? '/library' }),
    repositories,
  };
}

async function openLibrary(seed: LibrarySeed = {}) {
  const harness = renderLibrary(seed);
  await screen.findByRole('heading', { level: 1, name: 'Library' });
  return harness;
}

/** Tabs until `target` has focus, failing loudly if it is not reachable. */
async function tabTo(user: ReturnType<typeof userEvent.setup>, target: HTMLElement): Promise<void> {
  for (let step = 0; step < 80; step += 1) {
    if (document.activeElement === target) return;
    await user.tab();
  }

  throw new Error(
    `Tab never reached ${target.getAttribute('aria-label') ?? target.textContent}. Focus is on ${
      document.activeElement?.textContent ?? 'nothing'
    }.`,
  );
}

function list(name: string): HTMLElement {
  return screen.getByRole('list', { name });
}

function makeTemplate(id: string, name = 'Extract fields'): PromptTemplate {
  return createTemplate(
    {
      name,
      description: 'Pulls structured fields out of an email.',
      category: 'extraction',
      content: createBlankDocument({ name, objective: 'Extract the fields from the email.' }),
    },
    { now: () => new Date(BASE_TIME), newId: () => id },
  );
}

function makeRevision(id: string, promptId: string, revisionNumber = 1): PromptRevision {
  return createRevision(
    makePrompt({ id: promptId, title: 'Seed' }),
    { revisionNumber, kind: 'manual' },
    { now: () => new Date(BASE_TIME), newId: () => id },
  );
}

function makeTestCase(id: string, promptId: string): TestCase {
  return createTestCase(
    { promptId, name: `Case ${id}` },
    { now: () => new Date(BASE_TIME), newId: () => id },
  );
}

async function openPromptActions(title: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: `Actions for “${title}”` }));
  return user;
}

async function openRailActions(label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: label }));
  return user;
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
});

describe('library rendering', () => {
  const prompts = [
    makePrompt({ id: 'alpha', title: 'Invoice parser', tags: ['finance'] }),
    makePrompt({ id: 'beta', title: 'Support triage', tags: ['support'] }),
    makePrompt({ id: 'gamma', title: 'Review reply', tags: ['writing'] }),
  ];

  it('renders stored prompts with a count that matches the rendered rows', async () => {
    await openLibrary({ prompts });

    const cards = within(list('Matching prompts, card view')).getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(screen.getByText('3 of 3 prompts')).toBeVisible();
    expect(screen.getByRole('link', { name: /Invoice parser/ })).toHaveAttribute(
      'href',
      '/prompts/alpha',
    );
  });

  it('separates pinned prompts from the main results without duplicating them', async () => {
    await openLibrary({
      prompts: [
        makePrompt({ id: 'pinned', title: 'Pinned prompt', pinned: true }),
        makePrompt({ id: 'plain', title: 'Plain prompt' }),
      ],
    });

    const pinned = list('Pinned prompts, card view');
    const results = list('Matching prompts, card view');

    expect(within(pinned).getByText('Pinned prompt')).toBeVisible();
    expect(within(pinned).queryByText('Plain prompt')).not.toBeInTheDocument();
    expect(within(results).getByText('Plain prompt')).toBeVisible();
    expect(within(results).queryByText('Pinned prompt')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Pinned prompt/ })).toHaveLength(1);
  });

  it('offers a card view by default and a dense list view from the URL', async () => {
    const grid = renderLibrary({ prompts });
    expect(await screen.findByRole('list', { name: 'Matching prompts, card view' })).toBeVisible();
    grid.unmount();

    renderLibrary({ prompts, path: '/library?view=list' });
    expect(await screen.findByRole('list', { name: 'Matching prompts, list view' })).toBeVisible();
  });

  it('shows the same facts in both views', async () => {
    const seeded = [
      makePrompt({
        id: 'alpha',
        title: 'Invoice parser',
        description: 'Turns invoices into line items',
        tags: ['finance'],
      }),
    ];

    const grid = renderLibrary({ prompts: seeded });
    const card = (await screen.findByRole('list', {
      name: 'Matching prompts, card view',
    })) as HTMLElement;
    for (const fact of ['Invoice parser', 'Turns invoices into line items', '#finance', 'Parses']) {
      expect(within(card).getByText(fact)).toBeVisible();
    }
    grid.unmount();

    renderLibrary({ prompts: seeded, path: '/library?view=list' });
    const rows = (await screen.findByRole('list', {
      name: 'Matching prompts, list view',
    })) as HTMLElement;
    for (const fact of ['Invoice parser', 'Turns invoices into line items', '#finance', 'Parses']) {
      expect(within(rows).getByText(fact)).toBeVisible();
    }
  });

  it('filters and sorts a 500-prompt library without losing count parity', async () => {
    const user = userEvent.setup();
    const bulk = Array.from({ length: 500 }, (_, index) =>
      makePrompt({
        id: `bulk-${index}`,
        title: `Bulk prompt ${index}`,
        tags: index % 10 === 0 ? ['bulk'] : ['other'],
        updatedAt: new Date(Date.UTC(2026, 0, 1, 0, index % 60, index % 60)).toISOString(),
      }),
    );

    const { router } = await openLibrary({ prompts: bulk, path: '/library?sort=title' });

    expect(screen.getByText('500 of 500 prompts')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /#bulk/ }));

    await waitFor(() => expect(router.state.location.search).toBe('?tag=bulk&sort=title'), {
      timeout: 2000,
    });
    await waitFor(() => expect(screen.getByText('50 of 500 prompts')).toBeVisible(), {
      timeout: 2000,
    });

    const cards = within(list('Matching prompts, card view')).getAllByRole('listitem');
    expect(cards).toHaveLength(50);
    expect(cards[0]).toHaveTextContent('Bulk prompt 0');
  }, 30_000);

  it('says so when a document will not parse', async () => {
    const broken = {
      ...makePrompt({ id: 'broken', title: 'Broken prompt' }),
      content: { schemaVersion: '1.0' } as unknown as Prompt['content'],
    };

    await openLibrary({ prompts: [broken] });

    const card = within(list('Matching prompts, card view'));
    expect(card.getByText('Will not parse', { selector: 'span' })).toBeVisible();
  });
});

describe('library search', () => {
  const prompts = [
    makePrompt({ id: 'invoice', title: 'Invoice parser', tags: ['finance'] }),
    makePrompt({ id: 'support', title: 'Support triage', tags: ['support'] }),
    makePrompt({
      id: 'rubric',
      title: 'Scoring prompt',
      description: 'Neutral text',
      objective: 'Score the reply with a four point rubric.',
    }),
  ];

  it('debounces typing into the URL and filters the results', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({ prompts });
    const field = screen.getByRole('searchbox', { name: 'Search prompts' });

    await user.type(field, 'invoice');
    expect(router.state.location.search).toBe('');

    await waitFor(() => expect(router.state.location.search).toBe('?q=invoice'), {
      timeout: 2000,
    });
    // Router updates are transitions, so the filtered render lands a tick later.
    await waitFor(() => expect(screen.getByText('1 of 3 prompts')).toBeVisible(), {
      timeout: 2000,
    });
    expect(screen.queryByRole('link', { name: /Support triage/ })).not.toBeInTheDocument();
  });

  it('highlights the matched text and shows why a JSON document matched', async () => {
    const user = userEvent.setup();
    await openLibrary({ prompts });

    await user.type(screen.getByRole('searchbox', { name: 'Search prompts' }), 'rubric');

    await waitFor(() => expect(screen.getByText('1 of 3 prompts')).toBeVisible(), {
      timeout: 2000,
    });
    const marks = document.querySelectorAll('mark');
    expect(marks.length).toBeGreaterThan(0);
    expect(screen.getByText(/JSON:/)).toBeVisible();
    // The excerpt highlights the hit instead of printing it flat.
    const excerpt = screen.getByText(/JSON:/).parentElement as HTMLElement;
    expect(within(excerpt).getByText('rubric').tagName).toBe('MARK');
  });

  it('clears the search from the field and restores every prompt', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({ prompts: prompts });
    const field = screen.getByRole('searchbox', { name: 'Search prompts' });

    await user.type(field, 'invoice');
    await waitFor(() => expect(router.state.location.search).toBe('?q=invoice'), {
      timeout: 2000,
    });

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    await waitFor(() => expect(screen.getByText('3 of 3 prompts')).toBeVisible());
  });
});

describe('library filters', () => {
  const folders = [makeFolder('finance', 'Finance'), makeFolder('support', 'Support', 'finance')];
  const collections = [makeCollection('starter', 'Starter kit')];
  const prompts = [
    makePrompt({
      id: 'alpha',
      title: 'Alpha prompt',
      tags: ['finance'],
      folderId: 'finance',
      collectionIds: ['starter'],
    }),
    makePrompt({ id: 'beta', title: 'Beta prompt', tags: ['support'], folderId: 'support' }),
    makePrompt({ id: 'gamma', title: 'Gamma prompt', tags: ['writing'] }),
    makePrompt({ id: 'archived', title: 'Archived prompt', archived: true }),
  ];

  it('toggles a tag from the rail and records it in the URL', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({ prompts, folders, collections });

    await user.click(screen.getByRole('button', { name: /#finance/ }));

    await waitFor(() => expect(router.state.location.search).toBe('?tag=finance'));
    expect(screen.getByText('1 of 4 prompts')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove filter: #finance' })).toBeVisible();
  });

  it('includes child folders when a parent folder is selected', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({ prompts, folders, collections });

    await user.click(screen.getByRole('button', { name: /^Finance/ }));

    await waitFor(() => expect(router.state.location.search).toBe('?folder=finance'));
    expect(screen.getByText('2 of 4 prompts')).toBeVisible();
    expect(screen.getByRole('link', { name: /Alpha prompt/ })).toBeVisible();
    expect(screen.getByRole('link', { name: /Beta prompt/ })).toBeVisible();
  });

  it('hides archived prompts until the toggle is on', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({ prompts });

    expect(screen.getByText('3 of 4 prompts')).toBeVisible();

    await user.click(screen.getByRole('checkbox', { name: 'Archived' }));

    await waitFor(() => expect(router.state.location.search).toBe('?archived=1'));
    expect(screen.getByText('1 of 4 prompts')).toBeVisible();
    expect(screen.getByRole('link', { name: /Archived prompt/ })).toBeVisible();
    expect(screen.queryByRole('link', { name: /Alpha prompt/ })).not.toBeInTheDocument();
  });

  it('accepts the dashboard shorthand and shows it as a removable filter', async () => {
    const user = userEvent.setup();
    const favourites = [
      makePrompt({ id: 'star', title: 'Starred prompt', favorite: true }),
      makePrompt({ id: 'plain', title: 'Plain prompt' }),
    ];

    const { router } = await openLibrary({
      prompts: favourites,
      path: '/library?filter=favorites',
    });

    expect(screen.getByText('1 of 2 prompts')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Remove filter: Favorites' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    await waitFor(() => expect(screen.getByText('2 of 2 prompts')).toBeVisible());
  });

  it('clears every filter at once', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({
      prompts,
      folders,
      collections,
      path: '/library?tag=finance&status=active&archived=1',
    });

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    await waitFor(() => expect(screen.getByText('3 of 4 prompts')).toBeVisible());
  });

  it('restores filter state with browser back and forward', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({ prompts, folders, collections });

    await user.click(screen.getByRole('button', { name: /#finance/ }));
    await waitFor(() => expect(router.state.location.search).toBe('?tag=finance'));

    await router.navigate(-1);
    await waitFor(() => expect(router.state.location.search).toBe(''));
    await waitFor(() => expect(screen.getByText('3 of 4 prompts')).toBeVisible());

    await router.navigate(1);
    await waitFor(() => expect(router.state.location.search).toBe('?tag=finance'));
    await waitFor(() => expect(screen.getByText('1 of 4 prompts')).toBeVisible());
  });

  it('sorts by title when asked', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({
      prompts: [
        makePrompt({ id: 'zeta', title: 'Zeta prompt' }),
        makePrompt({ id: 'alpha', title: 'Alpha prompt' }),
      ],
    });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort prompts' }), 'title');

    await waitFor(() => expect(router.state.location.search).toBe('?sort=title'));
    const cards = within(list('Matching prompts, card view')).getAllByRole('listitem');
    expect(cards[0]).toHaveTextContent('Alpha prompt');
  });

  it('remembers the chosen view for the next visit', async () => {
    const user = userEvent.setup();
    renderLibrary({ prompts: [makePrompt({ id: 'one', title: 'One' })] });
    await screen.findByRole('list', { name: 'Matching prompts, card view' });

    await user.click(screen.getByRole('button', { name: 'List view' }));

    await waitFor(() =>
      expect(window.localStorage.getItem('promptforge.library.view')).toBe('list'),
    );
  });
});

describe('library empty and defensive states', () => {
  it('explains an empty library and offers both ways in', async () => {
    await openLibrary({ prompts: [] });

    expect(screen.getByText('Your library is empty')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create a prompt' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse templates' })).toHaveAttribute(
      'href',
      '/templates',
    );
  });

  it('explains an empty result set and clears the filters', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({
      prompts: [makePrompt({ id: 'one', title: 'One', tags: ['finance'] })],
      path: '/library?tag=writing',
    });

    expect(screen.getByText('No prompts match')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.getByRole('link', { name: /One/ })).toBeVisible();
  });

  function renderWithStore(store: DataStore) {
    return render(
      <AppProviders>
        <DataStoreProvider store={store}>
          <MemoryRouter initialEntries={['/library']}>
            <LibraryRoute />
          </MemoryRouter>
        </DataStoreProvider>
      </AppProviders>,
    );
  }

  function stubStore(status: 'loading' | 'error'): DataStore {
    const store = createDataStore();
    store.getState().attach(createInMemoryRepositories() as Repositories, 'ephemeral');
    store.setState({ status });
    return store;
  }

  it('shows skeletons while the library is loading', () => {
    renderWithStore(stubStore('loading'));

    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1 }).closest('[aria-busy="true"]')).not.toBeNull();
  });

  it('reports a read failure with a retry that recovers', async () => {
    const user = userEvent.setup();
    const store = stubStore('error');
    store.setState({ error: 'The database is locked.' });
    renderWithStore(store);

    expect(screen.getByRole('alert')).toHaveTextContent('Your library could not be read');

    await user.click(screen.getByText('Technical details'));
    expect(screen.getByText('The database is locked.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(store.getState().status).toBe('ready'));
    expect(await screen.findByText('Your library is empty')).toBeVisible();
  });
});

describe('library selection and keyboard', () => {
  const prompts = [
    makePrompt({ id: 'alpha', title: 'Alpha prompt' }),
    makePrompt({ id: 'beta', title: 'Beta prompt' }),
  ];

  it('keeps a selection until it is cleared', async () => {
    const user = userEvent.setup();
    await openLibrary({ prompts });

    await user.click(screen.getByRole('checkbox', { name: 'Select “Alpha prompt”' }));

    expect(screen.getByText('1 prompt selected')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByText('1 prompt selected')).not.toBeInTheDocument();
  });

  it('selects every visible prompt at once', async () => {
    const user = userEvent.setup();
    await openLibrary({ prompts });

    await user.click(screen.getByRole('checkbox', { name: 'Select all shown' }));

    expect(screen.getByText('2 prompts selected')).toBeVisible();

    await user.click(screen.getByRole('checkbox', { name: 'Select all shown' }));
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('opens a prompt with Enter on its card link', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({ prompts });

    const link = screen.getByRole('link', { name: /Alpha prompt/ });
    link.focus();
    expect(link).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(() => expect(router.state.location.pathname).toBe('/prompts/alpha'));
  });

  it('focuses the search field with the registered shortcut', async () => {
    const user = userEvent.setup();
    await openLibrary({ prompts });

    await user.keyboard('/');

    await waitFor(() =>
      expect(screen.getByRole('searchbox', { name: 'Search prompts' })).toHaveFocus(),
    );
  });
});

describe('library scale and keyboard (TASK-012)', () => {
  it('searches a 320-prompt library down to the matches', async () => {
    const user = userEvent.setup();
    const prompts = Array.from({ length: 320 }, (_, index) =>
      makePrompt({
        id: `bulk-${index}`,
        title: index === 42 ? 'Invoice decoder' : `Routine prompt ${index}`,
        tags: index % 3 === 0 ? ['finance'] : ['support'],
      }),
    );

    await openLibrary({ prompts });

    expect(screen.getByText('320 of 320 prompts')).toBeVisible();

    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'invoice');

    expect(
      await screen.findByText('1 of 320 prompts', undefined, { timeout: 10_000 }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /Invoice decoder/ })).toBeVisible();
  }, 20_000);

  it('opens the prompt editor from the keyboard', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({
      prompts: [makePrompt({ id: 'alpha', title: 'Alpha prompt' })],
    });

    const link = screen.getByRole('link', { name: /Alpha prompt/ });
    link.focus();
    expect(link).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(() => expect(router.state.location.pathname).toBe('/prompts/alpha'));
  });
});

describe('library prompt lifecycle (TASK-012)', () => {
  const folders = [makeFolder('work', 'Work')];

  it('creates a prompt with metadata from a template and opens its editor', async () => {
    const user = userEvent.setup();
    const { router, repositories } = await openLibrary({
      folders,
      collections: [makeCollection('kit', 'Starter kit')],
      templates: [makeTemplate('template-1')],
    });

    await user.click(screen.getByRole('button', { name: 'Create a prompt' }));
    const form = await screen.findByRole('dialog', { name: 'New prompt' });

    await user.type(within(form).getByLabelText(/^Title/), 'Invoice parser');
    await user.type(within(form).getByLabelText(/^Description/), 'Reads invoices');
    await user.selectOptions(within(form).getByLabelText(/^Folder/), 'work');
    await user.type(within(form).getByLabelText(/^Tags/), 'finance, legal');
    await user.click(within(form).getByRole('checkbox', { name: 'Starter kit' }));
    await user.selectOptions(within(form).getByLabelText(/^Start from/), 'template-1');
    await user.click(within(form).getByRole('button', { name: 'Create prompt' }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/prompts\//));

    const stored = await repositories.prompts.list();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      title: 'Invoice parser',
      description: 'Reads invoices',
      folderId: 'work',
      collectionIds: ['kit'],
      tags: ['finance', 'legal'],
      status: 'draft',
    });
    expect(stored[0]?.content.objective).toBe('Extract the fields from the email.');
    expect(screen.getByText('Prompt created')).toBeVisible();
  });

  it('keeps the dialog open and explains a missing title', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({ prompts: [] });

    await user.click(screen.getByRole('button', { name: 'Create a prompt' }));
    const form = await screen.findByRole('dialog', { name: 'New prompt' });

    await user.click(within(form).getByRole('button', { name: 'Create prompt' }));

    expect(within(form).getByText('Give the prompt a title.')).toBeVisible();
    await expect(repositories.prompts.list()).resolves.toHaveLength(0);
  });

  it('edits a prompt’s details from its action menu', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [makePrompt({ id: 'alpha', title: 'Alpha prompt', description: 'Before' })],
      folders,
    });

    await openPromptActions('Alpha prompt');
    await user.click(await screen.findByRole('menuitem', { name: 'Edit details' }));

    const form = await screen.findByRole('dialog', { name: 'Edit prompt details' });
    const title = within(form).getByLabelText(/^Title/);
    await user.clear(title);
    await user.type(title, 'Alpha renamed');
    const description = within(form).getByLabelText(/^Description/);
    await user.clear(description);
    await user.type(description, 'After');
    await user.selectOptions(within(form).getByLabelText(/^Folder/), 'work');
    await user.click(within(form).getByRole('button', { name: 'Save details' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('link', { name: /Alpha renamed/ })).toBeVisible();
    await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({
      title: 'Alpha renamed',
      description: 'After',
      folderId: 'work',
      version: 2,
    });
  });

  it('duplicates a prompt into an independent card', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [makePrompt({ id: 'alpha', title: 'Alpha prompt' })],
    });

    await openPromptActions('Alpha prompt');
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));

    expect(await screen.findByRole('link', { name: /Alpha prompt \(copy\)/ })).toBeVisible();
    await waitFor(async () => expect(await repositories.prompts.list()).toHaveLength(2));
    expect(screen.getByText('Prompt duplicated')).toBeVisible();
  });

  it('archives a prompt, hides it, and offers an undo', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [makePrompt({ id: 'alpha', title: 'Alpha prompt' })],
    });

    await openPromptActions('Alpha prompt');
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }));

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Alpha prompt/ })).not.toBeInTheDocument(),
    );
    await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({ archived: true });

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByRole('link', { name: /Alpha prompt/ })).toBeVisible();
    await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({ archived: false });
  });

  it('deletes a prompt with its revisions and test cases after confirmation', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [makePrompt({ id: 'alpha', title: 'Alpha prompt' })],
      revisions: [makeRevision('rev-1', 'alpha')],
      testCases: [makeTestCase('case-1', 'alpha')],
    });

    await openPromptActions('Alpha prompt');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete prompt' }));

    const confirm = await screen.findByRole('dialog', { name: 'Delete “Alpha prompt”?' });
    expect(within(confirm).getByText('1 saved snapshot of its document.')).toBeVisible();
    expect(within(confirm).getByText('1 test case that reference it.')).toBeVisible();

    await user.click(within(confirm).getByRole('button', { name: 'Delete prompt' }));

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Alpha prompt/ })).not.toBeInTheDocument(),
    );
    await expect(repositories.prompts.get('alpha')).resolves.toBeNull();
    await expect(repositories.revisions.listByPrompt('alpha')).resolves.toEqual([]);
    await expect(repositories.testCases.get('case-1')).resolves.toBeNull();
    expect(screen.getByText('Prompt deleted')).toBeVisible();
  });

  it('reports a failed delete without removing anything', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [makePrompt({ id: 'alpha', title: 'Alpha prompt' })],
    });

    repositories.prompts.deleteCascade = async () => {
      throw new Error('The database is locked.');
    };

    await openPromptActions('Alpha prompt');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete prompt' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete “Alpha prompt”?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete prompt' }));

    expect(await screen.findByText('The prompt was not deleted')).toBeVisible();
    expect(await screen.findByText('The database is locked.')).toBeVisible();
    await expect(repositories.prompts.get('alpha')).resolves.toBeTruthy();

    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('link', { name: /Alpha prompt/ })).toBeVisible();
  });
});

describe('library organization (TASK-012)', () => {
  it('creates a folder from the rail and explains a duplicate name', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({ prompts: [] });

    await user.click(screen.getByRole('button', { name: 'New folder' }));
    const form = await screen.findByRole('dialog', { name: 'New folder' });
    await user.type(within(form).getByLabelText(/^Name/), 'Finance');
    await user.click(within(form).getByRole('button', { name: 'Create folder' }));

    expect(await screen.findByRole('button', { name: /^Finance/ })).toBeVisible();
    await waitFor(async () => expect(await repositories.folders.list()).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: 'New folder' }));
    const again = await screen.findByRole('dialog', { name: 'New folder' });
    await user.type(within(again).getByLabelText(/^Name/), 'finance');
    await user.click(within(again).getByRole('button', { name: 'Create folder' }));

    expect(
      await within(again).findByText('A folder named "Finance" already exists here.'),
    ).toBeVisible();
    await expect(repositories.folders.list()).resolves.toHaveLength(1);
  });

  it('renames and re-parents a folder from its rail menu', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [],
      folders: [makeFolder('work', 'Work'), makeFolder('personal', 'Personal')],
    });

    await openRailActions('Actions for folder “Work”');
    await user.click(await screen.findByRole('menuitem', { name: 'Rename or move…' }));

    const form = await screen.findByRole('dialog', { name: 'Folder settings' });
    const name = within(form).getByLabelText(/^Name/);
    await user.clear(name);
    await user.type(name, 'Client work');
    await user.selectOptions(within(form).getByLabelText(/^Parent folder/), 'personal');
    await user.click(within(form).getByRole('button', { name: 'Save folder' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('button', { name: /^Client work/ })).toBeVisible();
    await expect(repositories.folders.get('work')).resolves.toMatchObject({
      name: 'Client work',
      parentId: 'personal',
    });
  });

  it('cannot offer a folder or its descendants as its own parent', async () => {
    const user = userEvent.setup();
    await openLibrary({
      prompts: [],
      folders: [
        makeFolder('work', 'Work'),
        makeFolder('drafts', 'Drafts', 'work'),
        makeFolder('ideas', 'Ideas', 'drafts'),
      ],
    });

    await openRailActions('Actions for folder “Work”');
    await user.click(await screen.findByRole('menuitem', { name: 'Rename or move…' }));

    const form = await screen.findByRole('dialog', { name: 'Folder settings' });
    const select = within(form).getByLabelText(/^Parent folder/) as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);

    expect(values).toContain('');
    expect(values).not.toContain('work');
    expect(values).not.toContain('drafts');
    expect(values).not.toContain('ideas');
  });

  it('deletes a folder by moving its prompts to the parent', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [makePrompt({ id: 'p1', title: 'Filed prompt', folderId: 'drafts' })],
      folders: [makeFolder('work', 'Work'), makeFolder('drafts', 'Drafts', 'work')],
    });

    await openRailActions('Actions for folder “Drafts”');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete folder…' }));

    const confirm = await screen.findByRole('dialog', { name: 'Delete folder “Drafts”?' });
    expect(within(confirm).getByText('1 prompt moves to Work.')).toBeVisible();

    await user.click(within(confirm).getByRole('button', { name: 'Delete folder' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Drafts/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: /Filed prompt/ })).toBeVisible();
    await expect(repositories.prompts.get('p1')).resolves.toMatchObject({ folderId: 'work' });
    await expect(repositories.folders.get('drafts')).resolves.toBeNull();
  });

  it('reports a failed folder deletion and keeps the folder', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [],
      folders: [makeFolder('work', 'Work'), makeFolder('drafts', 'Drafts', 'work')],
    });

    repositories.folders.delete = async () => {
      throw new Error('The database is locked.');
    };

    await openRailActions('Actions for folder “Drafts”');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete folder…' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete folder “Drafts”?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete folder' }));

    expect(await screen.findByText('The folder was not deleted')).toBeVisible();
    await expect(repositories.folders.get('drafts')).resolves.toBeTruthy();

    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('button', { name: /^Drafts/ })).toBeVisible();
  });

  it('deletes a collection by clearing membership only', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [makePrompt({ id: 'p1', title: 'Member prompt', collectionIds: ['kit'] })],
      collections: [makeCollection('kit', 'Starter kit')],
    });

    await openRailActions('Actions for collection “Starter kit”');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete collection…' }));

    const confirm = await screen.findByRole('dialog', {
      name: 'Delete collection “Starter kit”?',
    });
    expect(within(confirm).getByText('1 prompt keeps its place.')).toBeVisible();

    await user.click(within(confirm).getByRole('button', { name: 'Delete collection' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Starter kit/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: /Member prompt/ })).toBeVisible();
    await expect(repositories.prompts.get('p1')).resolves.toMatchObject({ collectionIds: [] });
    await expect(repositories.collections.get('kit')).resolves.toBeNull();
  });

  it('creates a collection from the rail', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({ prompts: [] });

    await user.click(screen.getByRole('button', { name: 'New collection' }));
    const form = await screen.findByRole('dialog', { name: 'New collection' });
    await user.type(within(form).getByLabelText(/^Name/), 'Replies');
    await user.type(within(form).getByLabelText(/^Description/), 'Canned answers');
    await user.click(within(form).getByRole('button', { name: 'Create collection' }));

    expect(await screen.findByRole('button', { name: /^Replies/ })).toBeVisible();
    await expect(repositories.collections.list()).resolves.toMatchObject([
      { name: 'Replies', description: 'Canned answers' },
    ]);
  });

  it('opens a create dialog from the URL used by the command palette', async () => {
    renderLibrary({ prompts: [], path: '/library?new=folder' });

    expect(await screen.findByRole('dialog', { name: 'New folder' })).toBeVisible();
  });

  it('opens the prompt dialog from ?new=prompt', async () => {
    renderLibrary({ prompts: [], path: '/library?new=prompt' });

    expect(await screen.findByRole('dialog', { name: 'New prompt' })).toBeVisible();
  });
});

describe('library favorites, pins, and archive (TASK-013)', () => {
  it('favorites a prompt from its menu and persists the change', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [makePrompt({ id: 'alpha', title: 'Alpha prompt' })],
    });

    await openPromptActions('Alpha prompt');
    await user.click(await screen.findByRole('menuitem', { name: 'Add to favorites' }));

    expect(await screen.findByText('Added to favorites')).toBeVisible();
    await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({ favorite: true });
    // The card's indicator is text, not colour alone, so it is also the proof
    // that the library reflects the change without a reload.
    expect(within(list('Matching prompts, card view')).getByText('Favorite')).toBeInTheDocument();
  });

  it('pins a prompt into the pinned section, ordered A→Z', async () => {
    const user = userEvent.setup();
    await openLibrary({
      prompts: [
        makePrompt({ id: 'zebra', title: 'Zebra prompt', pinned: true }),
        makePrompt({ id: 'alpha', title: 'Alpha prompt', updatedAt: '2026-10-01T09:00:00.000Z' }),
      ],
    });

    const pinnedList = within(list('Pinned prompts, card view')).getAllByRole('listitem');
    expect(pinnedList).toHaveLength(1);
    expect(pinnedList[0]).toHaveTextContent('Zebra prompt');

    await openPromptActions('Alpha prompt');
    await user.click(await screen.findByRole('menuitem', { name: 'Pin prompt' }));

    await waitFor(() =>
      expect(within(list('Pinned prompts, card view')).getAllByRole('listitem')).toHaveLength(2),
    );
    const afterPin = within(list('Pinned prompts, card view')).getAllByRole('listitem');
    expect(afterPin[0]).toHaveTextContent('Alpha prompt');
  });

  it('archives a prompt from the menu and can restore it', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [makePrompt({ id: 'alpha', title: 'Alpha prompt' })],
    });

    await openPromptActions('Alpha prompt');
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }));

    expect(await screen.findByText('Prompt archived')).toBeVisible();
    await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({ archived: true });
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Alpha prompt/ })).not.toBeInTheDocument(),
    );
  });

  it('says the archive is empty when nothing is archived', async () => {
    await openLibrary({
      prompts: [makePrompt({ id: 'alpha', title: 'Alpha prompt' })],
      path: '/library?archived=1',
    });

    expect(await screen.findByText('Your archive is empty')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back to the library' })).toBeVisible();
  });

  it('shows archived prompts in the archive scope and restores them in bulk', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [makePrompt({ id: 'alpha', title: 'Alpha prompt', archived: true })],
      path: '/library?archived=1',
    });

    expect(screen.getByRole('link', { name: /Alpha prompt/ })).toBeVisible();

    await user.click(screen.getByRole('checkbox', { name: 'Select all shown' }));
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    expect(await screen.findByText('Prompts restored')).toBeVisible();
    await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({ archived: false });
    expect(await screen.findByText('Your archive is empty')).toBeVisible();
  });
});

describe('library bulk actions (TASK-013)', () => {
  const prompts = [
    makePrompt({
      id: 'alpha',
      title: 'Alpha prompt',
      tags: ['finance'],
      updatedAt: '2026-10-03T09:00:00.000Z',
    }),
    makePrompt({
      id: 'beta',
      title: 'Beta prompt',
      tags: ['support'],
      updatedAt: '2026-10-02T09:00:00.000Z',
    }),
    makePrompt({
      id: 'gamma',
      title: 'Gamma prompt',
      tags: ['finance'],
      updatedAt: '2026-10-01T09:00:00.000Z',
    }),
  ];

  it('reports the real count and undoes a bulk favorite', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({ prompts });

    await user.click(screen.getByRole('checkbox', { name: 'Select “Alpha prompt”' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select “Beta prompt”' }));
    expect(screen.getByText('2 prompts selected')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Favorite' }));

    expect(await screen.findByText('Added to favorites')).toBeVisible();
    await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({ favorite: true });
    await expect(repositories.prompts.get('beta')).resolves.toMatchObject({ favorite: true });
    await expect(repositories.prompts.get('gamma')).resolves.toMatchObject({ favorite: false });

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(async () =>
      expect(await repositories.prompts.get('alpha')).toMatchObject({ favorite: false }),
    );
    await expect(repositories.prompts.get('beta')).resolves.toMatchObject({ favorite: false });
  });

  it('archives a selection and restores it with undo', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({ prompts });

    await user.click(screen.getByRole('checkbox', { name: 'Select all shown' }));
    await user.click(screen.getByRole('button', { name: 'Archive' }));

    expect(await screen.findByText('Prompts archived')).toBeVisible();
    await waitFor(async () => {
      const stored = await repositories.prompts.list();
      expect(stored.every((prompt) => prompt.archived)).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(async () => {
      const stored = await repositories.prompts.list();
      expect(stored.every((prompt) => !prompt.archived)).toBe(true);
    });
    expect(await screen.findByRole('link', { name: /Alpha prompt/ })).toBeVisible();
  });

  it('deletes the selection after confirmation and brings it back with undo', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({
      prompts: [makePrompt({ id: 'alpha', title: 'Alpha prompt' })],
      revisions: [makeRevision('rev-1', 'alpha')],
      testCases: [makeTestCase('case-1', 'alpha')],
    });

    await user.click(screen.getByRole('checkbox', { name: 'Select “Alpha prompt”' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const confirm = await screen.findByRole('dialog', { name: 'Delete 1 prompt?' });
    expect(within(confirm).getByText(/permanently/)).toBeVisible();
    await user.click(within(confirm).getByRole('button', { name: 'Delete prompts' }));

    expect(await screen.findByText('Prompts deleted')).toBeVisible();
    await expect(repositories.prompts.get('alpha')).resolves.toBeNull();
    await expect(repositories.revisions.listByPrompt('alpha')).resolves.toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(async () => expect(await repositories.prompts.get('alpha')).not.toBeNull());
    await expect(repositories.revisions.listByPrompt('alpha')).resolves.toHaveLength(1);
    await expect(repositories.testCases.get('case-1')).resolves.not.toBeNull();
    expect(await screen.findByRole('link', { name: /Alpha prompt/ })).toBeVisible();
  });

  it('selects only the filtered prompts and states the scope', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({ prompts });

    await user.click(screen.getByRole('button', { name: /#finance/ }));
    await waitFor(() => expect(router.state.location.search).toBe('?tag=finance'));

    await user.click(await screen.findByRole('checkbox', { name: 'Select all shown' }));

    expect(screen.getByText('2 prompts selected')).toBeVisible();
    expect(screen.getByText('All 2 prompts shown')).toBeVisible();
  });

  it('extends the selection with Shift and clears it when filters change', async () => {
    const user = userEvent.setup();
    const { router } = await openLibrary({ prompts, path: '/library?sort=title' });

    await user.click(screen.getByRole('checkbox', { name: 'Select “Alpha prompt”' }));
    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('checkbox', { name: 'Select “Gamma prompt”' }));
    await user.keyboard('{/Shift}');

    expect(screen.getByText('3 prompts selected')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /#finance/ }));
    await waitFor(() => expect(router.state.location.search).toContain('tag=finance'));
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
  });

  it('adds a tag to the selection through the bulk tag dialog', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({ prompts });

    await user.click(screen.getByRole('checkbox', { name: 'Select “Alpha prompt”' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select “Beta prompt”' }));
    await user.click(screen.getByRole('button', { name: 'Tags…' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit tags' });
    await user.type(within(dialog).getByLabelText('Add tags'), 'priority');
    await user.click(within(dialog).getByRole('button', { name: 'Apply tags' }));

    expect(await screen.findByText('Tags updated')).toBeVisible();
    await waitFor(async () =>
      expect(await repositories.prompts.get('alpha')).toMatchObject({
        tags: ['finance', 'priority'],
      }),
    );
    await expect(repositories.prompts.get('beta')).resolves.toMatchObject({
      tags: ['support', 'priority'],
    });
    await expect(repositories.prompts.get('gamma')).resolves.toMatchObject({ tags: ['finance'] });
  });

  it('reports a failed bulk write and keeps the selection', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({ prompts });

    repositories.prompts.updateMany = async () => {
      throw new Error('The database is locked.');
    };

    await user.click(screen.getByRole('checkbox', { name: 'Select all shown' }));
    await user.click(screen.getByRole('button', { name: 'Favorite' }));

    expect(await screen.findByText('That change was not saved')).toBeVisible();
    expect(screen.getByText('3 prompts selected')).toBeVisible();

    const stored = await repositories.prompts.list();
    expect(stored.every((prompt) => !prompt.favorite)).toBe(true);
  });

  it('reports an undo that storage refuses instead of claiming success', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({ prompts });

    await user.click(screen.getByRole('checkbox', { name: 'Select all shown' }));
    await user.click(screen.getByRole('button', { name: 'Favorite' }));
    expect(await screen.findByText('Added to favorites')).toBeVisible();

    repositories.prompts.updateMany = async () => {
      throw new Error('The database is locked.');
    };
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('That change could not be undone')).toBeVisible();
    // The favorites are still stored: a failed undo changes nothing.
    const stored = await repositories.prompts.list();
    expect(stored.every((prompt) => prompt.favorite)).toBe(true);
  });

  it('reports a delete that cannot be given back', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({ prompts });

    await user.click(screen.getByRole('checkbox', { name: 'Select “Alpha prompt”' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 1 prompt?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete prompts' }));

    expect(await screen.findByText('Prompts deleted')).toBeVisible();

    repositories.prompts.create = async () => {
      throw new Error('The database is locked.');
    };
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('Those prompts could not be restored')).toBeVisible();
    await expect(repositories.prompts.get('alpha')).resolves.toBeNull();
  });

  it('favorites a selection with the keyboard only', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({ prompts });

    screen.getByRole('searchbox', { name: /search/i }).focus();

    const checkbox = screen.getByRole('checkbox', { name: 'Select “Alpha prompt”' });
    await tabTo(user, checkbox);
    await user.keyboard(' ');
    expect(screen.getByText('1 prompt selected')).toBeVisible();

    const favorite = screen.getByRole('button', { name: 'Favorite' });
    await tabTo(user, favorite);
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Added to favorites')).toBeVisible();
    await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({ favorite: true });
    await expect(repositories.prompts.get('beta')).resolves.toMatchObject({ favorite: false });
  });
});

describe('library tag management (TASK-013)', () => {
  const prompts = [
    makePrompt({ id: 'alpha', title: 'Alpha prompt', tags: ['invoice', 'finance'] }),
    makePrompt({ id: 'beta', title: 'Beta prompt', tags: ['invoice'] }),
    makePrompt({ id: 'gamma', title: 'Gamma prompt', tags: [] }),
  ];

  it('renames a tag everywhere from the tag manager', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({ prompts });

    await user.click(screen.getByRole('button', { name: 'Manage tags' }));
    const dialog = await screen.findByRole('dialog', { name: 'Manage tags' });
    expect(within(dialog).getByText('#invoice')).toBeVisible();

    await user.click(within(dialog).getAllByRole('button', { name: 'Rename' })[0] as HTMLElement);
    const input = within(dialog).getByLabelText('Rename #invoice');
    await user.clear(input);
    await user.type(input, 'billing');
    await user.click(within(dialog).getByRole('button', { name: 'Save tag' }));

    expect(await screen.findByText('Tag renamed')).toBeVisible();
    await waitFor(async () =>
      expect(await repositories.prompts.get('alpha')).toMatchObject({
        tags: ['billing', 'finance'],
      }),
    );
    await expect(repositories.prompts.get('beta')).resolves.toMatchObject({ tags: ['billing'] });
  });

  it('removes a tag from every prompt without deleting the prompts', async () => {
    const user = userEvent.setup();
    const { repositories } = await openLibrary({ prompts });

    await user.click(screen.getByRole('button', { name: 'Manage tags' }));
    const dialog = await screen.findByRole('dialog', { name: 'Manage tags' });

    await user.click(within(dialog).getAllByRole('button', { name: 'Delete' })[0] as HTMLElement);
    expect(within(dialog).getByText(/Remove #invoice from 2 prompts/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Remove tag' }));

    expect(await screen.findByText('Tag removed')).toBeVisible();
    await waitFor(async () =>
      expect(await repositories.prompts.get('beta')).toMatchObject({ tags: [] }),
    );
    await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({
      tags: ['finance'],
    });
    expect(await repositories.prompts.list()).toHaveLength(3);
  });
});

describe('schema mismatches in the library (TASK-016)', () => {
  it('badges a prompt whose document fails the schema it points at', async () => {
    const schema = createPromptSchema(
      {
        name: 'Team shape',
        schemaContent: {
          type: 'object',
          required: ['objective'],
          properties: { objective: { type: 'string', minLength: 20 } },
        },
      },
      { now: () => new Date(BASE_TIME), newId: () => 'schema-1' },
    );

    // A short objective: the document parses, but fails the attached schema.
    const prompt = {
      ...makePrompt({ id: 'alpha', title: 'Invoice parser', objective: 'Too short.' }),
      schemaId: schema.id,
    };

    const repositories = createInMemoryRepositories({
      prompts: [prompt],
      schemas: [schema],
      settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
    });

    renderAppWithData({ repositories, path: '/library' });

    expect(await screen.findByText('Schema mismatch')).toBeVisible();
    // The document parses — the schema is what it fails, and the two badges say
    // so separately rather than collapsing into one verdict.
    expect(screen.getByText('Parses', { selector: 'span' })).toBeVisible();
  });

  describe('library export (TASK-026)', () => {
    const prompts = [
      makePrompt({ id: 'alpha', title: 'Alpha prompt' }),
      makePrompt({ id: 'beta', title: 'Beta prompt' }),
    ];

    it('downloads the selection as one bundle and changes nothing', async () => {
      const downloads = stubDownloads();
      try {
        const user = userEvent.setup();
        const { repositories } = await openLibrary({ prompts });

        await user.click(screen.getByRole('checkbox', { name: 'Select “Alpha prompt”' }));
        await user.click(screen.getByRole('checkbox', { name: 'Select “Beta prompt”' }));
        await user.click(screen.getByRole('button', { name: 'Export' }));

        expect(await screen.findByText('Selection downloaded')).toBeVisible();
        expect(downloads.lastFileName()).toMatch(
          /^promptforge-selection-2-prompts-\d{4}-\d{2}-\d{2}\.json$/,
        );

        const [blob] = downloads.createObjectURL.mock.calls[0] as [Blob];
        const parsed = JSON.parse(await blob.text()) as {
          manifest: { scope: string; counts: { prompts: number } };
          prompts: { id: string }[];
        };

        expect(parsed.manifest.scope).toBe('selection');
        expect(parsed.prompts.map((prompt) => prompt.id)).toEqual(['alpha', 'beta']);
        expect(parsed.manifest.counts.prompts).toBe(2);

        // Exporting reads; it does not write prompts or clear the selection.
        await expect(repositories.prompts.list()).resolves.toHaveLength(2);
      } finally {
        downloads.restore();
      }
    });

    it('records the export in the activity log', async () => {
      const downloads = stubDownloads();
      try {
        const user = userEvent.setup();
        const { store } = await openLibrary({ prompts });

        await user.click(screen.getByRole('checkbox', { name: 'Select “Alpha prompt”' }));
        await user.click(screen.getByRole('button', { name: 'Export' }));

        await screen.findByText('Selection downloaded');
        await waitFor(() =>
          expect(store.getState().activity[0]?.summary).toBe('Exported 1 selected prompt'),
        );
      } finally {
        downloads.restore();
      }
    });
  });
});
