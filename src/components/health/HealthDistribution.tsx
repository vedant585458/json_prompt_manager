import { Link } from 'react-router-dom';

import { DashboardSection, SectionEmpty } from '@/components/dashboard/DashboardSection';
import type { HealthDistribution as DistributionRow } from '@/domain/health';
import { cn } from '@/lib/cn';

export interface HealthDistributionProps {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly rows: readonly DistributionRow[];
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  /** Where a row goes, e.g. a filtered library view. */
  readonly hrefFor: (row: DistributionRow) => string;
  /** Counted separately from the rows, e.g. prompts in no collection. */
  readonly remainder?: { readonly label: string; readonly count: number; readonly href: string };
}

/**
 * Counts per collection or folder, as bars with a table (TASK-025).
 *
 * The bar is decoration over a number that is already text — it is
 * `aria-hidden`, the count is not — and the table beneath repeats the same
 * values with row and column headers so the distribution is available without
 * interpreting a bar. The scale is the largest row, stated in the caption, so
 * the bars cannot imply a comparison that is not there.
 */
export function HealthDistribution({
  id,
  title,
  description,
  rows,
  emptyTitle,
  emptyDescription,
  hrefFor,
  remainder,
}: HealthDistributionProps) {
  const max = rows.reduce((highest, row) => Math.max(highest, row.count), 0);

  return (
    <DashboardSection id={id} title={title} description={description}>
      {rows.length === 0 ? (
        <SectionEmpty title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="px-4 py-3 sm:px-5">
          <p className="text-2xs text-ink-muted">
            {max === 1 ? 'Every bar is one prompt.' : `The longest bar is ${max} prompts.`}
          </p>

          <ul className="mt-2 space-y-1.5">
            {rows.map((row) => (
              <li key={row.id} className="min-w-0">
                <Link
                  to={hrefFor(row)}
                  className="group flex min-w-0 items-center gap-3 rounded-xs px-1 py-1 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary group-hover:text-ink">
                    {row.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="hidden h-1.5 w-32 shrink-0 overflow-hidden rounded-pill bg-surface-3 sm:block"
                  >
                    <span
                      className="block h-full rounded-pill bg-accent"
                      style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right font-mono text-2xs tabular text-ink">
                    {row.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {remainder && remainder.count > 0 ? (
            <p className="mt-2 border-t border-line pt-2 text-2xs text-ink-muted">
              <Link
                to={remainder.href}
                className="rounded-xs font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {remainder.count} {remainder.label}
              </Link>{' '}
              — counted in the totals, not in the rows above.
            </p>
          ) : null}

          <table className="mt-3 w-full border-collapse text-left">
            <caption className="pb-1 text-left text-2xs text-ink-muted">
              The same counts as a table, with the share of the largest row.
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-1 pr-2 text-2xs font-medium text-ink-muted">
                  Group
                </th>
                <th
                  scope="col"
                  className="py-1 pr-2 text-right text-2xs font-medium text-ink-muted"
                >
                  Prompts
                </th>
                <th scope="col" className="py-1 text-right text-2xs font-medium text-ink-muted">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="py-1 pr-2 text-xs font-normal text-ink-secondary">
                    <Link
                      to={hrefFor(row)}
                      className="rounded-xs hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {row.label}
                    </Link>
                  </th>
                  <td className={cn('py-1 pr-2 text-right font-mono text-2xs tabular text-ink')}>
                    {row.count}
                  </td>
                  <td className="py-1 text-right font-mono text-2xs tabular text-ink-muted">
                    {Math.round((row.count / max) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardSection>
  );
}
