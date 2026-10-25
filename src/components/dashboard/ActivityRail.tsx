import { DashboardSection, SectionEmpty } from '@/components/dashboard/DashboardSection';
import { ACTIVITY_TYPE_META } from '@/features/health/activityMeta';
import { formatDateTime, formatRelativeTime } from '@/lib/dates';
import type { ActivityEvent } from '@/domain/types';

export interface ActivityRailProps {
  readonly events: readonly ActivityEvent[];
  readonly now: Date;
}

/**
 * The eight most recent activity events (TASK-010).
 *
 * The log records what the user did, not what shipped with the app, so an empty
 * log on a fresh install is the honest result and is shown as such.
 */
export function ActivityRail({ events, now }: ActivityRailProps) {
  return (
    <DashboardSection
      id="dashboard-activity"
      title="Activity"
      description="The last eight things that changed on this device."
    >
      {events.length === 0 ? (
        <SectionEmpty
          title="No activity yet"
          description="Creating, editing, and snapshotting a prompt is recorded here as you work."
        />
      ) : (
        <ol className="divide-y divide-line">
          {events.map((event) => {
            const meta = ACTIVITY_TYPE_META[event.type];
            const Icon = meta.icon;

            return (
              <li key={event.id} className="flex min-w-0 items-start gap-2.5 px-4 py-2.5 sm:px-5">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border border-line bg-surface-2 text-ink-muted"
                >
                  <Icon size={12} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-ink-secondary">
                    <span className="sr-only">{meta.label}: </span>
                    {event.summary}
                  </span>
                  <time
                    dateTime={event.createdAt}
                    title={formatDateTime(event.createdAt)}
                    className="mt-0.5 block font-mono text-2xs text-ink-muted"
                  >
                    {formatRelativeTime(event.createdAt, now)}
                  </time>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </DashboardSection>
  );
}
