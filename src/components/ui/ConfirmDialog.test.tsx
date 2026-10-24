import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

function renderDialog(override: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();

  const utils = render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Archive this prompt?"
      description="Archived prompts can be restored at any time."
      confirmLabel="Archive prompt"
      onConfirm={onConfirm}
      {...override}
    />,
  );

  return { ...utils, onOpenChange, onConfirm };
}

describe('ConfirmDialog', () => {
  it('exposes a modal dialog with a labelled title and description', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Archive this prompt?' })).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription(/can be restored at any time/i);
  });

  it('calls onConfirm from the confirm button', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Archive prompt' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) from cancel without confirming', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onConfirm } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes on Escape for a non-destructive confirmation', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('moves focus into the dialog and restores it to the trigger on close', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Delete prompt
          </button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Delete prompt?"
            description="This removes the prompt and its revisions."
            confirmLabel="Delete"
            tone="destructive"
            onConfirm={() => setOpen(false)}
          />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Delete prompt' });
    await user.click(trigger);

    const confirm = await screen.findByRole('button', { name: 'Delete' });
    await user.click(confirm);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('requires the confirmation phrase before enabling the destructive action', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({
      tone: 'destructive',
      title: 'Clear the library?',
      confirmationPhrase: 'delete library',
      confirmLabel: 'Clear library',
    });

    const confirm = screen.getByRole('button', { name: 'Clear library' });
    expect(confirm).toBeDisabled();

    const input = screen.getByLabelText(/Type “delete library” to confirm/i);
    await user.type(input, 'delete librar');
    expect(confirm).toBeDisabled();

    await user.type(input, 'y');
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('ignores a wrong-case confirmation phrase', async () => {
    const user = userEvent.setup();
    renderDialog({
      tone: 'destructive',
      title: 'Clear the library?',
      confirmationPhrase: 'delete library',
      confirmLabel: 'Clear library',
    });

    await user.type(screen.getByLabelText(/to confirm/i), 'DELETE LIBRARY');
    expect(screen.getByRole('button', { name: 'Clear library' })).toBeDisabled();
  });

  it('does not dismiss a destructive confirmation by Escape or outside click', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog({ tone: 'destructive', title: 'Delete everything?' });

    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();

    // No close button is offered in the destructive variant either.
    expect(screen.queryByRole('button', { name: /close dialog/i })).not.toBeInTheDocument();
  });

  it('warns that destructive actions cannot be undone', () => {
    renderDialog({ tone: 'destructive', title: 'Delete prompt?' });
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('shows a pending state that blocks double submission', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onConfirm } = renderDialog({
      pending: true,
      confirmLabel: 'Archive prompt',
    });

    const confirm = screen.getByRole('button', { name: /archive prompt/i });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('resets the typed phrase when reopened', async () => {
    const user = userEvent.setup();
    const props = {
      onOpenChange: vi.fn(),
      onConfirm: vi.fn(),
      tone: 'destructive' as const,
      title: 'Clear the library?',
      description: 'Every prompt would be removed from this device.',
      confirmationPhrase: 'delete library',
      confirmLabel: 'Clear library',
    };

    const { rerender } = render(<ConfirmDialog open {...props} />);
    await user.type(screen.getByLabelText(/to confirm/i), 'delete library');
    expect(screen.getByRole('button', { name: 'Clear library' })).toBeEnabled();

    rerender(<ConfirmDialog open={false} {...props} />);
    rerender(<ConfirmDialog open {...props} />);

    expect(screen.getByLabelText(/to confirm/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Clear library' })).toBeDisabled();
  });
});
