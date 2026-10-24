import { Pin, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

import { HighlightedText } from '@/components/library/HighlightedText';
import { ParsabilityBadge, StatusBadge } from '@/components/library/PromptBadges';
import {
  PromptActionsMenu,
  type PromptActionHandlers,
} from '@/components/prompts/PromptActionsMenu';
import { Badge, Checkbox } from '@/components/ui';
import { formatRelativeTime } from '@/lib/dates';
import type { PromptMatch } from '@/domain/search';
import type { Prompt } from '@/domain/types';

export interface PromptCardProps {
  readonly prompt: Prompt;
  readonly parsable: boolean;
  readonly query: string;
  readonly match?: PromptMatch | undefined;
  readonly now: Date;
  readonly selected: boolean;
  readonly onToggleSelected: (id: string) => void;
  readonly actions: PromptActionHandlers;
}

const MAX_VISIBLE_TAGS = 4;

/**
 * One prompt as an artifact card (TASK-011).
 *
 * The whole card is the link to the editor; the selection checkbox sits above it
 * as a sibling control, so there is no interactive element nested inside a link.
 * Icons that carry meaning are paired with visually hidden text.
 */
export function PromptCard({
  prompt,
  parsable,
  query,
  match,
  now,
  selected,
  onToggleSelected,
  actions,
}: PromptCardProps) {
  const visibleTags = prompt.tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = prompt.tags.length - visibleTags.length;

  return (
    <li className="relative min-w-0">
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-0.5">
        <PromptActionsMenu prompt={prompt} {...actions} />
        <Checkbox
          id={`select-${prompt.id}`}
          name={`select-${prompt.id}`}
          checked={selected}
          onCheckedChange={() => onToggleSelected(prompt.id)}
          label={<span className="sr-only">Select “{prompt.title}”</span>}
        />
      </div>

      <Link
        to={`/prompts/${prompt.id}`}
        className="group flex h-full min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface-1 p-4 pr-16 transition-colors duration-[var(--pf-duration-fast)] hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={prompt.status} />
          <ParsabilityBadge parsable={parsable} />
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
        </span>

        <span className="block truncate font-display text-md leading-snug text-ink group-hover:text-accent">
          <HighlightedText text={prompt.title} query={query} />
        </span>

        <span className="line-clamp-2 block min-h-[2.4em] text-xs leading-relaxed text-ink-muted">
          {prompt.description.length > 0 ? (
            <HighlightedText text={prompt.description} query={query} />
          ) : (
            'No description yet.'
          )}
        </span>

        {match?.excerpt ? (
          <span className="block truncate rounded-sm border border-line bg-surface-sunken px-2 py-1 font-mono text-2xs text-ink-secondary">
            <span className="text-ink-muted">JSON: </span>
            <HighlightedText text={match.excerpt} query={query} />
          </span>
        ) : null}

        {visibleTags.length > 0 ? (
          <span className="mt-auto flex flex-wrap items-center gap-1 pt-1">
            {visibleTags.map((tag) => (
              <Badge key={tag} tone="neutral">
                #{tag}
              </Badge>
            ))}
            {hiddenTagCount > 0 ? (
              <span className="font-mono text-2xs text-ink-muted">+{hiddenTagCount}</span>
            ) : null}
          </span>
        ) : (
          <span className="mt-auto pt-1 font-mono text-2xs text-ink-muted">No tags</span>
        )}

        <span className="flex items-center justify-between gap-2 border-t border-line pt-2 text-2xs text-ink-muted">
          <span aria-hidden="true">Edited</span>
          <time dateTime={prompt.updatedAt} className="font-mono">
            {formatRelativeTime(prompt.updatedAt, now)}
          </time>
        </span>
      </Link>
    </li>
  );
}
