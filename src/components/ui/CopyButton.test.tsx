import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CopyButton, CopyIconButton } from '@/components/ui/CopyButton';

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
});

/**
 * userEvent.setup() installs its own clipboard stub, so the spy must be
 * installed afterwards to observe the real component behavior.
 */
function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  return user;
}

afterEach(() => {
  // Remove the fake clipboard so other suites see the real (absent) API.
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
});

describe('CopyButton', () => {
  it('writes the value and confirms success in a live region', async () => {
    const user = setupUser();
    render(<CopyButton value={'{"role":"reviewer"}'} label="Copy document" />);

    await user.click(screen.getByRole('button', { name: 'Copy document' }));

    expect(writeText).toHaveBeenCalledWith('{"role":"reviewer"}');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByText('Copied to clipboard')).toBeInTheDocument();
  });

  it('reports failure instead of claiming success', async () => {
    const user = setupUser();
    writeText.mockRejectedValue(new Error('denied'));
    render(<CopyButton value="secret" label="Copy" />);

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => {
      expect(screen.getByText('Copy failed — clipboard unavailable')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('reports failure when the clipboard API is missing', async () => {
    const user = setupUser();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    render(<CopyButton value="text" label="Copy" />);

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => {
      expect(screen.getByText('Copy failed — clipboard unavailable')).toBeInTheDocument();
    });
  });

  it('invokes the onCopied callback only after a successful write', async () => {
    const user = setupUser();
    const onCopied = vi.fn();
    render(<CopyButton value="text" label="Copy" onCopied={onCopied} />);

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(onCopied).toHaveBeenCalledTimes(1));
  });

  it('updates the icon-only variant accessible name after copying', async () => {
    const user = setupUser();
    render(<CopyIconButton value="promptforge.theme" label="Copy storage key" />);

    await user.click(screen.getByRole('button', { name: 'Copy storage key' }));

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith('promptforge.theme');
  });
});
