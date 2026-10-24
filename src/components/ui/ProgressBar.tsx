import { cn } from '@/lib/cn';

export interface ProgressBarProps {
  value: number;
  max?: number;
  /** Accessible name; the bar is meaningless without it. */
  label: string;
  /** Optional visible caption, e.g. "3 of 5 steps". */
  caption?: string;
  tone?: 'accent' | 'success' | 'neutral';
  className?: string;
}

/**
 * Progress bar (TASK-003).
 *
 * Reports determinate progress through `role="progressbar"`. Unknown progress
 * is intentionally not supported here; use a Spinner with a label instead.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  caption,
  tone = 'accent',
  className,
}: ProgressBarProps) {
  const clampedMax = max > 0 ? max : 100;
  const clampedValue = Math.min(Math.max(value, 0), clampedMax);
  const percent = Math.round((clampedValue / clampedMax) * 100);

  return (
    <div className={cn('w-full', className)}>
      {caption ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-xs text-ink-muted">{caption}</span>
          <span className="tabular font-mono text-2xs text-ink-secondary">{percent}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={clampedMax}
        aria-valuenow={clampedValue}
        aria-valuetext={`${percent}%`}
        className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-3"
      >
        <div
          className={cn(
            'h-full rounded-pill transition-[width] duration-[var(--pf-duration-base)] ease-[var(--pf-ease-out)]',
            tone === 'accent' && 'bg-accent',
            tone === 'success' && 'bg-success',
            tone === 'neutral' && 'bg-ink-muted',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
