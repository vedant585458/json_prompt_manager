import { Pin } from 'lucide-react';
import { Link } from 'react-router-dom';

import { DashboardSection, SectionEmpty } from '@/components/dashboard/DashboardSection';
import { PromptStatusBadge } from '@/components/dashboard/PromptRow';
import { formatRelativeTime } from '@/lib/dates';
import type { Prompt } from '@/domain/types';

export interface PinnedRailProps {
  readonly prompts: readonly Prompt[];
  readonly now: Date;
}

/**
 * Pinned prompts as a rail of cards (TASK-010).
 *
 * Pinning is the user's own ordering, so this rail shows their choices rather
 * than a computed "top picks" list. Up to six fit without horizontal scrolling
 * at every breakpoint — the rail wraps instead of overflowing.
 */
export function PinnedRail({ prompts, now }: PinnedRailProps) {
  return (
    <DashboardSection
      id="dashboard-pinned"
      title="Pinned"
      description="Prompts you keep close, newest edit first."
      action={{ label: 'Open library', to: '/library' }}
    >
      {prompts.length === 0 ? (
        <SectionEmpty
          title="Nothing pinned"
          description="Pin a prompt from the library to keep it on this rail."
          action={{ label: 'Open the library', to: '/library' }}
        />
      ) : (
        <ul className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {prompts.map((prompt) => (
            <li key={prompt.id} className="min-w-0">
              <Link
                to={`/prompts/${prompt.id}`}
                className="group flex h-full min-w-0 flex-col gap-1.5 rounded-md border border-line bg-surface-1 p-3.5 transition-colors duration-[var(--pf-duration-fast)] hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="flex items-center gap-1.5 text-accent">
                  <Pin aria-hidden="true" size={12} strokeWidth={2} />
                  <span className="metadata-rail text-accent">Pinned</span>
                </span>
                <span className="truncate text-sm font-medium text-ink group-hover:text-accent">
                  {prompt.title}
                </span>
                <span className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
                  {prompt.description.length > 0 ? prompt.description : 'No description yet.'}
                </span>
                <span className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                  <PromptStatusBadge status={prompt.status} />
                  <time
                    dateTime={prompt.updatedAt}
                    className="shrink-0 font-mono text-2xs text-ink-muted"
                  >
                    {formatRelativeTime(prompt.updatedAt, now)}
                  </time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
