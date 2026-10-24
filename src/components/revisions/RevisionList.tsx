import { Eye, RotateCcw } from 'lucide-react';

import { Badge, Button, CopyIconButton } from '@/components/ui';
import { formatDateTime, formatRelativeTime } from '@/lib/dates';
import { describeRevisionSize, summariseRevision } from '@/domain/revisions';
import type { PromptRevision } from '@/domain/types';

export interface RevisionListProps {
  /** Newest first, already ordered by `revisionsForPrompt`. */
  readonly revisions: readonly PromptRevision[];
  readonly selectedId: string | null;
  readonly now: Date;
  readonly busy: boolean;
  readonly onSelect: (revision: PromptRevision) => void;
  readonly onRestore: (revision: PromptRevision) => void;
  readonly onCopied: () => void;
  /** JSON for the copy button, formatted with the stored indent preference. */
  readonly jsonFor: (revision: PromptRevision) => string;
}

const KIND_TONE = {
  manual: 'neutral',
  'restore-safety': 'warning',
  import: 'info',
} as const;

/**
 * The history list (TASK-019).
 *
 * One row per snapshot: its number, label (or the honest "No label"), kind,
 * creation time (relative text with the exact time in `title` and in the
 * accessible name), and size. Selecting a row is one button; restore and copy
 * are siblings of it, never nested inside it.
 *
 * The kind is carried by a badge *and* its words, so colour is never the only
 * signal; a safety snapshot is not styled like a hand-saved one.
 */
export function RevisionList({
  revisions,
  selectedId,
  now,
  busy,
  onSelect,
  onRestore,
  onCopied,
  jsonFor,
}: RevisionListProps) {
  return (
    <ol className="divide-y divide-line">
      {revisions.map((revision) => {
        const summary = summariseRevision(revision);
        const absolute = formatDateTime(revision.createdAt);
        const selected = revision.id === selectedId;

        return (
          <li key={revision.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <button
              type="button"
              onClick={() => onSelect(revision)}
              aria-pressed={selected}
              className="group flex min-w-0 flex-col gap-1 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-ink-muted">{summary.versionLabel}</span>
                <span
                  className={
                    selected
                      ? 'truncate text-sm font-medium text-accent'
                      : 'truncate text-sm font-medium text-ink group-hover:text-accent'
                  }
                >
                  {revision.label ?? 'No label'}
                </span>
                <Badge tone={KIND_TONE[revision.kind]}>{summary.kindLabel}</Badge>
              </span>

              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-ink-muted">
                <time dateTime={revision.createdAt} title={absolute}>
                  {formatRelativeTime(revision.createdAt, now)}
                </time>
                <span aria-hidden="true">·</span>
                <span>{describeRevisionSize(summary.characters)}</span>
                {revision.kind === 'restore-safety' ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Taken automatically before a restore</span>
                  </>
                ) : null}
              </span>
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelect(revision)}
                aria-label={`View snapshot ${summary.versionLabel}`}
              >
                <Eye aria-hidden="true" size={12} />
                View
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRestore(revision)}
                disabled={busy}
                aria-label={`Restore snapshot ${summary.versionLabel}`}
              >
                <RotateCcw aria-hidden="true" size={12} />
                Restore
              </Button>
              <CopyIconButton
                value={jsonFor(revision)}
                label={`Copy snapshot ${summary.versionLabel} as JSON`}
                onCopied={onCopied}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
