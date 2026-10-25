import { ChevronDown, Inbox } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { buttonVariants, Field, Select } from '@/components/ui';
import { ACTIVITY_LOG_LIMIT } from '@/domain/invariants';
import type { ActivityEvent } from '@/domain/types';
import { ACTIVITY_TYPES, ACTIVITY_TYPE_META } from '@/features/health/activityMeta';
import {
  ACTIVITY_PAGE_SIZE,
  ALL_ACTIVITY_TYPES,
  buildActivityView,
  describeActivityView,
  type ActivityTypeFilter,
} from '@/features/health/activityTimeline';
import { cn } from '@/lib/cn';
import { formatDateTime, formatRelativeTime } from '@/lib/dates';

const FILTER_OPTIONS: readonly { value: ActivityTypeFilter; label: string }[] = [
  { value: ALL_ACTIVITY_TYPES, label: 'All types' },
  ...ACTIVITY_TYPES.map((type) => ({ value: type, label: ACTIVITY_TYPE_META[type].label })),
];

export interface ActivityTimelineProps {
  readonly events: readonly ActivityEvent[];
  readonly now: Date;
}

/**
 * The stored activity log, newest first (TASK-025).
 *
 * Paging is "show more of the same ordering" rather than a second query, so
 * events cannot appear on two pages: the store already holds the capped log and
 * `buildActivityView` only ever extends a prefix of it. The cap is stated on the
 * screen because it is the reason a very old mutation is simply gone.
 */
export function ActivityTimeline({ events, now }: ActivityTimelineProps) {
  const [filter, setFilter] = useState<ActivityTypeFilter>(ALL_ACTIVITY_TYPES);
  const [pages, setPages] = useState(1);

  const view = buildActivityView({ events, filter, pages, now });
  const filterLabel =
    FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? 'All types';
  const filterDescription =
    filter === ALL_ACTIVITY_TYPES ? null : ACTIVITY_TYPE_META[filter].description;

  return (
    <DashboardSection
      id="health-activity"
      title="Activity timeline"
      description={`Every mutation recorded on this device, newest first. The log keeps the ${ACTIVITY_LOG_LIMIT} most recent events and prunes older ones when a new event is written.`}
    >
      {events.length === 0 ? (
        <div className="px-4 py-8 text-center sm:px-5">
          <span
            aria-hidden="true"
            className="mx-auto grid size-10 place-items-center rounded-md border border-line bg-surface-2 text-ink-muted"
          >
            <Inbox size={18} strokeWidth={1.5} />
          </span>
          <p className="mt-2 text-sm font-medium text-ink">No activity recorded yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">
            Creating, editing, snapshotting, or importing a prompt writes an event here. Nothing is
            seeded, so a new library honestly starts empty.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Link to="/composer" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
              Create a prompt
            </Link>
            <Link to="/library" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
              Open the library
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-5">
            <Field label="Event type" className="w-full sm:w-52">
              {(control) => (
                <Select
                  {...control}
                  size="sm"
                  options={FILTER_OPTIONS.map((option) => ({ ...option }))}
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value as ActivityTypeFilter);
                    setPages(1);
                  }}
                />
              )}
            </Field>
            <p aria-live="polite" className="text-2xs leading-relaxed text-ink-muted">
              {describeActivityView(view, filterLabel)}
            </p>
          </div>

          {filterDescription ? (
            <p className="border-b border-line px-4 py-2 text-2xs leading-relaxed text-ink-muted sm:px-5">
              {filterDescription}
            </p>
          ) : null}

          {view.total === 0 ? (
            <div className="px-4 py-6 sm:px-5">
              <p className="text-sm font-medium text-ink">No {filterLabel.toLowerCase()} events</p>
              <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-muted">
                The stored log holds {events.length} {events.length === 1 ? 'event' : 'events'},
                none of this type. Clearing the filter shows them all.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFilter(ALL_ACTIVITY_TYPES);
                  setPages(1);
                }}
                className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-3')}
              >
                Show all activity
              </button>
            </div>
          ) : (
            <div className="px-4 py-2 sm:px-5">
              {view.groups.map((group) => (
                <section key={group.day} className="py-2" aria-labelledby={`day-${group.day}`}>
                  <h3
                    id={`day-${group.day}`}
                    className="metadata-rail border-b border-line pb-1 text-ink-muted"
                  >
                    {group.label}
                  </h3>
                  <ol className="divide-y divide-line/70">
                    {group.events.map((event) => {
                      const meta = ACTIVITY_TYPE_META[event.type];
                      const Icon = meta.icon;

                      return (
                        <li key={event.id} className="flex min-w-0 items-start gap-2.5 py-2">
                          <span
                            aria-hidden="true"
                            className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border border-line bg-surface-2 text-ink-muted"
                          >
                            <Icon size={12} strokeWidth={1.75} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-relaxed text-ink-secondary">
                              <span className="sr-only">{meta.label}: </span>
                              {event.summary}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-ink-muted">
                              <span className="font-mono">{meta.label}</span>
                              <time
                                dateTime={event.createdAt}
                                title={formatDateTime(event.createdAt)}
                                className="font-mono"
                              >
                                {formatRelativeTime(event.createdAt, now)}
                              </time>
                              {event.promptId ? (
                                <Link
                                  to={`/prompts/${encodeURIComponent(event.promptId)}`}
                                  className="rounded-xs font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                >
                                  Open {event.promptTitle ?? 'prompt'}
                                </Link>
                              ) : (
                                <span>
                                  No prompt attached
                                  {event.promptTitle ? ` (was “${event.promptTitle}”)` : ''}
                                </span>
                              )}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}

          {view.hasMore ? (
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 sm:px-5">
              <p className="text-2xs text-ink-muted">
                {view.nextPageSize} more {view.nextPageSize === 1 ? 'event is' : 'events are'} on
                the next page.
              </p>
              <button
                type="button"
                onClick={() => setPages((current) => current + 1)}
                className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'gap-1.5')}
              >
                <ChevronDown aria-hidden="true" size={13} />
                Load {Math.min(ACTIVITY_PAGE_SIZE, view.total - view.visible)} older
              </button>
            </div>
          ) : null}
        </div>
      )}
    </DashboardSection>
  );
}
