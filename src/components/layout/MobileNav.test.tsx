import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderAppAt } from '@/test/renderApp';

async function openDrawer() {
  const user = userEvent.setup();
  const result = renderAppAt('/');
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' });

  const trigger = screen.getByRole('button', { name: 'Open navigation' });
  await user.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: 'Navigation' });

  return { ...result, user, trigger, dialog };
}

describe('mobile navigation drawer', () => {
  it('opens with focus inside the drawer', async () => {
    const { dialog } = await openDrawer();

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('traps Tab inside the drawer', async () => {
    const { user, dialog } = await openDrawer();

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    for (let index = 0; index < 14; index += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('closes on Escape and returns focus to the menu button', async () => {
    const { user, dialog, trigger } = await openDrawer();

    expect(dialog).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes on the close button and returns focus to the menu button', async () => {
    const { user, trigger } = await openDrawer();

    await user.click(screen.getByRole('button', { name: 'Close panel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes on navigation and lets the new screen take focus', async () => {
    const { user, dialog } = await openDrawer();

    await user.click(within(dialog).getByRole('link', { name: 'Library' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Route focus wins over focus restoration when the drawer closes because of
    // a navigation; the menu button must not yank focus back.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('main')));
    expect(screen.getByRole('button', { name: 'Open navigation' })).not.toHaveFocus();
  });

  it('offers the same destinations as the desktop rail', async () => {
    const { dialog } = await openDrawer();
    const drawerNav = within(dialog).getByRole('navigation', { name: 'Workspace' });

    for (const label of ['Dashboard', 'Library', 'Composer', 'Templates', 'Validation', 'Health']) {
      expect(within(drawerNav).getByRole('link', { name: label })).toBeInTheDocument();
    }

    expect(within(drawerNav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('explains the keyboard model and the storage mode inside the drawer', async () => {
    const { dialog } = await openDrawer();

    expect(within(dialog).getByText(/moves through this drawer/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/session only/i)).toBeInTheDocument();
  });
});
