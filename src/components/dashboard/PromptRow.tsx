import { Pin } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, type BadgeTone } from '@/components/ui';
import { formatRelativeTime } from '@/lib/dates';
import type { Prompt, PromptStatus } from '@/domain/types';

const STATUS_TONE: Record<PromptStatus, BadgeTone> = {
  active: 'success',
  draft: 'neutral',
  deprecated: 'warning',
};

export function PromptStatusBadge({ status }: { status: PromptStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} className="shrink-0">
      {status}
    </Badge>
  );
}

export interface PromptRowProps {
  readonly prompt: Prompt;
  readonly now: Date;
  /** Relative time on the right, or the absolute day for very old prompts. */
  readonly showPinnedMark?: boolean;
}

/**
 * One prompt in a dashboard list (TASK-010).
 *
 * The whole row is the link to the prompt's workspace, so the target is large
 * enough for touch and there is no nested interactive element to fight over the
 * click.
 */
export function PromptRow({ prompt, now, showPinnedMark = false }: PromptRowProps) {
  return (
    <li>
      <Link
        to={`/prompts/${prompt.id}`}
        className="group flex items-start gap-3 rounded-sm px-2.5 py-2.5 transition-colors duration-[var(--pf-duration-fast)] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            {showPinnedMark && prompt.pinned ? (
              <Pin aria-hidden="true" size={12} className="shrink-0 text-accent" />
            ) : null}
            <span className="truncate text-sm text-ink group-hover:text-accent">
              {prompt.title}
            </span>
            <PromptStatusBadge status={prompt.status} />
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink-muted">
            {prompt.description.length > 0 ? prompt.description : 'No description yet.'}
          </span>
        </span>
        <time
          dateTime={prompt.updatedAt}
          className="mt-0.5 shrink-0 font-mono text-2xs text-ink-muted"
        >
          {formatRelativeTime(prompt.updatedAt, now)}
        </time>
      </Link>
    </li>
  );
}
