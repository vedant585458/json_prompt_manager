import { Pin, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

import { HighlightedText } from '@/components/library/HighlightedText';
import { ParsabilityBadge, StatusBadge } from '@/components/library/PromptBadges';
import { Badge, Checkbox } from '@/components/ui';
import { formatRelativeTime } from '@/lib/dates';
import type { PromptMatch } from '@/domain/search';
import type { Prompt } from '@/domain/types';

export interface PromptRowProps {
  readonly prompt: Prompt;
  readonly parsable: boolean;
  readonly query: string;
  readonly match?: PromptMatch | undefined;
  readonly now: Date;
  readonly selected: boolean;
  readonly onToggleSelected: (id: string) => void;
}

/**
 * One prompt as a dense row (TASK-011).
 *
 * Shows the same facts as the card — title, description, tags, status, document
 * health, pin/favorite, last edit — with the description trimmed to a line. The
 * row is not a table because it has to restack on a 360 px screen; a list of
 * labelled links keeps the reading order and the semantics.
 */
export function PromptRow({
  prompt,
  parsable,
  query,
  match,
  now,
  selected,
  onToggleSelected,
}: PromptRowProps) {
  return (
    <li className="flex min-w-0 items-start gap-3 px-3 py-2.5 transition-colors duration-[var(--pf-duration-fast)] hover:bg-surface-2 sm:px-4">
      <Checkbox
        id={`select-${prompt.id}`}
        name={`select-${prompt.id}`}
        checked={selected}
        onCheckedChange={() => onToggleSelected(prompt.id)}
        label={<span className="sr-only">Select “{prompt.title}”</span>}
        className="mt-0.5 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={`/prompts/${prompt.id}`}
            className="min-w-0 truncate text-sm font-medium text-ink hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <HighlightedText text={prompt.title} query={query} />
          </Link>
          <StatusBadge status={prompt.status} />
          <ParsabilityBadge parsable={parsable} />
          <PromptMarkers prompt={prompt} />
        </div>

        <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-ink-muted">
          {prompt.description.length > 0 ? (
            <HighlightedText text={prompt.description} query={query} />
          ) : (
            'No description yet.'
          )}
        </p>

        {match?.excerpt ? (
          <p className="mt-1 truncate font-mono text-2xs text-ink-secondary">
            <span className="text-ink-muted">JSON: </span>
            <HighlightedText text={match.excerpt} query={query} />
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-center gap-1">
            {prompt.tags.length === 0 ? (
              <span className="font-mono text-2xs text-ink-muted">No tags</span>
            ) : (
              prompt.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  #{tag}
                </Badge>
              ))
            )}
          </div>

          <time dateTime={prompt.updatedAt} className="font-mono text-2xs text-ink-muted">
            <span className="sr-only">Last edited </span>
            {formatRelativeTime(prompt.updatedAt, now)}
          </time>
        </div>
      </div>
    </li>
  );
}

function PromptMarkers({ prompt }: { readonly prompt: Prompt }) {
  return (
    <>
      {prompt.pinned ? (
        <span className="inline-flex items-center text-accent">
          <Pin aria-hidden="true" size={12} strokeWidth={2} />
          <span className="sr-only">Pinned</span>
        </span>
      ) : null}
      {prompt.favorite ? (
        <span className="inline-flex items-center text-warning">
          <Star aria-hidden="true" size={12} strokeWidth={2} />
          <span className="sr-only">Favorite</span>
        </span>
      ) : null}
    </>
  );
}
