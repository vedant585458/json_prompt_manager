import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Alert, InlineError } from '@/components/ui/Alert';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu';

describe('EmptyState', () => {
  it('always renders a next action and an explanation', () => {
    render(
      <EmptyState
        title="No prompts yet"
        description="Create your first prompt or start from a template."
        action={<Button>Create prompt</Button>}
        secondaryAction={<Button variant="ghost">Browse templates</Button>}
      />,
    );

    expect(screen.getByText('No prompts yet')).toBeInTheDocument();
    expect(screen.getByText(/start from a template/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create prompt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse templates' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('oﬀers recovery and keeps technical detail collapsed', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <ErrorState
        title="Could not load prompts"
        description="Your data is still on this device."
        detail="QuotaExceededError: storage full"
        action={<Button onClick={onRetry}>Retry</Button>}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load prompts');
    expect(screen.getByText(/still on this device/i)).toBeInTheDocument();

    const disclosure = screen.getByText('Technical details');
    expect(disclosure.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText(/QuotaExceededError/)).toBeInTheDocument();

    await user.click(disclosure);
    expect(await user.click(screen.getByRole('button', { name: 'Retry' }))).toBeUndefined();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('Alert and InlineError', () => {
  it('pairs the tone with an icon and an optional dismiss action', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(
      <Alert tone="warning" title="Schema not attached" onDismiss={onDismiss}>
        Validation is limited to JSON syntax.
      </Alert>,
    );

    const alert = screen.getByText('Schema not attached').closest('div[class*="border"]');
    expect(alert?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('can announce blocking errors assertively', () => {
    render(
      <Alert tone="danger" title="Storage unavailable" live="assertive">
        Changes cannot be saved.
      </Alert>,
    );

    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('renders field-level error text', () => {
    render(<InlineError>Description is required.</InlineError>);
    expect(screen.getByText('Description is required.')).toBeInTheDocument();
  });
});

describe('AsyncBoundary', () => {
  it('announces loading state without rendering the children', () => {
    render(
      <AsyncBoundary status="loading">
        <p>Loaded content</p>
      </AsyncBoundary>,
    );

    expect(screen.getByRole('status', { name: 'Loading content' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.queryByText('Loaded content')).not.toBeInTheDocument();
  });

  it('renders an error with a retry action and detail disclosure', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <AsyncBoundary
        status="error"
        error="Could not load revisions."
        errorDetail="StaleWriteError: version 4"
        onRetry={onRetry}
      >
        <p>Never shown</p>
      </AsyncBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load revisions.');
    expect(screen.getByText(/stored data has not been changed/i)).toBeInTheDocument();
    expect(screen.getByText(/StaleWriteError/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('defers to a provided empty fallback and otherwise renders children', () => {
    const { rerender } = render(
      <AsyncBoundary status="success" isEmpty emptyFallback={<p>Nothing here yet</p>}>
        <p>Content</p>
      </AsyncBoundary>,
    );
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();

    rerender(
      <AsyncBoundary status="success">
        <p>Content</p>
      </AsyncBoundary>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('is decorative by default and labelled when asked', () => {
    const { rerender } = render(<Skeleton />);
    expect(document.querySelector('.skeleton')).toHaveAttribute('aria-hidden', 'true');

    rerender(<Skeleton label="Loading prompt list" />);
    expect(screen.getByRole('status', { name: 'Loading prompt list' })).toBeInTheDocument();
  });

  it('renders text and card placeholders hidden from assistive technology', () => {
    const { container } = render(
      <>
        <SkeletonText lines={3} />
        <SkeletonCard />
      </>,
    );
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('DropdownMenu', () => {
  it('opens from the keyboard and exposes menu items', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onDelete = vi.fn();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Row actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onOpen}>Open in editor</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={onDelete}>
            Delete prompt
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole('button', { name: 'Row actions' });
    trigger.focus();
    await user.keyboard('{Enter}');

    const menu = await screen.findByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);

    await user.click(screen.getByRole('menuitem', { name: 'Open in editor' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    await waitForRemoval();
  });

  async function waitForRemoval() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
});

describe('ContextMenu', () => {
  it('opens with the keyboard context-menu key and runs an action', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();

    render(
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div tabIndex={0} data-testid="card">
            Prompt card
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onCopy}>Copy JSON path</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );

    const trigger = screen.getByTestId('card');
    trigger.focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');

    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Copy JSON path' }));

    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});
