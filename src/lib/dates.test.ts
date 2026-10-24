import { describe, expect, it } from 'vitest';

import {
  formatDateTime,
  formatLongDate,
  formatRelativeTime,
  formatShortDate,
  greetingFor,
  toIsoDay,
} from '@/lib/dates';

/** Local-time constructor, so these assertions hold in any time zone. */
function at(year: number, month: number, day: number, hour = 10, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

describe('date formatting', () => {
  it('formats long and short dates', () => {
    expect(formatLongDate(at(2026, 10, 24))).toBe('24 October 2026');
    expect(formatShortDate(at(2026, 10, 24))).toBe('24 Oct');
  });

  it('formats a date and time together', () => {
    const value = formatDateTime(at(2026, 10, 24, 9, 41));
    expect(value).toContain('24 Oct 2026');
    expect(value).toMatch(/09:41|9:41/);
  });

  it('returns an em dash for unreadable input', () => {
    expect(formatLongDate('not-a-date')).toBe('—');
    expect(formatShortDate('')).toBe('—');
    expect(formatDateTime(new Date('nope'))).toBe('—');
  });

  it('produces a stable ISO day', () => {
    expect(toIsoDay(new Date('2026-10-24T23:30:00.000Z'))).toBe('2026-10-24');
  });
});

describe('formatRelativeTime', () => {
  const now = at(2026, 10, 24, 12, 0);

  function ago(ms: number): Date {
    return new Date(now.getTime() - ms);
  }

  it('describes recent moments', () => {
    expect(formatRelativeTime(ago(10_000), now)).toBe('just now');
    expect(formatRelativeTime(ago(12 * 60_000), now)).toBe('12 min ago');
    expect(formatRelativeTime(ago(3 * 60 * 60_000), now)).toBe('3 hr ago');
  });

  it('describes days and weeks', () => {
    expect(formatRelativeTime(ago(26 * 60 * 60_000), now)).toBe('yesterday');
    expect(formatRelativeTime(ago(6 * 24 * 60 * 60_000), now)).toBe('6 days ago');
    expect(formatRelativeTime(ago(10 * 24 * 60 * 60_000), now)).toBe('last week');
    expect(formatRelativeTime(ago(21 * 24 * 60 * 60_000), now)).toBe('3 weeks ago');
  });

  it('falls back to an absolute date for old values', () => {
    const old = at(2026, 3, 2);
    expect(formatRelativeTime(old, now)).toBe('2 Mar');
  });

  it('treats clock skew as just now', () => {
    expect(formatRelativeTime(new Date(now.getTime() + 60_000), now)).toBe('just now');
  });

  it('returns an em dash for unreadable values', () => {
    expect(formatRelativeTime('nope', now)).toBe('—');
  });
});

describe('greetingFor', () => {
  it('changes with the time of day', () => {
    expect(greetingFor(at(2026, 10, 24, 3))).toBe('Good evening');
    expect(greetingFor(at(2026, 10, 24, 9))).toBe('Good morning');
    expect(greetingFor(at(2026, 10, 24, 14))).toBe('Good afternoon');
    expect(greetingFor(at(2026, 10, 24, 21))).toBe('Good evening');
  });
});
