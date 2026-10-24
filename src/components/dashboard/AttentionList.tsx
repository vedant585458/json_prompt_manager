import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

import { DashboardSection, SectionEmpty } from '@/components/dashboard/DashboardSection';
import { formatRelativeTime } from '@/lib/dates';
import { STALE_AFTER_DAYS, type AttentionItem } from '@/store/dashboard';

const KIND_META = {
  'invalid-document': {
    icon: AlertTriangle,
    label: 'Will not parse',
    hint: 'The stored content does not read back as a prompt document.',
  },
  'schema-mismatch': {
    icon: ShieldAlert,
    label: 'Fails its schema',
    hint: 'The document parses but does not meet the schema attached to it.',
  },
  stale: {
    icon: Clock,
    label: 'Not touched recently',
    hint: `Not edited in over ${STALE_AFTER_DAYS} days.`,
  },
} as const;

export interface AttentionListProps {
  readonly items: readonly AttentionItem[];
  readonly now: Date;
}

/**
 * What needs attention (TASK-010).
 *
 * The list is built from real parse results and real timestamps. It never calls
 * a prompt "good": a document that parses only means it can be read back, so
 * the wording stays factual about what was checked.
 */
export function AttentionList({ items, now }: AttentionListProps) {
  return (
    <DashboardSection
      id="dashboard-attention"
      title="Needs attention"
      description="Documents that will not parse, then schema mismatches, then prompts that have gone quiet."
      action={{ label: 'Validation', to: '/validation' }}
    >
      {items.length === 0 ? (
        <SectionEmpty
          title="Nothing needs attention"
          description={`Every stored document parses and meets its attached schema, and nothing has been idle for more than ${STALE_AFTER_DAYS} days.`}
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;

            return (
              <li key={item.id} className="min-w-0">
                <Link
                  to={`/prompts/${item.promptId}`}
                  className="group flex min-w-0 items-start gap-3 px-4 py-3 transition-colors duration-[var(--pf-duration-fast)] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-5"
                >
                  <span
                    aria-hidden="true"
                    className={
                      item.kind === 'invalid-document'
                        ? 'mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm bg-danger-soft text-danger'
                        : 'mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm bg-warning-soft text-warning'
                    }
                  >
                    <Icon size={13} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="truncate text-sm text-ink group-hover:text-accent">
                        {item.title}
                      </span>
                      <span className="font-mono text-2xs tracking-wide text-ink-muted uppercase">
                        {meta.label}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs leading-relaxed text-ink-muted">
                      {item.kind === 'invalid-document' ? item.detail : meta.hint}
                    </span>
                  </span>
                  <time
                    dateTime={item.updatedAt}
                    className="mt-0.5 shrink-0 font-mono text-2xs text-ink-muted"
                  >
                    {formatRelativeTime(item.updatedAt, now)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardSection>
  );
}
