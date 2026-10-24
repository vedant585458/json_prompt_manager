import { Archive, Bookmark, Boxes, FileQuestion, History, Layers, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/cn';
import { libraryFilterHref, LIBRARY_FILTER_LABELS } from '@/lib/libraryLinks';
import type { DashboardCounts } from '@/store/dashboard';

interface StatDefinition {
  readonly key: keyof DashboardCounts;
  readonly label: string;
  readonly hint: string;
  readonly icon: LucideIcon;
  readonly to: string;
  /** Tints the number when the count is a problem rather than an inventory. */
  readonly alertWhenPositive?: boolean;
}

const STATS: readonly StatDefinition[] = [
  {
    key: 'total',
    label: 'Prompts',
    hint: 'in the library',
    icon: Layers,
    to: libraryFilterHref('all'),
  },
  {
    key: 'favorites',
    label: 'Favorites',
    hint: LIBRARY_FILTER_LABELS.favorites.toLowerCase(),
    icon: Bookmark,
    to: libraryFilterHref('favorites'),
  },
  {
    key: 'archived',
    label: 'Archived',
    hint: 'set aside',
    icon: Archive,
    to: libraryFilterHref('archived'),
  },
  {
    key: 'collections',
    label: 'Collections',
    hint: 'grouped sets',
    icon: Boxes,
    to: libraryFilterHref('collections'),
  },
  {
    key: 'snapshots',
    label: 'Snapshots',
    hint: 'saved revisions',
    icon: History,
    to: libraryFilterHref('snapshots'),
  },
  {
    key: 'schemaMismatches',
    label: 'Schema mismatch',
    hint: 'parse, but fail their schema',
    icon: ShieldAlert,
    to: '/validation',
    alertWhenPositive: true,
  },
  {
    key: 'invalidDocuments',
    label: 'Will not parse',
    hint: 'open validation',
    icon: FileQuestion,
    to: '/validation',
    alertWhenPositive: true,
  },
];

export interface StatStripProps {
  readonly counts: DashboardCounts;
  readonly className?: string;
}

/**
 * The dashboard's inventory (TASK-010).
 *
 * Each tile is a link into the view it counts, so a number is never a dead end.
 * The values come from `selectDashboardData`; nothing here is hard-coded. The
 * "will not parse" tile changes its wording as well as its colour when the
 * count is above zero, so the problem is not signalled by colour alone.
 */
export function StatStrip({ counts, className }: StatStripProps) {
  return (
    <ul className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7', className)}>
      {STATS.map((stat) => {
        const value = counts[stat.key];
        const alert = stat.alertWhenPositive === true && value > 0;
        const Icon = stat.icon;

        return (
          <li key={stat.key} className="min-w-0">
            <Link
              to={stat.to}
              className={cn(
                'group flex h-full flex-col gap-1 rounded-lg border bg-surface-1 px-3.5 py-3',
                'transition-colors duration-[var(--pf-duration-fast)]',
                'hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                alert ? 'border-danger/40' : 'border-line hover:border-line-strong',
              )}
            >
              <span className="flex items-center gap-1.5 text-ink-muted group-hover:text-ink-secondary">
                <Icon aria-hidden="true" size={13} strokeWidth={1.75} />
                <span className="metadata-rail">{stat.label}</span>
              </span>
              <span
                className={cn(
                  'font-display text-2xl leading-none tabular',
                  alert ? 'text-danger' : 'text-ink',
                )}
              >
                {value}
              </span>
              <span className="text-2xs leading-relaxed text-ink-muted">
                {alert
                  ? value === 1
                    ? 'document needs a fix'
                    : 'documents need a fix'
                  : stat.hint}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
