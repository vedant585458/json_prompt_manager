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
} from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type { Collection, Folder, Prompt } from '@/domain/types';
import { LibraryRoute } from '@/routes/library/LibraryRoute';
import { createDataStore, type DataStore } from '@/store/dataStore';
import { useUiStore } from '@/store/uiStore';
import { renderAppWithData } from '@/test/renderAppWithData';

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
  readonly path?: string;
}

function renderLibrary(seed: LibrarySeed = {}) {
  const repositories = createInMemoryRepositories({
    prompts: seed.prompts ?? [],
    folders: seed.folders ?? [],
    collections: seed.collections ?? [],
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

function list(name: string): HTMLElement {
  return screen.getByRole('list', { name });
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
    expect(screen.getByRole('link', { name: 'Create a prompt' })).toHaveAttribute(
      'href',
      '/composer',
    );
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

  it('keeps the selection for the bulk actions in TASK-013', async () => {
    const user = userEvent.setup();
    await openLibrary({ prompts });

    await user.click(screen.getByRole('checkbox', { name: 'Select “Alpha prompt”' }));

    expect(screen.getByText('1 selected')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
  });

  it('selects every visible prompt at once', async () => {
    const user = userEvent.setup();
    await openLibrary({ prompts });

    await user.click(screen.getByRole('checkbox', { name: 'Select all shown' }));

    expect(screen.getByText('2 selected')).toBeVisible();

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
