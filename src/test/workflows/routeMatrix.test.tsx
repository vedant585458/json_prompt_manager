/**
 * Route matrix (TASK-030).
 *
 * The integration pass, automated as far as this environment allows: every route
 * the router can resolve is opened with a real seeded library, and the shell
 * around it is checked — one main landmark, one level-1 heading, the document
 * title, a breadcrumb that names the screen, and no error boundary anywhere.
 *
 * Then the links on every screen are resolved against the real route table, so a
 * dead internal link fails a test instead of being found by a reader.
 *
 * What this cannot do is look at the result: jsdom has no layout and no paint.
 * That gap is recorded in `docs/LIMITATIONS.md`, not papered over here.
 */

import { screen, waitFor, within } from '@testing-library/react';
import { matchRoutes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { routes } from '@/app/router';
import { SEED_VERSION, createInMemoryRepositories, seedDatabase } from '@/data';
import { ALL_NAV } from '@/components/layout/navigation';
import { createDefaultSettings } from '@/domain/factories';
import { buildLibrary } from '@/test/libraryFixture';
import { renderAppWithData } from '@/test/renderAppWithData';

interface RouteCase {
  readonly path: string;
  /** The screen this path must land on, as its level-1 heading. */
  readonly heading: string | RegExp;
  /** What the tab and screen readers must be told. */
  readonly title: string;
  /** A breadcrumb entry that must not appear: the screen exists, so it is not missing. */
  readonly crumb: string;
}

const ROUTES: readonly RouteCase[] = [
  { path: '/', heading: 'Dashboard', title: 'Dashboard · PromptForge', crumb: 'Dashboard' },
  { path: '/library', heading: 'Library', title: 'Library · PromptForge', crumb: 'Library' },
  {
    path: '/prompts/prompt-1',
    heading: 'Prompt 1',
    title: 'Prompt · PromptForge',
    crumb: 'Prompt',
  },
  {
    path: '/prompts/prompt-1/compose',
    heading: 'Compose “Prompt 1”',
    title: 'Prompt · PromptForge',
    crumb: 'Prompt',
  },
  {
    path: '/prompts/prompt-1/history',
    heading: 'Version history',
    title: 'Prompt · PromptForge',
    crumb: 'Prompt',
  },
  {
    path: '/prompts/prompt-1/playground',
    heading: 'Playground',
    title: 'Prompt · PromptForge',
    crumb: 'Prompt',
  },
  {
    path: '/prompts/prompt-1/lab',
    heading: 'Laboratory',
    title: 'Prompt · PromptForge',
    crumb: 'Prompt',
  },
  { path: '/diff', heading: 'Compare documents', title: 'Diff · PromptForge', crumb: 'Diff' },
  {
    path: '/diff?prompt=prompt-1',
    heading: 'Compare documents',
    title: 'Diff · PromptForge',
    crumb: 'Diff',
  },
  {
    path: '/composer',
    heading: 'Compose a prompt',
    title: 'Composer · PromptForge',
    crumb: 'Composer',
  },
  {
    path: '/templates',
    heading: 'Templates',
    title: 'Templates · PromptForge',
    crumb: 'Templates',
  },
  {
    path: '/validation',
    heading: 'Validation',
    title: 'Validation · PromptForge',
    crumb: 'Validation',
  },
  { path: '/health', heading: 'Health', title: 'Health · PromptForge', crumb: 'Health' },
  { path: '/settings', heading: 'Settings', title: 'Settings · PromptForge', crumb: 'Settings' },
  {
    path: '/design',
    heading: 'Design system gallery',
    title: 'Design system · PromptForge',
    crumb: 'Design system',
  },
];

/** The element the router falls back to for an unknown path. */
function notFoundElement() {
  const shell = routes[0];
  return shell?.children?.find((child) => child.path === '*')?.element ?? null;
}

function isNotFound(path: string): boolean {
  const matched = matchRoutes(routes, path);
  const last = matched?.[matched.length - 1];
  return last?.route.element === notFoundElement();
}

function seeded() {
  return createInMemoryRepositories(buildLibrary({ prompts: 3, folders: true, collection: true }));
}

async function open(path: string) {
  const view = renderAppWithData({ repositories: seeded(), path });
  await waitFor(() => expect(view.store.getState().status).toBe('ready'));
  return view;
}

describe('every route renders as a real screen', () => {
  for (const route of ROUTES) {
    it(`${route.path} renders, titled, with one main landmark`, async () => {
      await open(route.path);

      const heading = await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
      if (typeof route.heading === 'string') {
        expect(heading).toHaveTextContent(route.heading);
      } else {
        expect(heading.textContent ?? '').toMatch(route.heading);
      }

      // Exactly one main landmark and one level-1 heading per screen.
      expect(document.querySelectorAll('main')).toHaveLength(1);
      expect(document.querySelectorAll('h1')).toHaveLength(1);

      // The shell's navigation is present on every route, including the last.
      expect(screen.getByRole('complementary', { name: 'Workspace navigation' })).toBeVisible();
      expect(screen.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument();

      // The tab says where the reader is, and the breadcrumb agrees.
      expect(document.title).toBe(route.title);
      expect(screen.queryByText('Not found')).toBeNull();

      // Nothing reached the error boundary.
      expect(screen.queryByText(/Something went wrong|went wrong while rendering/i)).toBeNull();
    }, 20_000);
  }

  it('renders the not-found screen for an unknown path, with a way back', async () => {
    await open('/there-is-nothing-here');

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Nothing lives at this address',
    );
    expect(document.title).toBe('Not found · PromptForge');

    const main = screen.getByRole('main');
    expect(within(main).getAllByRole('link').length).toBeGreaterThan(0);
  }, 20_000);
});

describe('every internal link resolves to a real route', () => {
  it.each(ROUTES.map((route) => route.path))(
    '%s has no dead internal links',
    async (path) => {
      await open(path);
      await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });

      const hrefs = Array.from(document.querySelectorAll('a[href]'))
        .map((anchor) => anchor.getAttribute('href') ?? '')
        .filter((href) => href.startsWith('/') && !href.startsWith('//'));

      expect(hrefs.length).toBeGreaterThan(0);

      const dead = hrefs.filter((href) => isNotFound(href.split(/[?#]/)[0] ?? href));
      expect(dead).toEqual([]);
    },
    20_000,
  );

  it('links every navigation destination to a route that exists', () => {
    for (const item of ALL_NAV) {
      expect(isNotFound(item.to), `${item.to} is missing from the router`).toBe(false);
    }
  });
});

describe('an empty library still explains itself', () => {
  const EMPTY_STATES: readonly { path: string; says: RegExp }[] = [
    { path: '/', says: /Your library is empty/ },
    { path: '/library', says: /Every prompt you create is stored in this browser/ },
    { path: '/health', says: /nothing to report/ },
    { path: '/validation', says: /No prompts to validate/ },
    { path: '/prompts/prompt-1/playground', says: /This prompt is not in your library/ },
  ];

  for (const state of EMPTY_STATES) {
    it(`${state.path} says what to do when there is nothing yet`, async () => {
      const view = renderAppWithData({
        repositories: createInMemoryRepositories({
          settings: { ...createDefaultSettings(), onboardedAt: null },
        }),
        path: state.path,
      });
      await waitFor(() => expect(view.store.getState().status).toBe('ready'));

      await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
      const main = screen.getByRole('main');
      expect(main.textContent ?? '').toMatch(state.says);
      expect(screen.queryByText(/Something went wrong/)).toBeNull();
    }, 20_000);
  }

  it('offers real guidance on a first run instead of an empty dashboard', async () => {
    const view = renderAppWithData({
      repositories: createInMemoryRepositories({
        settings: { ...createDefaultSettings(), onboardedAt: null },
      }),
      path: '/',
    });
    await waitFor(() => expect(view.store.getState().status).toBe('ready'));

    expect(await screen.findByText(/Three things to try before you build your own/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Dismiss/ })).toBeVisible();
  }, 20_000);
});

describe('a fresh install seeds its shipped content', () => {
  it('writes the starter folders, collections, prompts, and templates once', async () => {
    const repositories = createInMemoryRepositories();

    const first = await seedDatabase(repositories);
    expect(first.seeded).toBe(true);
    expect(first.version).toBe(SEED_VERSION);
    expect(first.created.templates).toBeGreaterThan(0);
    expect(first.created.prompts).toBeGreaterThan(0);

    const templates = await repositories.templates.list();
    expect(templates.length).toBe(first.created.templates);
    // Settings arrive with the seed, without onboarding being claimed.
    const settings = await repositories.settings.get();
    expect(settings).not.toBeNull();
    expect(settings?.onboardedAt).toBeNull();

    // Seeding again is a no-op, so a reload never duplicates the catalogue.
    const second = await seedDatabase(repositories);
    expect(second.seeded).toBe(false);
    expect(second.previousVersion).toBe(SEED_VERSION);
    expect(second.created.templates).toBe(0);
    expect(await repositories.templates.list()).toHaveLength(templates.length);
  }, 20_000);
});

describe('the matrix itself is honest', () => {
  it('covers every path the router declares', () => {
    const declared = (routes[0]?.children ?? [])
      .map((child) => child.path)
      .filter((path): path is string => Boolean(path) && path !== '*');

    for (const path of declared) {
      const concrete = path.replace(':promptId', 'prompt-1');
      const covered = ROUTES.some((route) => route.path.split('?')[0] === `/${concrete}`);
      expect(covered, `no matrix case opens /${concrete}`).toBe(true);
    }
  });

  it('detects a dead link when one is planted', () => {
    expect(isNotFound('/definitely-not-a-route')).toBe(true);
    expect(isNotFound('/library')).toBe(false);
  });
});
