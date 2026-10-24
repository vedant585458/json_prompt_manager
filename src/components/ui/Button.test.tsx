import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';

describe('Button', () => {
  it('is a real button with an accessible name and click handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Create prompt</Button>);

    const button = screen.getByRole('button', { name: 'Create prompt' });
    expect(button).toHaveAttribute('type', 'button');

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps its label accessible while loading and blocks activation', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Saving prompt" onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not set aria-busy for a normal button', () => {
    render(<Button>Validate</Button>);
    expect(screen.getByRole('button', { name: 'Validate' })).not.toHaveAttribute('aria-busy');
  });

  it('marks decorative icon slots as hidden from assistive technology', () => {
    render(
      <Button
        leadingIcon={<span data-testid="lead">+</span>}
        trailingIcon={<span data-testid="trail">→</span>}
      >
        New prompt
      </Button>,
    );

    expect(screen.getByTestId('lead').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByTestId('trail').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'New prompt' })).toBeInTheDocument();
  });

  it('supports every variant and size without losing semantics', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button', { name: 'Primary' }).className).toContain('bg-accent-fill');

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button', { name: 'Danger' }).className).toContain('bg-danger-soft');

    rerender(
      <Button variant="ghost" size="lg">
        Ghost
      </Button>,
    );
    const ghost = screen.getByRole('button', { name: 'Ghost' });
    expect(ghost.className).toContain('h-11');
    expect(ghost).not.toBeDisabled();
  });

  it('is reachable and activatable with the keyboard', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save snapshot</Button>);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Save snapshot' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('IconButton', () => {
  it('exposes its label as the accessible name and hides the glyph', () => {
    render(
      <IconButton label="Search prompts">
        <svg data-testid="icon" />
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Search prompts' });
    expect(button).toHaveAttribute('title', 'Search prompts');
    expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('respects the disabled state', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <IconButton label="Delete prompt" disabled onClick={onClick}>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Delete prompt' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
