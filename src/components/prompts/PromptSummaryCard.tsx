import { Archive, ArchiveRestore, Pin, PinOff, Star, StarOff } from 'lucide-react';

import { Badge, Button, Card } from '@/components/ui';
import { StatusBadge } from '@/components/library/PromptBadges';
import { formatRelativeTime } from '@/lib/dates';
import type { Prompt } from '@/domain/types';

export interface PromptSummaryCardProps {
  readonly prompt: Prompt;
  readonly folderName: string | null;
  readonly collectionNames: readonly string[];
  readonly now: Date;
  readonly onToggleFavorite: () => void;
  readonly onTogglePin: () => void;
  readonly onToggleArchive: () => void;
}

/**
 * Prompt header on the workspace route (TASK-013).
 *
 * The editor itself belongs to TASK-014. This panel is deliberately metadata
 * only: it names the prompt, says where it is filed, and offers the state
 * changes that are not edits of the document — favorite, pin, archive. Each
 * toggle is a labelled, pressed-state button; the shape of the icon changes with
 * the state so colour is never the only signal.
 */
export function PromptSummaryCard({
  prompt,
  folderName,
  collectionNames,
  now,
  onToggleFavorite,
  onTogglePin,
  onToggleArchive,
}: PromptSummaryCardProps) {
  return (
    <Card as="section" aria-labelledby="prompt-summary-heading" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metadata-rail">Prompt</p>
          <h1
            id="prompt-summary-heading"
            className="mt-1.5 font-display text-2xl leading-tight break-words text-ink"
          >
            {prompt.title}
          </h1>
          {prompt.description ? (
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">
              {prompt.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={prompt.favorite}
            onClick={onToggleFavorite}
          >
            {prompt.favorite ? (
              <Star aria-hidden="true" size={14} fill="currentColor" />
            ) : (
              <StarOff aria-hidden="true" size={14} />
            )}
            {prompt.favorite ? 'Favorited' : 'Favorite'}
          </Button>
          <Button variant="secondary" size="sm" aria-pressed={prompt.pinned} onClick={onTogglePin}>
            {prompt.pinned ? (
              <PinOff aria-hidden="true" size={14} />
            ) : (
              <Pin aria-hidden="true" size={14} />
            )}
            {prompt.pinned ? 'Pinned' : 'Pin'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onToggleArchive}>
            {prompt.archived ? (
              <ArchiveRestore aria-hidden="true" size={14} />
            ) : (
              <Archive aria-hidden="true" size={14} />
            )}
            {prompt.archived ? 'Restore' : 'Archive'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
        <StatusBadge status={prompt.status} />
        {prompt.favorite ? <Badge tone="warning">Favorite</Badge> : null}
        {prompt.pinned ? <Badge tone="info">Pinned</Badge> : null}
        {prompt.archived ? <Badge tone="neutral">Archived</Badge> : null}
        <span>
          In <span className="text-ink">{folderName ?? 'Unfiled'}</span>
        </span>
        {collectionNames.length > 0 ? (
          <span>
            ·{' '}
            {collectionNames.map((name) => (
              <Badge key={name} tone="accent" className="mr-1">
                {name}
              </Badge>
            ))}
          </span>
        ) : null}
        <span className="text-ink-muted">· Edited {formatRelativeTime(prompt.updatedAt, now)}</span>
      </div>

      {prompt.tags.length > 0 ? (
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {prompt.tags.map((tag) => (
            <li key={tag}>
              <Badge tone="neutral" className="font-mono">
                #{tag}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-muted">No tags yet.</p>
      )}

      <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
        The JSON editor, validation, and version history arrive in TASK-014. Nothing on this page
        changes the prompt document.
      </p>
    </Card>
  );
}
