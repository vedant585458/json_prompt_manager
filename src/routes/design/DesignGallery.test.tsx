import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { App } from '@/app/App';
import { ThemeProvider } from '@/app/providers/ThemeProvider';

/**
 * The gallery is the app root, so it now boots the data layer (TASK-007):
 * storage probe, seed, hydration. Rendering is therefore asynchronous, and
 * these tests wait for the first heading before asserting.
 */
async function renderGallery() {
  const utils = render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Design system gallery' });
  return utils;
}

describe('Design gallery', () => {
  it('renders every primitive section with a single page heading', async () => {
    await renderGallery();

    expect(screen.getByRole('heading', { level: 1, name: 'Design system gallery' })).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    for (const heading of [
      'Buttons',
      'Fields and text entry',
      'Selection controls',
      'Badges, status, and progress',
      'Surfaces and cards',
      'Tabs, tooltips, and keyboard hints',
      'Composed specimen',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
  });

  it('shows all button variants, sizes, and states', async () => {
    await renderGallery();

    // Some labels also appear in overlay demos, so assert presence, not uniqueness.
    for (const name of [
      'Create prompt',
      'Import JSON',
      'Cancel',
      'Delete',
      'Small',
      'Medium',
      'Large',
      'New prompt',
      'Save snapshot',
      'Saving',
      'Disabled',
      'Archive',
    ]) {
      expect(screen.getAllByRole('button', { name }).length).toBeGreaterThan(0);
    }
    const savingButton = screen.getByRole('button', { name: 'Saving' });
    expect(savingButton).toBeDisabled();
    expect(savingButton).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('status').some((node) => node.textContent === 'Saving prompt')).toBe(
      true,
    );
  });

  it('demonstrates an invalid field and preserves the typed value', async () => {
    const user = userEvent.setup();
    await renderGallery();

    const input = screen.getByLabelText(/Prompt name/);
    await user.type(input, 'Structured extraction');
    await user.click(screen.getByRole('button', { name: 'Validate name' }));

    expect(input).toHaveValue('Structured extraction');
    expect(input).not.toHaveAttribute('aria-invalid');

    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Validate name' }));

    expect(screen.getByText('A prompt name is required.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveValue('');
  });

  it('keeps every form control reachable by its label', async () => {
    await renderGallery();

    expect(screen.getByLabelText(/Prompt name/)).toBeInTheDocument();
    expect(screen.getByLabelText('Output format')).toBeInTheDocument();
    expect(screen.getByLabelText('Document preview')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Include metadata/ })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Autosave changes' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Pin this prompt' })).toBeInTheDocument();
  });

  it('exercises the composed specimen with real state', async () => {
    const user = userEvent.setup();
    await renderGallery();

    const specimen = screen.getByRole('heading', { level: 2, name: 'Composed specimen' })
      .parentElement as HTMLElement;
    expect(within(specimen).getByText(/No snapshots yet/)).toBeInTheDocument();

    const addButton = within(specimen).getByRole('button', { name: 'Add snapshot' });
    await user.click(addButton);
    await user.click(addButton);

    expect(within(specimen).getAllByRole('listitem')).toHaveLength(2);
    expect(within(specimen).queryByText(/No snapshots yet/)).not.toBeInTheDocument();

    await user.click(within(specimen).getByRole('button', { name: 'Remove Snapshot 1' }));
    expect(within(specimen).getAllByRole('listitem')).toHaveLength(1);
  });

  it('renders in both themes without console warnings', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await renderGallery();

    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });
});
