import { formatDiffValue } from '@/domain/diff';
import type { JsonValue } from '@/domain/types';
import { cn } from '@/lib/cn';

export interface DiffValueProps {
  readonly value: JsonValue | undefined;
  readonly side: 'before' | 'after';
  /** Shown in place of a value that does not exist on this side. */
  readonly absentLabel: string;
  /** Render the whole value rather than a preview. */
  readonly full?: boolean;
  readonly className?: string;
}

/** Preview length when the toolbar is set to compact values. */
const PREVIEW_LENGTH = 200;

/**
 * One side of a change (TASK-020).
 *
 * Values are JSON literals, never coerced to strings: `"3"` and `3` must stay
 * distinguishable at a glance. Containers are pretty-printed with two spaces,
 * and a truncated preview says how many characters are hidden instead of
 * ending in a bare ellipsis. The full value is always available through the
 * toolbar's "Full values" switch — no row owns a hidden extra control, which
 * keeps the row a single, predictable button.
 */
export function DiffValue({ value, side, absentLabel, full = false, className }: DiffValueProps) {
  if (value === undefined) {
    return <span className={cn('text-2xs text-ink-muted italic', className)}>{absentLabel}</span>;
  }

  const formatted = formatDiffValue(value, {
    maxLength: full ? Number.MAX_SAFE_INTEGER : PREVIEW_LENGTH,
  });

  return (
    <span className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="flex min-w-0 items-start gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 w-3 shrink-0 select-none text-center font-mono text-2xs',
            side === 'before' ? 'text-danger' : 'text-success',
          )}
        >
          {side === 'before' ? '−' : '+'}
        </span>
        <span className="min-w-0 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-ink">
          {formatted.text}
        </span>
      </span>
      {formatted.truncated ? (
        <span className="pl-5 text-2xs text-ink-muted">
          Preview of {formatted.characters.toLocaleString()} characters — switch on “Full values”
          above to read all of it.
        </span>
      ) : null}
    </span>
  );
}
