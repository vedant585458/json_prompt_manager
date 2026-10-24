import type { LucideIcon } from 'lucide-react';
import { FileJson2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  title: string;
  /** Explain what belongs here and why it is empty. */
  description: string;
  /** A next action is mandatory: an empty state without a way forward is a dead end. */
  action: ReactNode;
  secondaryAction?: ReactNode;
  icon?: LucideIcon;
  className?: string;
  /** Denser variant for panels and inspectors. */
  compact?: boolean;
}

/**
 * Empty state (TASK-004).
 *
 * The signature intentionally requires `action`, so no surface can ship a
 * decorative "nothing here" screen with no way to proceed.
 */
export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  icon: Icon = FileJson2,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-line text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid place-items-center rounded-md border border-line bg-surface-2 text-ink-muted',
          compact ? 'size-8' : 'size-11',
        )}
      >
        <Icon size={compact ? 16 : 20} strokeWidth={1.5} />
      </span>
      <div className="max-w-sm">
        <p className={cn('font-medium text-ink', compact ? 'text-sm' : 'text-md')}>{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {action}
        {secondaryAction}
      </div>
    </div>
  );
}
