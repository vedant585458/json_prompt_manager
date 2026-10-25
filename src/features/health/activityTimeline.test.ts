import { describe, expect, it } from 'vitest';

import { createActivityEvent, type DomainDependencies } from '@/domain/factories';
import type { ActivityEvent, ActivityType } from '@/domain/types';
import { ACTIVITY_TYPE_META, ACTIVITY_TYPES } from '@/features/health/activityMeta';
import {
  ACTIVITY_PAGE_SIZE,
  ALL_ACTIVITY_TYPES,
  activityDayLabel,
  buildActivityView,
  describeActivityView,
  filterActivityByType,
  groupActivityByDay,
  orderActivity,
} from '@/features/health/activityTimeline';

/**
 * Timeline tests (TASK-025).
 *
 * The assertions that matter are the ones about paging: the log is a prefix
 * query, so the tests check that page *n* is a strict prefix of page *n + 1* and
 * that the union of every page contains each event exactly once.
 */

const NOW = new Date('2026-10-25T12:00:00.000Z');

let sequence = 0;

function deps(now: string): DomainDependencies {
  return { now: () => new Date(now), newId: () => `event-${String(++sequence).padStart(3, '0')}` };
}

function event(
  type: ActivityType,
  createdAt: string,
  extra: { summary?: string; promptId?: string; promptTitle?: string } = {},
): ActivityEvent {
  return {
    ...createActivityEvent(
      {
        type,
        summary: extra.summary ?? `${type} happened`,
        ...(extra.promptId ? { promptId: extra.promptId } : {}),
        ...(extra.promptTitle ? { promptTitle: extra.promptTitle } : {}),
      },
      deps(createdAt),
    ),
    createdAt,
  };
}

function manyEvents(count: number): ActivityEvent[] {
  return Array.from({ length: count }, (_, index) =>
    event(
      index % 3 === 0 ? 'created' : index % 3 === 1 ? 'updated' : 'settings',
      new Date(NOW.getTime() - index * 60 * 60 * 1000).toISOString(),
      { summary: `Event ${index}` },
    ),
  );
}

describe('activity type metadata', () => {
  it('describes every type exactly once, in a stable order', () => {
    expect([...ACTIVITY_TYPES].sort()).toEqual(Object.keys(ACTIVITY_TYPE_META).sort());
    expect(new Set(ACTIVITY_TYPES).size).toBe(ACTIVITY_TYPES.length);

    for (const type of ACTIVITY_TYPES) {
      expect(ACTIVITY_TYPE_META[type].label.length).toBeGreaterThan(0);
      expect(ACTIVITY_TYPE_META[type].description.length).toBeGreaterThan(10);
    }
  });
});

describe('orderActivity', () => {
  it('sorts newest first and breaks timestamp ties by id', () => {
    const older = event('created', '2026-10-20T09:00:00.000Z');
    const sameA = { ...event('updated', '2026-10-21T09:00:00.000Z'), id: 'a' };
    const sameB = { ...event('updated', '2026-10-21T09:00:00.000Z'), id: 'b' };
    const newest = event('deleted', '2026-10-24T09:00:00.000Z');

    expect(orderActivity([older, sameA, newest, sameB]).map((item) => item.id)).toEqual([
      newest.id,
      'b',
      'a',
      older.id,
    ]);
  });

  it('does not mutate the argument', () => {
    const events = [
      event('created', '2026-10-20T09:00:00.000Z'),
      event('updated', '2026-10-21T09:00:00.000Z'),
    ];
    const before = events.map((item) => item.id);

    orderActivity(events);

    expect(events.map((item) => item.id)).toEqual(before);
  });
});

describe('filterActivityByType', () => {
  const events = [
    event('created', '2026-10-20T09:00:00.000Z'),
    event('updated', '2026-10-21T09:00:00.000Z'),
    event('created', '2026-10-22T09:00:00.000Z'),
  ];

  it('returns everything for the all filter', () => {
    expect(filterActivityByType(events, ALL_ACTIVITY_TYPES)).toHaveLength(3);
  });

  it('returns only the requested type otherwise', () => {
    expect(filterActivityByType(events, 'created')).toHaveLength(2);
    expect(filterActivityByType(events, 'deleted')).toEqual([]);
  });
});

describe('groupActivityByDay', () => {
  it('groups by UTC day with Today and Yesterday labels', () => {
    const groups = groupActivityByDay(
      [
        event('created', '2026-10-25T09:00:00.000Z'),
        event('updated', '2026-10-25T01:00:00.000Z'),
        event('deleted', '2026-10-24T23:00:00.000Z'),
        event('settings', '2026-10-01T10:00:00.000Z'),
      ],
      NOW,
    );

    expect(groups.map((group) => [group.day, group.label])).toEqual([
      ['2026-10-25', 'Today'],
      ['2026-10-24', 'Yesterday'],
      ['2026-10-01', '1 October 2026'],
    ]);
    expect(groups[0]?.events).toHaveLength(2);
  });

  it('drops events whose timestamp cannot be read rather than inventing a day', () => {
    const groups = groupActivityByDay(
      [
        event('created', '2026-10-25T09:00:00.000Z'),
        { ...event('updated', '2026-10-25T09:00:00.000Z'), createdAt: 'nope' },
      ],
      NOW,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.events).toHaveLength(1);
  });

  it('labels a day that is not near the clock with its date', () => {
    expect(activityDayLabel('2025-03-04', NOW)).toBe('4 March 2025');
    expect(activityDayLabel('not-a-day', NOW)).toBe('not-a-day');
  });
});

describe('buildActivityView paging', () => {
  const events = manyEvents(ACTIVITY_PAGE_SIZE * 2 + 5);

  it('shows the newest page first and reports what is left', () => {
    const view = buildActivityView({ events, now: NOW });

    expect(view.total).toBe(events.length);
    expect(view.visible).toBe(ACTIVITY_PAGE_SIZE);
    expect(view.hasMore).toBe(true);
    expect(view.nextPageSize).toBe(ACTIVITY_PAGE_SIZE);
    expect(view.events[0]?.summary).toBe('Event 0');
  });

  it('extends the same ordering instead of querying a second time', () => {
    const first = buildActivityView({ events, now: NOW, pages: 1 });
    const second = buildActivityView({ events, now: NOW, pages: 2 });
    const third = buildActivityView({ events, now: NOW, pages: 3 });

    expect(second.events.slice(0, first.visible)).toEqual(first.events);
    expect(third.events.slice(0, second.visible)).toEqual(second.events);
    expect(third.hasMore).toBe(false);
    expect(third.visible).toBe(events.length);
  });

  it('never shows an event twice as pages are added', () => {
    const seen = new Set<string>();
    let pages = 1;
    let previous = 0;

    for (;;) {
      const view = buildActivityView({ events, now: NOW, pages });
      // Only the events this page added are new; the prefix is the same rows.
      for (const item of view.events.slice(previous)) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      previous = view.visible;
      if (!view.hasMore) break;
      pages += 1;
    }

    expect(seen.size).toBe(events.length);
    expect(pages).toBeGreaterThan(1);
  });

  it('filters before paging, so a filter does not resurrect old pages', () => {
    const view = buildActivityView({ events, filter: 'settings', now: NOW, pages: 2 });
    const expected = filterActivityByType(orderActivity(events), 'settings');

    expect(view.total).toBe(expected.length);
    expect(view.events).toEqual(expected.slice(0, ACTIVITY_PAGE_SIZE * 2));
  });

  it('treats zero or negative pages as the first page', () => {
    const zero = buildActivityView({ events, pages: 0, now: NOW });
    const negative = buildActivityView({ events, pages: -3, now: NOW });
    const first = buildActivityView({ events, pages: 1, now: NOW });

    expect(zero.events).toEqual(first.events);
    expect(negative.events).toEqual(first.events);
    expect(zero.visible).toBe(Math.min(ACTIVITY_PAGE_SIZE, events.length));
  });

  it('groups only what is on screen', () => {
    const view = buildActivityView({ events, now: NOW, pageSize: 3, pages: 1 });

    expect(view.events).toHaveLength(3);
    expect(view.groups.reduce((total, group) => total + group.events.length, 0)).toBe(3);
  });

  it('handles an empty log and an empty filter', () => {
    expect(buildActivityView({ events: [], now: NOW })).toMatchObject({
      total: 0,
      visible: 0,
      hasMore: false,
      nextPageSize: 0,
      events: [],
      groups: [],
    });

    const filtered = buildActivityView({
      events: [event('created', '2026-10-25T09:00:00.000Z')],
      filter: 'deleted',
      now: NOW,
    });
    expect(filtered.total).toBe(0);
    expect(filtered.hasMore).toBe(false);
  });
});

describe('describeActivityView', () => {
  const events = manyEvents(ACTIVITY_PAGE_SIZE + 2);

  it('counts what is shown of what exists', () => {
    const view = buildActivityView({ events, now: NOW });
    expect(describeActivityView(view, 'All types')).toBe(
      `Showing the ${ACTIVITY_PAGE_SIZE} most recent of ${events.length} events.`,
    );
  });

  it('says when the list is complete', () => {
    const view = buildActivityView({ events: manyEvents(3), now: NOW });
    expect(describeActivityView(view, 'All types')).toBe('Showing all 3 events.');
  });

  it('names the filter when one is active', () => {
    const view = buildActivityView({
      events: [event('created', '2026-10-25T09:00:00.000Z')],
      filter: 'created',
      now: NOW,
    });
    expect(describeActivityView(view, 'Created')).toBe('Showing all 1 event of type created.');
  });

  it('states an empty result plainly', () => {
    const view = buildActivityView({ events: [], now: NOW });
    expect(describeActivityView(view, 'All types')).toBe(
      'No all types activity in the stored log.',
    );
  });
});
