import { useEffect, useRef } from 'react';

import { DiffValue } from '@/components/diff/DiffValue';
import { Badge } from '@/components/ui';
import {
  DIFF_CATEGORY_LABELS,
  DIFF_CHANGE_KIND_DESCRIPTIONS,
  DIFF_CHANGE_KIND_LABELS,
} from '@/domain/diff';
import type { DiffChangeKind, DiffEntry } from '@/domain/diff';
import { cn } from '@/lib/cn';

export type DiffView = 'unified' | 'split';

export interface DiffChangeListProps {
  readonly entries: readonly DiffEntry[];
  readonly view: DiffView;
  readonly fullValues: boolean;
  readonly selectedPointer: string | null;
  readonly onSelect: (entry: DiffEntry) => void;
  readonly sideLabels: { readonly before: string; readonly after: string };
  readonly label: string;
}

const KIND_TONE: Readonly<
  Record<DiffChangeKind, 'success' | 'danger' | 'warning' | 'info' | 'accent'>
> = {
  added: 'success',
  removed: 'danger',
  changed: 'info',
  'type-changed': 'warning',
  reordered: 'accent',
};

const CATEGORY_TONE = { structural: 'neutral', textual: 'neutral' } as const;

/**
 * The change list (TASK-020).
 *
 * One row per change, each row exactly one button: selecting it fills the
 * detail panel. Arrow keys, Home, and End move between rows with a roving
 * tabindex, so a keyboard user can read the comparison without tabbing through
 * every row, and the toolbar's "Full values" switch is the only thing that
 * expands a value (no button inside a button).
 *
 * Unified and split show the same list; split only places the two sides next
 * to each other on wide screens and stacks them below `lg`.
 */
export function DiffChangeList({
  entries,
  view,
  fullValues,
  selectedPointer,
  onSelect,
  sideLabels,
  label,
}: DiffChangeListProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const focusIndexRef = useRef(0);
  const focusIndex = Math.min(focusIndexRef.current, Math.max(0, entries.length - 1));

  useEffect(() => {
    focusIndexRef.current = Math.min(focusIndexRef.current, Math.max(0, entries.length - 1));
  }, [entries.length]);

  function moveFocus(next: number) {
    const clamped = Math.max(0, Math.min(entries.length - 1, next));
    focusIndexRef.current = clamped;
    buttons.current[clamped]?.focus();
    const entry = entries[clamped];
    if (entry) onSelect(entry);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    if (entries.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(focusIndexRef.current + 1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(focusIndexRef.current - 1);
        return;
      case 'Home':
        event.preventDefault();
        moveFocus(0);
        return;
      case 'End':
        event.preventDefault();
        moveFocus(entries.length - 1);
        return;
      default:
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {view === 'split' ? (
        <div className="hidden gap-3 px-3 text-2xs tracking-wide text-ink-muted uppercase lg:grid lg:grid-cols-2">
          <p className="truncate">Before · {sideLabels.before}</p>
          <p className="truncate">After · {sideLabels.after}</p>
        </div>
      ) : null}

      <ul
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface-1"
      >
        {entries.map((entry, index) => {
          const selected = entry.pointer === selectedPointer;
          const kindLabel = DIFF_CHANGE_KIND_LABELS[entry.kind];
          const categoryLabel = DIFF_CATEGORY_LABELS[entry.category];

          return (
            <li key={entry.pointer}>
              <button
                type="button"
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                tabIndex={index === focusIndex ? 0 : -1}
                aria-pressed={selected}
                onClick={() => {
                  focusIndexRef.current = index;
                  onSelect(entry);
                }}
                className={cn(
                  'flex w-full min-w-0 flex-col gap-2 px-3 py-3 text-left transition-colors duration-[var(--pf-duration-fast)]',
                  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
                  selected ? 'bg-surface-2' : 'hover:bg-surface-2/60',
                )}
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'min-w-0 truncate font-mono text-xs',
                      selected ? 'text-accent' : 'text-ink',
                    )}
                  >
                    {entry.label}
                  </span>
                  <Badge tone={KIND_TONE[entry.kind]}>{kindLabel}</Badge>
                  <Badge tone={CATEGORY_TONE[entry.category]}>{categoryLabel}</Badge>
                  {entry.movedPositions !== undefined && entry.movedPositions > 0 ? (
                    <span className="text-2xs text-ink-muted">
                      {entry.movedPositions} {entry.movedPositions === 1 ? 'position' : 'positions'}{' '}
                      moved
                    </span>
                  ) : null}
                  <span className="sr-only">
                    {kindLabel} — {DIFF_CHANGE_KIND_DESCRIPTIONS[entry.kind]}. {categoryLabel}{' '}
                    change.
                  </span>
                </span>

                <span className={cn('grid min-w-0 gap-2', view === 'split' && 'lg:grid-cols-2')}>
                  <DiffValue
                    value={entry.before}
                    side="before"
                    absentLabel="Not in the older side"
                    full={fullValues}
                  />
                  <DiffValue
                    value={entry.after}
                    side="after"
                    absentLabel="Not in the newer side"
                    full={fullValues}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-2xs leading-relaxed text-ink-muted">
        Use ↑ and ↓ to move between changes, Home and End for the first and last. Selecting a change
        shows its full path and values below.
      </p>
    </div>
  );
}
