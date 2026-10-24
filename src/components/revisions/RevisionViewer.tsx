import { RotateCcw } from 'lucide-react';
import { Suspense, lazy } from 'react';

import { Badge, Button, Card, CopyButton } from '@/components/ui';
import { formatDateTime, formatRelativeTime } from '@/lib/dates';
import { describeRevisionSize, summariseRevision } from '@/domain/revisions';
import type { PromptRevision } from '@/domain/types';

const JsonEditor = lazy(() => import('@/components/editor/JsonEditor'));

export interface RevisionViewerProps {
  readonly revision: PromptRevision;
  /** Formatted snapshot JSON, rendered read-only. */
  readonly json: string;
  readonly indent: 2 | 4;
  readonly now: Date;
  readonly busy: boolean;
  readonly onRestore: () => void;
  readonly onCopied: () => void;
  /** True when this snapshot already matches the stored prompt. */
  readonly matchesCurrent: boolean;
}

const KIND_TONE = {
  manual: 'neutral',
  'restore-safety': 'warning',
  import: 'info',
} as const;

function ViewerFallback() {
  return (
    <div
      className="flex h-[40vh] min-h-60 items-center justify-center rounded-md border border-line bg-surface-1 text-xs text-ink-muted"
      aria-hidden="true"
    >
      Loading the snapshot…
    </div>
  );
}

/**
 * Read-only snapshot viewer (TASK-019).
 *
 * The same CodeMirror host as the editor, in read-only mode: the JSON is
 * highlighted, selectable, and searchable but cannot be edited, so the snapshot
 * cannot be mistaken for a draft. The metadata block answers "which state is
 * this?" — number, kind, label, when it was taken, and what it captured.
 */
export function RevisionViewer({
  revision,
  json,
  indent,
  now,
  busy,
  onRestore,
  onCopied,
  matchesCurrent,
}: RevisionViewerProps) {
  const summary = summariseRevision(revision);

  return (
    <Card as="section" aria-labelledby="revision-viewer-heading" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metadata-rail">Snapshot {summary.versionLabel}</p>
          <h2
            id="revision-viewer-heading"
            className="mt-1 text-lg leading-tight font-semibold break-words text-ink"
          >
            {revision.label ?? `Snapshot v${revision.revisionNumber}`}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={KIND_TONE[revision.kind]}>{summary.kindLabel}</Badge>
          <Button variant="secondary" size="sm" onClick={onRestore} disabled={busy}>
            <RotateCcw aria-hidden="true" size={12} />
            Restore this snapshot
          </Button>
          <CopyButton value={json} label="Copy JSON" onCopied={onCopied} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-ink-muted">Number</dt>
          <dd className="font-mono text-ink">{summary.versionLabel}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Saved</dt>
          <dd className="text-ink">
            <time dateTime={revision.createdAt} title={formatDateTime(revision.createdAt)}>
              {formatRelativeTime(revision.createdAt, now)}
            </time>
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Document size</dt>
          <dd className="font-mono text-ink">{describeRevisionSize(summary.characters)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Captured state</dt>
          <dd className="text-ink">
            {summary.variables} {summary.variables === 1 ? 'variable' : 'variables'},{' '}
            {summary.tags.length} {summary.tags.length === 1 ? 'tag' : 'tags'}
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-ink-muted">Title when saved</dt>
          <dd className="truncate text-ink">{revision.titleSnapshot}</dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-ink-muted">Description when saved</dt>
          <dd className="truncate text-ink">
            {revision.descriptionSnapshot.length > 0 ? revision.descriptionSnapshot : 'None'}
          </dd>
        </div>
      </dl>

      <p className="text-2xs leading-relaxed text-ink-muted">
        {matchesCurrent
          ? 'This snapshot matches the stored prompt exactly.'
          : 'The stored prompt differs from this snapshot. Restoring asks for confirmation and names every field it will change.'}
      </p>

      <Suspense fallback={<ViewerFallback />}>
        <JsonEditor
          value={json}
          indent={indent}
          readOnly
          ariaLabel={`Snapshot v${revision.revisionNumber} of ${revision.titleSnapshot}, read-only`}
          className="h-[40vh] min-h-60"
        />
      </Suspense>
    </Card>
  );
}
