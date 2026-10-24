/**
 * Date presentation helpers (TASK-010).
 *
 * Pure and injectable so the dashboard can render a stable "now" in tests.
 * Locale is fixed rather than taken from the browser so the dashboard header,
 * relative timestamps, and tests agree with each other.
 */

const LOCALE = 'en-GB';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function parse(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "24 October 2026". Falls back to an em dash for unreadable input. */
export function formatLongDate(value: string | Date): string {
  const date = parse(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** "24 Oct". */
export function formatShortDate(value: string | Date): string {
  const date = parse(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' }).format(date);
}

/** "24 Oct 2026, 09:41" — used where the exact moment matters. */
export function formatDateTime(value: string | Date): string {
  const date = parse(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Human relative time: "just now", "12 min ago", "3 hr ago", "yesterday",
 * "6 days ago", "3 weeks ago", then an absolute date.
 *
 * A future timestamp (clock skew) reads as "just now" rather than a negative
 * duration.
 */
export function formatRelativeTime(value: string | Date, now: Date = new Date()): string {
  const date = parse(value);
  const reference = parse(now);
  if (!date || !reference) return '—';

  const delta = reference.getTime() - date.getTime();
  if (delta < MINUTE_MS) return 'just now';
  if (delta < HOUR_MS) {
    const minutes = Math.floor(delta / MINUTE_MS);
    return `${minutes} min ago`;
  }
  if (delta < DAY_MS) {
    const hours = Math.floor(delta / HOUR_MS);
    return `${hours} hr ago`;
  }

  const days = Math.floor(delta / DAY_MS);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return formatShortDate(date);
}

/** Time-of-day greeting for the dashboard header. */
export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** ISO timestamp truncated to the minute, for stable comparisons. */
export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
