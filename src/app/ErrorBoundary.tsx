import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Called after the user resets the boundary. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : 'Unknown render failure.');
}

function technicalDetail(error: Error): string {
  const stack = error.stack ?? '(no stack trace)';
  return `${error.name}: ${error.message}\n\n${stack}`;
}

/**
 * Application error boundary (TASK-007).
 *
 * React render failures are not async state; they need a class boundary. The
 * recovery screen never guesses whether data was lost: it says what is known
 * (a screen failed), offers a reload and a reset, and keeps the stack behind a
 * disclosure for support. Nothing is written or deleted from here.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Console is the only sink: PromptForge never transmits diagnostics.
    console.error('PromptForge render error', error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  private readonly reload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
        <div className="w-full max-w-2xl">
          <p className="font-mono text-2xs tracking-[0.14em] text-ink-muted uppercase">
            PromptForge · Recovery
          </p>
          <h1 className="mt-2 font-display text-2xl leading-tight text-ink">
            This screen stopped responding
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">
            A part of the interface failed to render. Prompts already saved in this browser are
            still there — nothing is deleted by this screen. Reload to continue; if it happens
            again, the technical details below help track it down.
          </p>

          <ErrorState
            className="mt-5"
            title="Unexpected interface error"
            description="Reloading starts a clean session. Anything you had typed but not saved may be lost, so copy it out first if you can."
            action={
              <Button variant="primary" onClick={this.reload}>
                Reload page
              </Button>
            }
            secondaryAction={
              <Button variant="secondary" onClick={this.reset}>
                Try again
              </Button>
            }
            detail={technicalDetail(error)}
          />
        </div>
      </main>
    );
  }
}
