import { describePointer } from '@/domain/diff';
import type { DiffPathSegment } from '@/domain/diff';
import { cn } from '@/lib/cn';

export interface DiffPathBreadcrumbProps {
  readonly segments: readonly DiffPathSegment[];
  readonly className?: string;
}

/**
 * The path of one change, as a breadcrumb (TASK-020).
 *
 * Segments are not links: there is no document tree to navigate to yet, and a
 * breadcrumb that looks clickable but does nothing is worse than plain text.
 * The concrete form (`document › instructions › 2`) is what the copy button and
 * the tests use; the RFC 6901 pointer is shown separately wherever it matters.
 */
export function DiffPathBreadcrumb({ segments, className }: DiffPathBreadcrumbProps) {
  return (
    <nav aria-label="Change path" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 font-mono text-2xs text-ink-muted">
        {segments.length === 0 ? (
          <li aria-current="page" className="text-ink">
            document
          </li>
        ) : (
          segments.map((segment, index) => {
            const last = index === segments.length - 1;
            return (
              <li key={`${index}-${String(segment)}`} className="flex min-w-0 items-center gap-1">
                {index > 0 ? <span aria-hidden="true">›</span> : null}
                <span
                  aria-current={last ? 'page' : undefined}
                  className={cn(
                    'truncate',
                    last ? 'text-ink' : 'text-ink-muted',
                    typeof segment === 'number' && 'text-accent',
                  )}
                  title={describePointer([segment])}
                >
                  {String(segment)}
                </span>
              </li>
            );
          })
        )}
      </ol>
    </nav>
  );
}
