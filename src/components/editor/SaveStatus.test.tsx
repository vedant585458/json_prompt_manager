import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SaveStatus } from '@/components/editor/SaveStatus';

const AT = '2026-10-24T10:15:00.000Z';

function renderStatus(overrides: Partial<Parameters<typeof SaveStatus>[0]> = {}) {
  const props: Parameters<typeof SaveStatus>[0] = {
    state: 'clean',
    lastSavedAt: null,
    error: null,
    canSave: false,
    autosaveEnabled: true,
    onSave: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };

  return { ...render(<SaveStatus {...props} />), props };
}

describe('SaveStatus', () => {
  it('is a polite live region so a screen reader hears the transitions', () => {
    renderStatus();

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });

  it('says "Saving…" without claiming success', () => {
    renderStatus({ state: 'saving', canSave: false });

    expect(screen.getByText('Saving…')).toBeVisible();
    expect(screen.queryByText(/^Saved/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save now/ })).toBeDisabled();
  });

  it('shows when the last save landed', () => {
    renderStatus({ state: 'saved', lastSavedAt: AT });

    expect(screen.getByText(/^Saved at /)).toBeVisible();
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
  });

  it('marks unsaved changes and reflects the autosave setting', () => {
    renderStatus({ state: 'dirty', canSave: true });
    expect(screen.getByText('Unsaved changes')).toBeVisible();
    expect(screen.getByText('Autosave writes after you stop typing.')).toBeVisible();

    renderStatus({ state: 'dirty', autosaveEnabled: false });
    expect(screen.getByText(/Autosave is off\. Press/)).toBeVisible();
  });

  it('shows a failure with its detail and a retry action', async () => {
    const user = userEvent.setup();
    const { props } = renderStatus({
      state: 'error',
      error: { message: 'The prompt was not saved.', detail: 'Line 2, column 4: unexpected token' },
    });

    expect(screen.getByText('Not saved')).toBeVisible();
    expect(screen.getByText('The prompt was not saved.')).toBeVisible();
    expect(screen.getByText('Line 2, column 4: unexpected token')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('explains that saving is disabled in ephemeral mode', () => {
    renderStatus({ state: 'disabled' });

    expect(screen.getByText('Saving is off')).toBeVisible();
    expect(screen.getByText(/Storage did not open/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Save now/ })).toBeDisabled();
  });

  it('calls onSave from the explicit button when a save is possible', async () => {
    const user = userEvent.setup();
    const { props } = renderStatus({ state: 'dirty', canSave: true });

    await user.click(screen.getByRole('button', { name: /Save now/ }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });
});
