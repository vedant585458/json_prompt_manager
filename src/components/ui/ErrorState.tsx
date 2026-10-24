import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface ErrorStateProps {
  title: string;
  /** Plain-language explanation: what failed and what it means for the user's data. */
  description: string;
  /** Recovery action, e.g. retry, reload, or export a backup. */
  action: ReactNode;
  secondaryAction?: ReactNode;
  /**
   * Technical detail (error message, stack, or code). Rendered inside a
   * disclosure so it is available for support without intimidating the user.
   */
  detail?: string;
  className?: string;
  compact?: boolean;
}

/**
 * Error state (TASK-004).
 *
 * Always explains the failure, always offers recovery, and never exposes a
 * blank screen. Technical detail is available but collapsed by default.
 */
export function ErrorState({
  title,
  description,
  action,
  secondaryAction,
  detail,
  className,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start rounded-lg border border-danger/35 bg-danger-soft text-left',
        compact ? 'gap-2 p-3' : 'gap-3 p-6',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" size={compact ? 16 : 18} className="mt-0.5 text-danger" />
        <div className="min-w-0">
          <p className={cn('font-medium text-danger', compact ? 'text-sm' : 'text-md')}>{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-7">
        {action}
        {secondaryAction}
      </div>

      {detail ? (
        <details className="w-full pl-0 sm:pl-7">
          <summary className="cursor-pointer text-2xs font-medium text-ink-muted hover:text-ink-secondary">
            Technical details
          </summary>
          <pre className="editor-surface mt-2 max-h-40 whitespace-pre-wrap p-2 font-mono text-2xs text-ink-secondary">
            {detail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
