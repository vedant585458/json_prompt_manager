import { cn } from '@/lib/cn';
import { crumbsForPath } from '@/components/layout/navigation';
import { Link, useLocation } from 'react-router-dom';

/**
 * Breadcrumbs (TASK-008).
 *
 * The final crumb is plain text with `aria-current="page"` — it is the page you
 * are on, so it is not a link back to itself. Ancestors are links.
 */
export function Breadcrumbs({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const crumbs = crumbsForPath(pathname);

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-xs">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <span aria-hidden="true" className="text-ink-muted">
                  /
                </span>
              ) : null}
              {crumb.to && !isLast ? (
                <Link
                  to={crumb.to}
                  className="truncate rounded-xs text-ink-muted transition-colors duration-[var(--pf-duration-fast)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="truncate text-ink-secondary"
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
