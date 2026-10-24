import type { ReactNode } from 'react';

import { SkeletonText } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

export type AsyncStatus = 'idle' | 'loading' | 'error' | 'success';

export interface AsyncBoundaryProps {
  status: AsyncStatus;
  children: ReactNode;
  /** Shown while loading; defaults to a text skeleton. */
  loadingFallback?: ReactNode;
  /** Error message to explain; rendered with a retry action when `onRetry` exists. */
  error?: string | null;
  /** Technical detail for the collapsed disclosure. */
  errorDetail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Rendered when status is success but there is no content worth showing. */
  isEmpty?: boolean;
  emptyFallback?: ReactNode;
}

/**
 * AsyncBoundary (TASK-004).
 *
 * A small declarative switch for the four states every data surface has. It is
 * not an error boundary: React render errors are caught by the app-level
 * boundary added in TASK-007. This handles *expected* async states only.
 */
export function AsyncBoundary({
  status,
  children,
  loadingFallback,
  error,
  errorDetail,
  onRetry,
  retryLabel = 'Try again',
  isEmpty = false,
  emptyFallback,
}: AsyncBoundaryProps) {
  if (status === 'loading') {
    return (
      <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading content">
        {loadingFallback ?? <SkeletonText lines={3} />}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div role="alert" className="rounded-md border border-danger/35 bg-danger-soft p-3">
        <p className="text-sm font-medium text-danger">{error ?? 'Something went wrong.'}</p>
        <p className="mt-1 text-xs text-ink-secondary">
          Your stored data has not been changed by this failure.
        </p>
        {errorDetail ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-2xs text-ink-muted">Technical details</summary>
            <pre className="editor-surface mt-1.5 max-h-32 whitespace-pre-wrap p-2 font-mono text-2xs text-ink-secondary">
              {errorDetail}
            </pre>
          </details>
        ) : null}
        {onRetry ? (
          <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  if (isEmpty && emptyFallback) return <>{emptyFallback}</>;

  return <>{children}</>;
}
