import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { commandRegistry } from '@/lib/commands/registry';
import { useUiStore } from '@/store/uiStore';
import { renderAppAt } from '@/test/renderApp';

const disposers: (() => void)[] = [];

function register(overrides: {
  id: string;
  title: string;
  shortcut?: string;
  when?: (context: { dev: boolean }) => boolean;
}) {
  const dispose = commandRegistry.register({
    group: 'General',
    run: vi.fn(),
    when: overrides.when as never,
    ...overrides,
  });
  disposers.push(dispose);
}

async function openApp(path = '/') {
  const user = userEvent.setup();
  const result = renderAppAt(path);
  await screen.findByRole('heading', { level: 1 });
  return { ...result, user };
}

beforeEach(() => {
  useUiStore.setState({ paletteOpen: false, helpOpen: false });
});

afterEach(() => {
  while (disposers.length > 0) disposers.pop()?.();
  useUiStore.setState({ paletteOpen: false, helpOpen: false });
});

describe('shortcut help overlay', () => {
  it('opens with ? and lists shortcuts generated from the registry', async () => {
    const { user } = await openApp('/');

    await user.keyboard('?');
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });

    expect(within(dialog).getByText('Open the command palette')).toBeInTheDocument();
    expect(within(dialog).getByText('Toggle the navigation rail')).toBeInTheDocument();
    // The palette's own binding is rendered as platform tokens.
    expect(within(dialog).getAllByText('Ctrl').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('K').length).toBeGreaterThan(0);
    // Sequences are spelled out.
    expect(within(dialog).getAllByText('then').length).toBeGreaterThan(0);
  });

  it('includes commands registered by other features', async () => {
    register({ id: 'test.custom', title: 'Custom feature command', shortcut: 'Mod+Alt+Y' });
    const { user } = await openApp('/');

    await user.keyboard('?');
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });

    expect(within(dialog).getByText('Custom feature command')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Alt').length).toBeGreaterThan(0);
  });

  it('omits unavailable commands and those without shortcuts', async () => {
    register({
      id: 'test.hidden',
      title: 'Unavailable command',
      shortcut: 'Mod+Alt+U',
      when: () => false,
    });
    const { user } = await openApp('/');

    await user.keyboard('?');
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });

    expect(within(dialog).queryByText('Unavailable command')).toBeNull();
    // The dev gallery command has no shortcut, so it is not a shortcut entry.
    expect(within(dialog).queryByText('Open the design system gallery')).toBeNull();
  });

  it('opens from the top bar and returns focus to it on close', async () => {
    const { user } = await openApp('/');
    const trigger = screen.getByRole('button', { name: 'Keyboard shortcuts' });

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes with Escape', async () => {
    const { user } = await openApp('/');

    await user.keyboard('?');
    await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('does not open while the palette owns the keyboard', async () => {
    const { user } = await openApp('/');

    await user.keyboard('{Control>}k{/Control}');
    await screen.findByRole('dialog', { name: 'Command palette' });

    await user.keyboard('?');
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
    expect(useUiStore.getState().helpOpen).toBe(false);
  });
});
