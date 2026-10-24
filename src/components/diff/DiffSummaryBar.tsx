import { Copy, Eye, Rows3, SplitSquareHorizontal } from 'lucide-react';

import type { DiffView } from '@/components/diff/DiffChangeList';
import { Button, Checkbox, CopyButton } from '@/components/ui';
import {
  DIFF_CATEGORY_LABELS,
  DIFF_CHANGE_KINDS,
  DIFF_CHANGE_KIND_LABELS,
  describeDiffCategories,
  describeDiffSummary,
} from '@/domain/diff';
import type { DiffChangeKind, DiffSummary } from '@/domain/diff';
import { cn } from '@/lib/cn';

export interface DiffSummaryBarProps {
  /** Summary of every change found, not only the visible ones. */
  readonly summary: DiffSummary;
  readonly counts: Readonly<Record<DiffChangeKind, number>>;
  readonly activeKinds: readonly DiffChangeKind[];
  readonly onToggleKind: (kind: DiffChangeKind) => void;
  readonly onClearKinds: () => void;
  readonly view: DiffView;
  readonly onViewChange: (view: DiffView) => void;
  readonly fullValues: boolean;
  readonly onFullValuesChange: (value: boolean) => void;
  readonly copyJson: string;
  readonly copyText: string;
  readonly copyLabel: string;
  readonly onCopied: () => void;
}

/**
 * Summary, filter, view, and copy controls for the comparison (TASK-020).
 *
 * Every control here changes only the view; none of them changes the two
 * documents or the stored prompt. Filter buttons carry their count as text
 * (never colour alone), a kind with no changes is disabled rather than hidden,
 * so the row of filters keeps a stable shape while you switch between filters.
 */
export function DiffSummaryBar({
  summary,
  counts,
  activeKinds,
  onToggleKind,
  onClearKinds,
  view,
  onViewChange,
  fullValues,
  onFullValuesChange,
  copyJson,
  copyText,
  copyLabel,
  onCopied,
}: DiffSummaryBarProps) {
  const allSelected = activeKinds.length === 0;

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-md border border-line bg-surface-1 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{describeDiffSummary(summary)}</p>
          <p className="mt-0.5 text-2xs text-ink-muted">
            {describeDiffCategories(summary)} Structure and text are different things; both are
            listed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(['structural', 'textual'] as const).map((category) => (
            <span key={category} className="text-2xs text-ink-muted">
              {DIFF_CATEGORY_LABELS[category]}:{' '}
              <span className="font-mono text-ink">
                {category === 'structural' ? summary.structural : summary.textual}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div
        role="group"
        aria-label="Filter by change type"
        className="flex flex-wrap items-center gap-1.5"
      >
        <FilterButton
          active={allSelected}
          onClick={onClearKinds}
          label="All"
          count={summary.total}
        />
        {DIFF_CHANGE_KINDS.map((kind) => (
          <FilterButton
            key={kind}
            active={activeKinds.includes(kind)}
            onClick={() => onToggleKind(kind)}
            label={DIFF_CHANGE_KIND_LABELS[kind]}
            count={counts[kind]}
            disabled={counts[kind] === 0}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Diff view" className="flex items-center gap-1">
            <Button
              size="sm"
              variant={view === 'unified' ? 'secondary' : 'ghost'}
              aria-pressed={view === 'unified'}
              onClick={() => onViewChange('unified')}
            >
              <Rows3 aria-hidden="true" size={12} />
              Unified
            </Button>
            <Button
              size="sm"
              variant={view === 'split' ? 'secondary' : 'ghost'}
              aria-pressed={view === 'split'}
              onClick={() => onViewChange('split')}
            >
              <SplitSquareHorizontal aria-hidden="true" size={12} />
              Split
            </Button>
          </div>

          <Checkbox
            id="diff-full-values"
            label="Full values"
            hint="Show every character instead of a 200-character preview."
            checked={fullValues}
            onCheckedChange={(checked) => onFullValuesChange(checked === true)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="sr-only" aria-live="polite">
            {copyLabel}
          </span>
          <CopyButton
            value={copyJson}
            label={copyLabel}
            copiedLabel="Copied"
            onCopied={onCopied}
            aria-label={`${copyLabel} as JSON`}
          />
          <CopyButton
            value={copyText}
            label="Copy as text"
            copiedLabel="Copied"
            variant="ghost"
            onCopied={onCopied}
            leadingIcon={<Copy aria-hidden="true" size={13} />}
            aria-label="Copy the shown changes as plain text"
          />
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-ink-muted">
        <Eye aria-hidden="true" size={12} className="mt-0.5 shrink-0" />
        <span>
          Copying writes the changes visible with the current filter; the output records the filter
          so it never looks like a complete comparison when it is not.
        </span>
      </p>
    </div>
  );
}

interface FilterButtonProps {
  readonly active: boolean;
  readonly label: string;
  readonly count: number;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}

function FilterButton({ active, label, count, onClick, disabled = false }: FilterButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${label}: ${count}`}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-2xs tracking-wide uppercase transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-45',
        active
          ? 'border-accent/50 bg-accent-soft text-accent'
          : 'border-line bg-surface-2 text-ink-secondary hover:border-line-control hover:text-ink',
      )}
    >
      {label}
      <span className="tabular">{count}</span>
    </button>
  );
}
