import { useMemo, useState } from 'react';

import { Badge, CopyButton, Field, Select } from '@/components/ui';
import {
  describeRenderedComparison,
  diffRenderedVariants,
  renderedComparisonToText,
  type RenderedVariant,
} from '@/domain/renderDiff';
import { cn } from '@/lib/cn';

export interface ComparableVariant {
  /** Stable key, usually the case id. */
  readonly id: string;
  readonly label: string;
  readonly text: string;
}

export interface VariantComparisonProps {
  readonly variants: readonly ComparableVariant[];
  /** Initial "after" selection, e.g. the case that was just run. */
  readonly preferredAfterId?: string | null;
}

const KIND_STYLE = {
  same: 'text-ink-secondary',
  added: 'bg-success-soft text-ink',
  removed: 'bg-danger-soft text-ink',
} as const;

const KIND_MARK = {
  same: ' ',
  added: '+',
  removed: '-',
} as const;

const KIND_TEXT = {
  same: 'unchanged',
  added: 'added',
  removed: 'removed',
} as const;

/**
 * Two rendered variants side by side, line by line (TASK-022).
 *
 * The comparison is over the *rendered text*, which is the only honest
 * comparison available: PromptForge does not run prompts, so it can show how two
 * inputs change the words but never which output is better. When the texts are
 * identical the screen says so plainly rather than displaying a diff of nothing.
 */
export function VariantComparison({ variants, preferredAfterId = null }: VariantComparisonProps) {
  const [beforeId, setBeforeId] = useState(variants[0]?.id ?? '');
  const [afterId, setAfterId] = useState(
    variants.find((variant) => variant.id === preferredAfterId)?.id ?? variants[1]?.id ?? '',
  );

  const before = variants.find((variant) => variant.id === beforeId) ?? variants[0] ?? null;
  const after =
    variants.find((variant) => variant.id === afterId && variant.id !== before?.id) ??
    variants.find((variant) => variant.id !== before?.id) ??
    null;

  const comparison = useMemo(() => {
    if (!before || !after) return null;

    const left: RenderedVariant = { label: before.label, text: before.text };
    const right: RenderedVariant = { label: after.label, text: after.text };
    return diffRenderedVariants(left, right);
  }, [before, after]);

  if (variants.length < 2) {
    return (
      <p className="text-xs leading-relaxed text-ink-muted">
        Run at least two cases to compare their rendered text. A comparison needs two variants, and
        a blocked run has no text to compare.
      </p>
    );
  }

  const options = variants.map((variant) => ({ value: variant.id, label: variant.label }));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Before">
          {(control) => (
            <Select
              {...control}
              value={before?.id ?? ''}
              onChange={(event) => setBeforeId(event.target.value)}
              options={options}
            />
          )}
        </Field>
        <Field label="After">
          {(control) => (
            <Select
              {...control}
              value={after?.id ?? ''}
              onChange={(event) => setAfterId(event.target.value)}
              options={options}
            />
          )}
        </Field>
      </div>

      {comparison ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xs leading-relaxed text-ink-secondary" aria-live="polite">
              {describeRenderedComparison(comparison)}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {comparison.identical ? (
                <Badge tone="success">Identical</Badge>
              ) : (
                <>
                  <Badge tone="success">+{comparison.added}</Badge>
                  <Badge tone="danger">−{comparison.removed}</Badge>
                </>
              )}
              <CopyButton
                value={renderedComparisonToText(comparison)}
                label="Copy comparison"
                variant="secondary"
              />
            </div>
          </div>

          {comparison.identical ? (
            <p className="rounded-sm border border-success/35 bg-success-soft p-2 text-2xs leading-relaxed text-ink-secondary">
              Both variants produced exactly the same {before?.text.length.toLocaleString() ?? 0}{' '}
              characters. Nothing was substituted differently for these two cases.
            </p>
          ) : (
            <div
              className="max-h-96 min-w-0 overflow-auto rounded-sm border border-line bg-surface-2"
              role="table"
              aria-label={`Line comparison of ${before?.label ?? 'first variant'} and ${after?.label ?? 'second variant'}`}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-surface-1 px-2 py-1 text-2xs text-ink-muted">
                <span className="min-w-0 truncate">Before: {before?.label}</span>
                <span className="min-w-0 truncate">After: {after?.label}</span>
              </div>
              <div role="rowgroup" className="min-w-0">
                {comparison.rows.map((row, index) => (
                  <div
                    role="row"
                    key={`${index}-${row.kind}-${row.beforeLine ?? 'x'}-${row.afterLine ?? 'x'}`}
                    className={cn(
                      'flex min-w-0 items-start gap-2 px-2 py-0.5 font-mono text-2xs leading-relaxed',
                      KIND_STYLE[row.kind],
                    )}
                  >
                    <span aria-hidden="true" className="w-2 shrink-0 text-center select-none">
                      {KIND_MARK[row.kind]}
                    </span>
                    <span className="sr-only">{KIND_TEXT[row.kind]}: </span>
                    <span className="w-7 shrink-0 text-right tabular text-ink-muted select-none">
                      {row.beforeLine ?? ''}
                    </span>
                    <span className="w-7 shrink-0 text-right tabular text-ink-muted select-none">
                      {row.afterLine ?? ''}
                    </span>
                    <span className="min-w-0 whitespace-pre-wrap break-words">
                      {row.text.length === 0 ? '\u00a0' : row.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {comparison.truncated ? (
            <p className="text-2xs leading-relaxed text-ink-muted">
              These texts are too long to align line by line, so this shows the start and end of
              each side. The counts above are still exact.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs leading-relaxed text-ink-muted">
          Pick two different variants to compare.
        </p>
      )}
    </div>
  );
}
