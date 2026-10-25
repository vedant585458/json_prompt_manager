/**
 * The activity timeline's ordering, filtering, grouping, and paging (TASK-025).
 *
 * Pure and total: the log is untrusted input (a hand-edited row, or a record
 * written by an older build), so an unreadable timestamp drops an event out of
 * the day groups instead of producing an `Invalid Date` heading.
 *
 * Paging is a *limit* over one stable ordering, not an offset query. The store
 * holds the capped log (`ACTIVITY_LOG_LIMIT`, 500 events) in memory, so asking
 * for "the next page" can only mean "show more of the same list" — and that is
 * exactly what cannot duplicate a row: every page is a prefix of the previous
 * ordering, keyed by event id.
 */

import { capActivityLog } from '@/domain/invariants';
import type { ActivityEvent, ActivityType } from '@/domain/types';
import { formatLongDate, toIsoDay } from '@/lib/dates';

/** How many events one page adds. */
export const ACTIVITY_PAGE_SIZE = 20;

/** The filter value for "no type filter". */
export const ALL_ACTIVITY_TYPES = 'all';

export type ActivityTypeFilter = ActivityType | typeof ALL_ACTIVITY_TYPES;

export interface ActivityDayGroup {
  /** UTC day key, `2026-10-25`. Stable for a given timestamp. */
  readonly day: string;
  /** `25 October 2026`, or `Today` / `Yesterday` relative to the report clock. */
  readonly label: string;
  readonly events: readonly ActivityEvent[];
}

export interface ActivityView {
  readonly filter: ActivityTypeFilter;
  /** Events of this type in the whole log, before paging. */
  readonly total: number;
  /** How many are on screen right now. */
  readonly visible: number;
  /** True when the log holds more events of this type than are shown. */
  readonly hasMore: boolean;
  /** The visible events, newest first. */
  readonly events: readonly ActivityEvent[];
  /** The visible events, grouped by UTC day. */
  readonly groups: readonly ActivityDayGroup[];
  /** What the next page would add, or 0 when the list is complete. */
  readonly nextPageSize: number;
}

/**
 * The whole log in display order: newest first, id as tie-breaker.
 *
 * Delegates to `capActivityLog` so the timeline and the stored log can never
 * order the same events differently.
 */
export function orderActivity(events: readonly ActivityEvent[]): ActivityEvent[] {
  return capActivityLog(events, events.length);
}

export function filterActivityByType(
  events: readonly ActivityEvent[],
  filter: ActivityTypeFilter,
): ActivityEvent[] {
  if (filter === ALL_ACTIVITY_TYPES) return [...events];
  return events.filter((event) => event.type === filter);
}

/** `Today` / `Yesterday` / a long date, compared in UTC. */
export function activityDayLabel(day: string, now: Date): string {
  const today = toIsoDay(now);
  if (day === today) return 'Today';

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (day === toIsoDay(yesterday)) return 'Yesterday';

  const parsed = new Date(`${day}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? day : formatLongDate(parsed);
}

/**
 * Groups ordered events by UTC day.
 *
 * UTC rather than the reader's zone on purpose: the day a mutation happened is
 * a property of the record, and a heading that shifted with the laptop's
 * timezone would disagree with the stored timestamp beside it.
 */
export function groupActivityByDay(
  events: readonly ActivityEvent[],
  now: Date,
): ActivityDayGroup[] {
  const groups: { day: string; events: ActivityEvent[] }[] = [];

  for (const event of events) {
    const time = Date.parse(event.createdAt);
    if (Number.isNaN(time)) continue;

    const day = toIsoDay(new Date(time));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.events.push(event);
    else groups.push({ day, events: [event] });
  }

  return groups.map((group) => ({
    day: group.day,
    label: activityDayLabel(group.day, now),
    events: group.events,
  }));
}

export interface ActivityViewInput {
  readonly events: readonly ActivityEvent[];
  readonly filter?: ActivityTypeFilter;
  /** How many pages are on screen; 1 shows the newest `page * ACTIVITY_PAGE_SIZE`. */
  readonly pages?: number;
  readonly pageSize?: number;
  readonly now: Date;
}

/** Everything the timeline renders, in one pass. */
export function buildActivityView(input: ActivityViewInput): ActivityView {
  const filter = input.filter ?? ALL_ACTIVITY_TYPES;
  const pageSize = Math.max(1, input.pageSize ?? ACTIVITY_PAGE_SIZE);
  const pages = Math.max(1, Math.floor(input.pages ?? 1));

  const ordered = orderActivity(input.events);
  const filtered = filterActivityByType(ordered, filter);
  const limit = pages * pageSize;
  const events = filtered.slice(0, limit);

  return {
    filter,
    total: filtered.length,
    visible: events.length,
    hasMore: filtered.length > events.length,
    events,
    groups: groupActivityByDay(events, input.now),
    nextPageSize: Math.min(pageSize, Math.max(0, filtered.length - events.length)),
  };
}

/** `Showing 20 of 137 updates`, or `No activity of this type`. */
export function describeActivityView(view: ActivityView, label: string): string {
  if (view.total === 0) return `No ${label.toLowerCase()} activity in the stored log.`;
  if (!view.hasMore) {
    return `Showing all ${view.total} ${view.total === 1 ? 'event' : 'events'}${
      view.filter === ALL_ACTIVITY_TYPES ? '' : ` of type ${label.toLowerCase()}`
    }.`;
  }
  return `Showing the ${view.visible} most recent of ${view.total} events.`;
}
