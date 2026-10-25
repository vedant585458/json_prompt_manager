import { ArrowRight, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { DashboardSection, SectionEmpty } from '@/components/dashboard/DashboardSection';
import type { HealthPromptRef } from '@/domain/health';
import { cn } from '@/lib/cn';
import { formatDateTime, formatRelativeTime } from '@/lib/dates';

/** Rows shown before the list summarises the remainder. */
export const HEALTH_LIST_LIMIT = 6;

export interface HealthAttentionListProps {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly items: readonly HealthPromptRef[];
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  /** A real library filter for the whole list, when one exists. */
  readonly action?: { readonly label: string; readonly to: string };
  readonly now: Date;
  /** Extra query on the prompt link, e.g. `?panel=quality`. */
  readonly promptQuery?: string;
  readonly limit?: number;
}

/**
 * One metric's prompts, each linking to the exact record (TASK-025).
 *
 * Every row is a link to that prompt's editor — the list is a work queue, not a
 * report about anonymous numbers. The count beside the heading is the metric's
 * real total, so a truncated list can never be mistaken for the whole set.
 */
export function HealthAttentionList({
  id,
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
  action,
  now,
  promptQuery = '',
  limit = HEALTH_LIST_LIMIT,
}: HealthAttentionListProps) {
  const shown = items.slice(0, Math.max(0, limit));
  const hidden = items.length - shown.length;

  return (
    <DashboardSection
      id={id}
      title={title}
      description={description}
      {...(action ? { action } : {})}
    >
      {items.length === 0 ? (
        <SectionEmpty title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {shown.map((item) => (
              <li key={item.promptId} className="min-w-0">
                <Link
                  to={`/prompts/${encodeURIComponent(item.promptId)}${promptQuery}`}
                  className="group flex min-w-0 items-start gap-3 px-4 py-2.5 transition-colors duration-[var(--pf-duration-fast)] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-5"
                >
                  <AlertTriangle
                    aria-hidden="true"
                    size={13}
                    strokeWidth={1.75}
                    className="mt-0.5 shrink-0 text-ink-muted group-hover:text-ink-secondary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-2xs leading-relaxed text-ink-muted">
                      {item.detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-2xs tabular text-ink-secondary">
                      {item.count > 1 ? `×${item.count}` : ''}
                    </span>
                    <time
                      dateTime={item.updatedAt}
                      title={formatDateTime(item.updatedAt)}
                      className="mt-0.5 block font-mono text-2xs text-ink-muted"
                    >
                      {formatRelativeTime(item.updatedAt, now)}
                    </time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {hidden > 0 ? (
            <p className="border-t border-line px-4 py-2.5 text-2xs leading-relaxed text-ink-muted sm:px-5">
              {hidden} more {hidden === 1 ? 'prompt is' : 'prompts are'} counted above but not
              listed here.{' '}
              {action ? (
                <Link
                  to={action.to}
                  className="inline-flex items-center gap-0.5 rounded-xs font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {action.label}
                  <ArrowRight aria-hidden="true" size={11} />
                </Link>
              ) : null}
            </p>
          ) : null}
        </>
      )}
    </DashboardSection>
  );
}

/**
 * The untouched-prompt groups: one threshold each, oldest first.
 *
 * Cumulative on purpose — a prompt untouched for 95 days appears under 30, 60,
 * and 90 — and each group says so, because a reader who added the three numbers
 * would otherwise over-count.
 */
export interface StaleGroupsProps {
  readonly thresholds: {
    readonly attentionDays: number;
    readonly staleDays: number;
    readonly dormantDays: number;
  };
  readonly stale: {
    readonly attention: readonly HealthPromptRef[];
    readonly stale: readonly HealthPromptRef[];
    readonly dormant: readonly HealthPromptRef[];
  };
}

export function StaleGroups({ thresholds, stale }: StaleGroupsProps) {
  const groups = [
    {
      key: 'attention',
      id: 'health-stale-attention',
      title: `Untouched for ${thresholds.attentionDays} days`,
      items: stale.attention,
      empty: `Nothing active has gone ${thresholds.attentionDays} days without an edit.`,
    },
    {
      key: 'stale',
      id: 'health-stale',
      title: `Untouched for ${thresholds.staleDays} days`,
      items: stale.stale,
      empty: `Nothing active has gone ${thresholds.staleDays} days without an edit.`,
    },
    {
      key: 'dormant',
      id: 'health-dormant',
      title: `Untouched for ${thresholds.dormantDays} days`,
      items: stale.dormant,
      empty: `Nothing active has gone ${thresholds.dormantDays} days without an edit.`,
    },
  ] as const;

  return (
    <div className="grid gap-3 xl:grid-cols-3">
      {groups.map((group) => (
        <DashboardSection
          key={group.key}
          id={group.id}
          title={group.title}
          description="Oldest first. Counted in every threshold it passes."
        >
          {group.items.length === 0 ? (
            <div className="px-4 py-4 sm:px-5">
              <p className="text-xs leading-relaxed text-ink-muted">{group.empty}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {group.items.slice(0, HEALTH_LIST_LIMIT).map((item) => (
                <li key={item.promptId} className="min-w-0">
                  <Link
                    to={`/prompts/${encodeURIComponent(item.promptId)}`}
                    className="flex min-w-0 items-baseline justify-between gap-3 px-4 py-2 transition-colors duration-[var(--pf-duration-fast)] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-5"
                  >
                    <span className="min-w-0 truncate text-xs text-ink-secondary">
                      {item.title}
                    </span>
                    <span className="shrink-0 font-mono text-2xs tabular text-ink-muted">
                      {item.count}d
                    </span>
                  </Link>
                </li>
              ))}
              {group.items.length > HEALTH_LIST_LIMIT ? (
                <li className={cn('px-4 py-2 text-2xs text-ink-muted sm:px-5')}>
                  {group.items.length - HEALTH_LIST_LIMIT} more counted, not listed.
                </li>
              ) : null}
            </ul>
          )}
        </DashboardSection>
      ))}
    </div>
  );
}
