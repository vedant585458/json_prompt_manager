import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderAppAt } from '@/test/renderApp';

async function openAt(path: string, heading: string | RegExp) {
  const result = renderAppAt(path);
  await screen.findByRole('heading', { level: 1, name: heading });
  return result;
}

const ROUTES: readonly { path: string; heading: string }[] = [
  { path: '/', heading: 'Dashboard' },
  { path: '/library', heading: 'Library' },
  { path: '/prompts/prompt-1', heading: 'Prompt workspace' },
  { path: '/composer', heading: 'Composer' },
  { path: '/templates', heading: 'Templates' },
  { path: '/validation', heading: 'Validation' },
  { path: '/health', heading: 'Health' },
  { path: '/settings', heading: 'Settings' },
  { path: '/design', heading: 'Design system gallery' },
];

describe('router', () => {
  it.each(ROUTES)('renders $path without a runtime error', async ({ path, heading }) => {
    await openAt(path, heading);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('main')).toBeVisible();
  });

  it('keeps the shell around the unknown-route recovery screen', async () => {
    const user = userEvent.setup();
    await openAt('/not-a-real-screen', 'Nothing lives at this address');

    expect(screen.getByText('/not-a-real-screen')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    await user.click(screen.getByRole('link', { name: 'Back to dashboard' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  });

  it('marks the current destination with aria-current="page"', async () => {
    const user = userEvent.setup();
    await openAt('/', 'Dashboard');

    const workspace = screen.getByRole('navigation', { name: 'Workspace' });
    expect(within(workspace).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(workspace).getByRole('link', { name: 'Library' })).not.toHaveAttribute(
      'aria-current',
    );

    await user.click(within(workspace).getByRole('link', { name: 'Library' }));
    await screen.findByRole('heading', { level: 1, name: 'Library' });

    expect(within(workspace).getByRole('link', { name: 'Library' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(workspace).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    );

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('Library')).toHaveAttribute('aria-current', 'page');
  });

  it('names the document after the current route', async () => {
    const user = userEvent.setup();
    await openAt('/validation', 'Validation');

    expect(document.title).toBe('Validation · PromptForge');

    await user.click(
      within(screen.getByRole('navigation', { name: 'Workspace' })).getByRole('link', {
        name: 'Health',
      }),
    );
    await waitFor(() => expect(document.title).toBe('Health · PromptForge'));

    await user.click(
      within(screen.getByRole('navigation', { name: 'Workspace' })).getByRole('link', {
        name: 'Dashboard',
      }),
    );
    await waitFor(() => expect(document.title).toBe('Dashboard · PromptForge'));
  });

  it('keeps the chosen theme through navigation', async () => {
    const user = userEvent.setup();
    await openAt('/', 'Dashboard');

    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    await user.click(
      within(screen.getByRole('navigation', { name: 'Workspace' })).getByRole('link', {
        name: 'Templates',
      }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Templates' });

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers a skip link to the main landmark and does not steal focus on load', async () => {
    await openAt('/', 'Dashboard');

    const skipLink = screen.getByRole('link', { name: 'Skip to content' });
    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(document.activeElement).toBe(document.body);
  });

  it('moves focus to the main landmark after a navigation', async () => {
    const user = userEvent.setup();
    await openAt('/', 'Dashboard');

    await user.click(
      within(screen.getByRole('navigation', { name: 'Workspace' })).getByRole('link', {
        name: 'Composer',
      }),
    );

    const heading = await screen.findByRole('heading', { level: 1, name: 'Composer' });
    expect(heading).toBeVisible();
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it('collapses the desktop rail and remembers it across navigation', async () => {
    const user = userEvent.setup();
    await openAt('/', 'Dashboard');

    const toggle = screen.getByRole('button', { name: 'Collapse navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await user.click(
      within(screen.getByRole('navigation', { name: 'Workspace' })).getByRole('link', {
        name: 'Composer',
      }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Composer' });

    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
  });

  it('says when the requested prompt is not in the library', async () => {
    await openAt('/prompts/abc-123', 'Prompt workspace');

    expect(screen.getByText('This prompt is not in your library')).toBeInTheDocument();
    expect(screen.getByText(/abc-123/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the library' })).toHaveAttribute(
      'href',
      '/library',
    );
  });

  it('renders a breadcrumb trail that links ancestors, not the current page', async () => {
    await openAt('/prompts/abc-123', 'Prompt workspace');

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(breadcrumb).getByRole('link', { name: 'Library' })).toHaveAttribute(
      'href',
      '/library',
    );
    expect(within(breadcrumb).queryByRole('link', { name: 'Prompt' })).toBeNull();
  });

  it('exposes a working command palette trigger with a platform-aware hint', async () => {
    const user = userEvent.setup();
    await openAt('/', 'Dashboard');

    const trigger = screen.getByRole('button', { name: 'Search commands' });
    expect(trigger).toBeEnabled();
    // jsdom reports a non-Apple platform, so Mod renders as Control.
    expect(trigger).toHaveAttribute('aria-keyshortcuts', 'Control+K');
    // The dashboard header also shows the hint, so assert on the trigger itself.
    expect(within(trigger).getByText('Ctrl')).toBeInTheDocument();

    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
  });

  it('states the storage mode in words, not colour alone', async () => {
    await openAt('/', 'Dashboard');

    // jsdom has no IndexedDB, so the app must be honest about it.
    const badges = screen.getAllByText(/session only/i);
    expect(badges.length).toBeGreaterThan(0);
    expect(screen.getByRole('alert')).toHaveTextContent(/not being saved|memory/i);
  });
});

describe('router cleanup', () => {
  it('unmounts cleanly', async () => {
    const view = renderAppAt('/health');
    await screen.findByRole('heading', { level: 1, name: 'Health' });

    view.unmount();
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
