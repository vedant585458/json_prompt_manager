import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Sheet } from '@/components/ui/Sheet';

function DialogHarness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open settings</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Prompt settings"
          description="Metadata used by the library and search."
          dismissible={dismissible}
          footer={<Button variant="primary">Apply</Button>}
        >
          <p>Dialog body content</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('is hidden until opened and then exposes a modal dialog with a title', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open settings' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Prompt settings' })).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription(/metadata used by the library/i);
  });

  it('traps focus inside the dialog', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'Open settings' }));

    await screen.findByRole('dialog');
    for (let index = 0; index < 6; index += 1) {
      await user.tab();
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('restores focus to the trigger after closing', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Open settings' });

    await user.click(trigger);
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes on Escape when dismissible', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on an overlay click when dismissible', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await screen.findByRole('dialog');

    const overlays = document.querySelectorAll('[data-state="open"][class*="inset-0"]');
    expect(overlays.length).toBeGreaterThan(0);
    await user.click(overlays[0] as HTMLElement);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('refuses to close on Escape when not dismissible', async () => {
    const user = userEvent.setup();
    render(<DialogHarness dismissible={false} />);

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('Sheet', () => {
  it('renders a labelled panel with its own scroll region and footer', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open inspector</Button>
          <Sheet
            open={open}
            onOpenChange={setOpen}
            title="Inspector"
            description="Validation and variables"
            footer={<Button variant="primary">Apply</Button>}
          >
            <p>Sheet body</p>
          </Sheet>
        </>
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open inspector' }));

    const dialog = await screen.findByRole('dialog');
    expect(screen.getByRole('heading', { name: 'Inspector' })).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription(/validation and variables/i);
    expect(screen.getByText('Sheet body')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the right-side sheet with mobile bottom-sheet classes', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open</Button>
          <Sheet open={open} onOpenChange={setOpen} title="Panel">
            <p>Body</p>
          </Sheet>
        </>
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog.className).toContain('right-0');
    expect(dialog.className).toContain('max-sm:bottom-0');
    expect(dialog.className).toContain('max-sm:rounded-t-lg');
  });
});
