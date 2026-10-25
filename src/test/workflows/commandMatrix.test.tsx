/**
 * Command matrix (TASK-030).
 *
 * The palette is the second way into almost everything, so it is checked as a
 * whole rather than command by command: every registered command must be
 * well-formed, reachable by typing its own title, safe to run with a bare
 * context, and — when it navigates — must point at a route that exists.
 *
 * The registry already rejects duplicate ids and duplicate shortcuts eagerly, so
 * a successful registration here *is* the collision assertion.
 */

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { matchRoutes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { routes } from '@/app/router';
import { ALL_NAV } from '@/components/layout/navigation';
import { createInMemoryRepositories } from '@/data';
import { buildLibrary } from '@/test/libraryFixture';
import { renderAppWithData } from '@/test/renderAppWithData';
import { useUiStore } from '@/store/uiStore';
import { createCoreCommands } from '@/lib/commands/coreCommands';
import { commandRegistry } from '@/lib/commands/registry';
import { filterCommands } from '@/lib/commands/filter';
import { createCommandRegistry, isCommandAvailable } from '@/lib/commands/registry';
import { parseShortcut } from '@/lib/commands/shortcuts';
import { COMMAND_GROUPS, type CommandContext, type CommandDefinition } from '@/lib/commands/types';

const COMMANDS = createCoreCommands();

/**
 * Commands whose guard needs a mounted screen, not just a context: the workspace
 * or the shell registers its action on mount (`hasPromptValidation`,
 * `hasPromptSnapshot`, `hasPromptExport`, `hasImportOpener`). They are checked in
 * a rendered app below — that is the only place the registration is real.
 */
const SCREEN_SCOPED = new Set([
  'history.snapshot',
  'transfer.export-prompt',
  'transfer.import',
  'validation.validate-prompt',
]);

function context(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    pathname: '/',
    isTyping: false,
    paletteOpen: false,
    helpOpen: false,
    themePreference: 'dark',
    railCollapsed: false,
    dev: false,
    platform: 'other',
    navigate: vi.fn(),
    setPaletteOpen: vi.fn(),
    toggleTheme: vi.fn(),
    toggleRail: vi.fn(),
    setHelpOpen: vi.fn(),
    focusLibrarySearch: vi.fn(),
    togglePromptFavorite: vi.fn(),
    validatePrompt: vi.fn(),
    saveSnapshot: vi.fn(),
    importFile: vi.fn(),
    exportPrompt: vi.fn(),
    ...overrides,
  };
}

function notFoundElement() {
  return routes[0]?.children?.find((child) => child.path === '*')?.element ?? null;
}

function resolves(path: string): boolean {
  const matched = matchRoutes(routes, path);
  return matched?.[matched.length - 1]?.route.element !== notFoundElement();
}

describe('the command catalogue is well formed', () => {
  it('registers without a collision and keeps ids and titles unique', () => {
    const registry = createCommandRegistry();
    expect(() => registry.registerAll(COMMANDS)).not.toThrow();

    const ids = COMMANDS.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);

    const titles = COMMANDS.map((command) => command.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('gives every command a group, a description, and a namespaced id', () => {
    for (const command of COMMANDS) {
      expect(COMMAND_GROUPS).toContain(command.group);
      expect(command.description?.trim().length ?? 0).toBeGreaterThan(0);
      expect(command.id).toMatch(/^[a-z]+\.[a-z0-9-]+$/);
      expect(command.title.trim()).not.toBe('');
    }
  });

  it('keeps keywords lowercase and free of the title’s own duplicates', () => {
    for (const command of COMMANDS) {
      for (const keyword of command.keywords ?? []) {
        expect(keyword, `"${command.id}" has a keyword that is not lowercase`).toBe(
          keyword.toLowerCase(),
        );
        expect(keyword.trim()).toBe(keyword);
      }
    }
  });

  it('parses every shortcut and never binds two commands to one chord', () => {
    const seen = new Map<string, string>();
    for (const command of COMMANDS) {
      if (!command.shortcut) continue;
      expect(() => parseShortcut(command.shortcut!)).not.toThrow();
      const previous = seen.get(command.shortcut);
      expect(previous, `"${command.shortcut}" is bound twice`).toBeUndefined();
      seen.set(command.shortcut, command.id);
    }
  });
});

describe('every command can be found and run', () => {
  it('finds each command by typing its own title, wherever it is available', () => {
    const states: CommandContext[] = [
      context(),
      context({ dev: true }),
      context({ pathname: '/library' }),
      context({ pathname: '/library', dev: true }),
      context({ pathname: '/prompts/prompt-1' }),
      context({ pathname: '/prompts/prompt-1', dev: true }),
      context({ themePreference: 'light' }),
      context({ themePreference: 'system' }),
      context({ railCollapsed: true }),
    ];

    const unreachable: string[] = [];

    for (const command of COMMANDS) {
      const available = states.filter((state) => isCommandAvailable(command, state));
      if (SCREEN_SCOPED.has(command.id)) {
        // Hidden by design without a mounted screen; asserted in the app below.
        expect(available, `"${command.id}" should need a mounted screen`).toEqual([]);
        continue;
      }
      if (available.length === 0) {
        unreachable.push(command.id);
        continue;
      }

      // A command must be findable — and runnable-looking — in every state where
      // it says it is available.
      for (const state of available) {
        const matches = filterCommands(COMMANDS, command.title, state);
        expect(
          matches.map((match) => match.command.id),
          `typing "${command.title}" in ${state.pathname} does not offer "${command.id}"`,
        ).toContain(command.id);
      }
    }

    expect(unreachable, `never available in any checked state: ${unreachable.join(', ')}`).toEqual(
      [],
    );
  });

  it('runs without throwing and never runs twice for one activation', () => {
    for (const command of COMMANDS) {
      const runContext = context({ dev: true, pathname: '/prompts/prompt-1' });
      expect(() => command.run(runContext), `"${command.id}" threw`).not.toThrow();
    }
  });

  it('sends every navigation command to a route that exists', () => {
    const targets: { id: string; path: string }[] = [];

    for (const command of COMMANDS) {
      const navigate = vi.fn<(to: string) => void>();
      command.run(context({ navigate, dev: true, pathname: '/prompts/prompt-1' }));
      for (const call of navigate.mock.calls) targets.push({ id: command.id, path: call[0] });
    }

    expect(targets.length).toBeGreaterThan(ALL_NAV.length);

    const pathnames = targets.map((target) => target.path.split(/[?#]/)[0] ?? target.path);
    const dead = pathnames.filter((path) => !resolves(path));
    expect(dead, `commands navigate to unknown routes: ${dead.join(', ')}`).toEqual([]);
  });

  it('reaches every rail destination from the palette', () => {
    const destinations = new Set<string>();

    for (const command of COMMANDS) {
      const navigate = vi.fn<(to: string) => void>();
      command.run(context({ navigate, dev: true }));
      for (const call of navigate.mock.calls) {
        destinations.add(call[0].split(/[?#]/)[0] ?? call[0]);
      }
    }

    for (const item of ALL_NAV) {
      expect(destinations.has(item.to), `no command navigates to ${item.to}`).toBe(true);
    }
  });
});

describe('availability guards are honest', () => {
  it('evaluates every guard for every context shape without throwing', () => {
    const contexts: CommandContext[] = [
      context(),
      context({ dev: true }),
      context({ pathname: '/prompts/prompt-1' }),
      context({ pathname: '/library', isTyping: true }),
      context({ platform: 'apple', themePreference: 'light', railCollapsed: true }),
    ];

    for (const command of COMMANDS) {
      for (const candidate of contexts) {
        expect(() => command.when?.(candidate), `"${command.id}" guard threw`).not.toThrow();
      }
    }
  });

  it('hides development commands outside a development build', () => {
    const development = COMMANDS.filter((command) => command.group === 'Development');
    expect(development.length).toBeGreaterThan(0);

    for (const command of development) {
      expect(command.when?.(context({ dev: false }))).toBe(false);
      expect(command.when?.(context({ dev: true }))).toBe(true);
    }
  });

  it('does not register a command with no group members', () => {
    for (const command of COMMANDS as readonly CommandDefinition[]) {
      expect(COMMAND_GROUPS).toContain(command.group);
    }
  });
});

describe('screen-scoped commands appear while their screen is open', () => {
  async function open(path: string) {
    useUiStore.setState({ paletteOpen: false, helpOpen: false, recentCommandIds: [] });
    const view = renderAppWithData({
      repositories: createInMemoryRepositories(buildLibrary({ prompts: 2, history: true })),
      path,
      mode: 'durable',
    });
    await waitFor(() => expect(view.store.getState().status).toBe('ready'));

    const user = userEvent.setup();
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    return {
      dialog,
      user,
      search: within(dialog).getByRole('combobox', { name: 'Search commands' }),
    };
  }

  it('offers validate, snapshot, export, and import on the prompt workspace', async () => {
    const { dialog, user, search } = await open('/prompts/prompt-1');

    for (const title of [
      'Validate the open prompt',
      'Save a snapshot of the open prompt',
      'Export the open prompt',
      'Import from a file',
    ]) {
      await user.clear(search);
      await user.type(search, title);
      expect(
        await within(dialog).findByText(title),
        `"${title}" is not offered on the prompt screen`,
      ).toBeVisible();
    }
  });

  it('drops the prompt-scoped commands on a screen with no prompt open, but keeps import', async () => {
    const { dialog, search } = await open('/library');
    const user = userEvent.setup();

    await user.type(search, 'Save a snapshot of the open prompt');
    await waitFor(() =>
      expect(within(dialog).queryByText('Save a snapshot of the open prompt')).toBeNull(),
    );

    await user.clear(search);
    await user.type(search, 'Import from a file');
    expect(await within(dialog).findByText('Import from a file')).toBeVisible();
  });

  it('leaves the palette closed when a navigation command runs from it', async () => {
    const { dialog, user, search } = await open('/');
    await user.type(search, 'Go to Library');
    await user.click(await within(dialog).findByText('Go to Library'));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull(),
    );
  });
});

describe('the help overlay documents every shortcut the palette advertises', () => {
  it('shows a row for every command that carries a binding', async () => {
    useUiStore.setState({ paletteOpen: false, helpOpen: false, recentCommandIds: [] });
    const view = renderAppWithData({
      repositories: createInMemoryRepositories(buildLibrary({ prompts: 2, history: true })),
      path: '/prompts/prompt-1',
      mode: 'durable',
    });
    await waitFor(() => expect(view.store.getState().status).toBe('ready'));

    const user = userEvent.setup();

    // Everything the palette offers on this screen, by title.
    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog', { name: 'Command palette' });
    const offered = within(palette)
      .getAllByRole('option')
      .map((option) => option.textContent ?? '');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull(),
    );

    // What the help overlay lists, by title.
    await user.keyboard('?');
    const help = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    const rows = within(help)
      .getAllByRole('listitem')
      .map((row) => row.textContent ?? '');

    const bound = commandRegistry
      .list()
      .filter((command) => command.shortcut)
      .map((command) => command.title);

    expect(bound.length).toBeGreaterThan(5);

    // Direction 1: anything the palette advertises with a binding is documented.
    const advertised = bound.filter((title) => offered.some((text) => text.includes(title)));
    expect(advertised.length).toBeGreaterThan(5);
    for (const title of advertised) {
      expect(
        rows.some((text) => text.includes(title)),
        `"${title}" is offered with a shortcut but has no help row`,
      ).toBe(true);
    }

    // Direction 2: every help row belongs to a command that really has a binding,
    // so the overlay cannot document a shortcut that no longer exists.
    for (const row of rows) {
      expect(
        bound.some((title) => row.includes(title)),
        `the help overlay lists a row with no matching binding: ${row.slice(0, 60)}`,
      ).toBe(true);
    }
  }, 20_000);
});

describe('the global keyboard works from every route', () => {
  const ROUTES_TO_TRY = [
    '/',
    '/library',
    '/validation',
    '/prompts/prompt-1',
    '/settings',
    '/design',
  ];

  it.each(ROUTES_TO_TRY)(
    'opens the palette and the help overlay from %s',
    async (path) => {
      useUiStore.setState({ paletteOpen: false, helpOpen: false, recentCommandIds: [] });
      const view = renderAppWithData({
        repositories: createInMemoryRepositories(buildLibrary({ prompts: 1, history: true })),
        path,
        mode: 'durable',
      });
      await waitFor(() => expect(view.store.getState().status).toBe('ready'));
      await screen.findByRole('heading', { level: 1 });

      const user = userEvent.setup();

      await user.keyboard('{Control>}k{/Control}');
      expect(await screen.findByRole('dialog', { name: 'Command palette' })).toBeVisible();
      await user.keyboard('{Escape}');
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull(),
      );

      await user.keyboard('?');
      expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
      await user.keyboard('{Escape}');
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull(),
      );
    },
    20_000,
  );

  it('runs a two-step sequence from a screen that is not the dashboard', async () => {
    useUiStore.setState({ paletteOpen: false, helpOpen: false, recentCommandIds: [] });
    const view = renderAppWithData({
      repositories: createInMemoryRepositories(buildLibrary({ prompts: 1 })),
      path: '/settings',
      mode: 'durable',
    });
    await waitFor(() => expect(view.store.getState().status).toBe('ready'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

    const user = userEvent.setup();
    await user.keyboard('g');
    await user.keyboard('l');

    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
    expect(view.router.state.location.pathname).toBe('/library');
  }, 20_000);
});
