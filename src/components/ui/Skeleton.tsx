import { cn } from '@/lib/cn';

export interface SkeletonProps {
  className?: string;
  /** Announced label; when omitted the skeleton is decorative. */
  label?: string;
}

/**
 * Skeleton (TASK-004).
 *
 * Shape only — it never implies real content. The shimmer is suppressed under
 * the reduced-motion guard in `global.css`, and it is hidden from assistive
 * technology unless a label is supplied.
 */
export function Skeleton({ className, label }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton h-3 w-full', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** A block of text lines sized to the real content they stand in for. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={index === lines - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  );
}

/** Card placeholder matching the library card rhythm. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-lg border border-line bg-surface-1 p-4', className)}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-4 w-14 rounded-pill" />
      </div>
      <SkeletonText lines={2} className="mt-3" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}
