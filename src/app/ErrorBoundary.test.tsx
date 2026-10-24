import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from '@/app/ErrorBoundary';

let shouldThrow = true;

function Faulty({ message }: { message: string }) {
  if (shouldThrow) throw new Error(message);
  return <p>Recovered content</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    // React logs caught render errors; the boundary logs them too. Keep the
    // suite output readable while still asserting the call happens.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the recovery screen instead of the failed children', () => {
    render(
      <ErrorBoundary>
        <Faulty message="Exploded while rendering" />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'This screen stopped responding' })).toBeVisible();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Unexpected interface error')).toBeInTheDocument();
    expect(screen.queryByText('Recovered content')).not.toBeInTheDocument();
  });

  it('keeps the technical detail behind a disclosure', () => {
    render(
      <ErrorBoundary>
        <Faulty message="Exploded while rendering" />
      </ErrorBoundary>,
    );

    const summary = screen.getByText('Technical details');
    expect(summary.tagName).toBe('SUMMARY');
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain('Exploded while rendering');
    expect(details?.textContent).toContain('Error:');
  });

  it('logs the failure locally and never claims data was lost', () => {
    render(
      <ErrorBoundary>
        <Faulty message="Exploded while rendering" />
      </ErrorBoundary>,
    );

    expect(console.error).toHaveBeenCalled();
    expect(screen.getByText(/still there/i)).toBeInTheDocument();
    expect(screen.queryByText(/your data was deleted/i)).not.toBeInTheDocument();
  });

  it('recovers when the user retries and the next render succeeds', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(
      <ErrorBoundary onReset={onReset}>
        <Faulty message="Exploded once" />
      </ErrorBoundary>,
    );

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Recovered content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers a reload that is a real action', () => {
    render(
      <ErrorBoundary>
        <Faulty message="Exploded while rendering" />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: 'Reload page' })).toHaveAttribute('type', 'button');
  });
});
