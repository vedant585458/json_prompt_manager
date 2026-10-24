import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/cn';

export interface DashboardSectionProps {
  /** Used for the heading id and, when set, as an anchor target. */
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly action?: { readonly label: string; readonly to: string };
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Shared card shell for dashboard sections (TASK-010).
 *
 * Every section is a labelled `section` with an `h2`, so screen-reader users can
 * jump between them, and the optional action is always a real link to a real
 * route rather than a decorative "View all" button.
 */
export function DashboardSection({
  id,
  title,
  description,
  action,
  className,
  children,
}: DashboardSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('overflow-hidden rounded-lg border border-line bg-surface-1', className)}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-sm font-semibold text-ink">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>
          ) : null}
        </div>
        {action ? (
          <Link
            to={action.to}
            className="inline-flex shrink-0 items-center gap-1 rounded-xs text-xs font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {action.label}
            <ArrowRight aria-hidden="true" size={13} />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Small, consistent "nothing here yet" body used by list sections. */
export function SectionEmpty({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: { readonly label: string; readonly to: string };
}) {
  return (
    <div className="px-4 py-6 sm:px-5">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-muted">{description}</p>
      {action ? (
        <Link
          to={action.to}
          className="mt-3 inline-flex items-center gap-1 rounded-xs text-xs font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {action.label}
          <ArrowRight aria-hidden="true" size={13} />
        </Link>
      ) : null}
    </div>
  );
}
