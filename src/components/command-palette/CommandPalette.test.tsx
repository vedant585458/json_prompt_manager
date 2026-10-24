import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { commandRegistry } from '@/lib/commands/registry';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useUiStore } from '@/store/uiStore';
import { renderAppAt } from '@/test/renderApp';

const disposers: (() => void)[] = [];

function registerTestCommand(
  overrides: Partial<Parameters<typeof commandRegistry.register>[0]> &
    Pick<Parameters<typeof commandRegistry.register>[0], 'id' | 'title'>,
) {
  const dispose = commandRegistry.register({
    group: 'General',
    run: () => undefined,
    ...overrides,
  });
  disposers.push(dispose);
  return dispose;
}

async function openAt(path: string) {
  const user = userEvent.setup();
  const result = renderAppAt(path);
  await screen.findByRole('heading', { level: 1 });
  return { ...result, user };
}

async function openPalette(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard('{Control>}k{/Control}');
  const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
  const search = within(dialog).getByRole('combobox', { name: 'Search commands' });
  return { dialog, search };
}

beforeEach(() => {
  useUiStore.setState({ paletteOpen: false, helpOpen: false, recentCommandIds: [] });
  usePreferencesStore.setState({ themePreference: 'system', resolvedTheme: 'dark' });
});

afterEach(() => {
  while (disposers.length > 0) disposers.pop()?.();
  useUiStore.setState({ paletteOpen: false, helpOpen: false, recentCommandIds: [] });
});

describe('command palette', () => {
  it('opens with Mod+K, focuses the search field, and lists grouped commands', async () => {
    const { user } = await openAt('/');
    const { dialog, search } = await openPalette(user);

    expect(search).toHaveFocus();
    expect(within(dialog).getByRole('listbox', { name: 'Commands' })).toBeInTheDocument();
    expect(within(dialog).getByText('Go to Library')).toBeInTheDocument();
    expect(within(dialog).getByText('Toggle dark and light theme')).toBeInTheDocument();

    // Groups come from the registry, and shortcut hints are platform-aware.
    expect(within(dialog).getByRole('group', { name: 'Navigation' })).toBeInTheDocument();
    expect(within(dialog).getAllByText('Ctrl').length).toBeGreaterThan(0);
  });

  it('filters as you type and runs the highlighted command with Enter', async () => {
    const { user } = await openAt('/');
    const { search } = await openPalette(user);

    await user.type(search, 'libr');
    expect(within(screen.getByRole('dialog')).getByText('Go to Library')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).queryByText('Go to Health')).toBeNull();

    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();

    const workspace = screen.getByRole('navigation', { name: 'Workspace' });
    expect(within(workspace).getByRole('link', { name: 'Library' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('moves the virtual selection with the arrow keys', async () => {
    const { user } = await openAt('/');
    const { dialog, search } = await openPalette(user);

    await user.type(search, 'go to');
    const listbox = within(dialog).getByRole('listbox', { name: 'Commands' });
    const options = within(listbox).getAllByRole('option');

    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    const firstSelectedId = search.getAttribute('aria-activedescendant');

    await user.keyboard('{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(search.getAttribute('aria-activedescendant')).not.toBe(firstSelectedId);

    await user.keyboard('{ArrowUp}');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  });

  it('closes on Escape and returns focus to the control that opened it', async () => {
    const { user } = await openAt('/');
    const trigger = screen.getByRole('button', { name: 'Search commands' });

    await user.click(trigger);
    await screen.findByRole('dialog', { name: 'Command palette' });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes with Mod+K when it is already open', async () => {
    const { user } = await openAt('/');
    await openPalette(user);

    await user.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('only lists commands that would actually run', async () => {
    registerTestCommand({
      id: 'test.unavailable',
      title: 'Unavailable test command',
      when: () => false,
    });
    const { user } = await openAt('/');
    const { dialog } = await openPalette(user);

    expect(within(dialog).queryByText('Unavailable test command')).toBeNull();
    // Features owned by later tasks are not registered yet.
    expect(within(dialog).queryByText('Save prompt')).toBeNull();
    expect(within(dialog).queryByText(/validate document/i)).toBeNull();
  });

  it('shows a helpful empty state instead of an empty list', async () => {
    const { user } = await openAt('/');
    const { search } = await openPalette(user);

    await user.type(search, 'zzzzzz');

    expect(screen.getByText('No commands match “zzzzzz”')).toBeInTheDocument();
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('executes a command once for a double activation', async () => {
    const run = vi.fn();
    registerTestCommand({ id: 'test.once', title: 'Run exactly once', run });

    const { user } = await openAt('/');
    const { dialog, search } = await openPalette(user);
    await user.type(search, 'exactly once');

    const option = within(dialog).getByRole('option', { name: /Run exactly once/ });
    act(() => {
      option.click();
      option.click();
    });

    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  });

  it('remembers recently used commands', async () => {
    const { user } = await openAt('/');
    const { dialog, search } = await openPalette(user);

    await user.type(search, 'libr');
    await user.keyboard('{Enter}');
    await screen.findByRole('heading', { level: 1, name: 'Library' });

    await user.keyboard('{Control>}k{/Control}');
    const reopened = await screen.findByRole('dialog', { name: 'Command palette' });

    expect(within(reopened).getByRole('group', { name: 'Recent' })).toBeInTheDocument();
    expect(within(reopened).getByText('Go to Library')).toBeInTheDocument();
    expect(dialog).not.toBeInTheDocument();
  });

  it('ignores page shortcuts while the palette search field has focus', async () => {
    const { user, router } = await openAt('/');
    const { search } = await openPalette(user);

    await user.type(search, 'g');
    expect(search).toHaveValue('g');
    expect(router.state.location.pathname).toBe('/');

    await user.keyboard('?');
    expect(search).toHaveValue('g?');
    expect(router.state.location.pathname).toBe('/');
    expect(useUiStore.getState().helpOpen).toBe(false);
  });
});

describe('global shortcuts', () => {
  it('runs two-step sequences and ignores mismatches', async () => {
    const { user } = await openAt('/');

    await user.keyboard('g');
    await user.keyboard('x');
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    await user.keyboard('g');
    await user.keyboard('l');
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
  });

  it('toggles the theme from the keyboard', async () => {
    const { user } = await openAt('/');

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await user.keyboard('{Control>}{Shift>}l{/Shift}{/Control}');
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));
  });

  it('does not fire while typing in a form field', async () => {
    const { user } = await openAt('/settings');
    const select = screen.getByLabelText('Autosave delay');
    act(() => select.focus());

    await user.keyboard('?');
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
    expect(useUiStore.getState().helpOpen).toBe(false);
  });

  it('ignores auto-repeated keydown events', async () => {
    const { user } = await openAt('/');
    const run = vi.fn();
    registerTestCommand({ id: 'test.repeat', title: 'Repeat guard', shortcut: 'Mod+Alt+R', run });

    // Two events for one physical press: the second carries repeat = true.
    await user.keyboard('{Control>}{Alt>}r{/Alt}{/Control}');
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, altKey: true, repeat: true }),
      );
    });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
