import { Eye, TriangleAlert } from 'lucide-react';

import { Alert, CopyButton } from '@/components/ui';
import { describeRenderedPrompt, type RenderedPrompt } from '@/domain/render';
import { cn } from '@/lib/cn';

export interface RenderedPreviewProps {
  readonly rendered: RenderedPrompt;
  readonly pending: boolean;
  readonly onCopied?: () => void;
}

const HIGHLIGHT = {
  unresolved:
    'rounded-xs bg-warning-soft text-warning underline decoration-warning/60 decoration-dotted',
  unknown: 'rounded-xs bg-danger-soft text-danger underline decoration-danger/60 decoration-dotted',
  invalid: 'rounded-xs bg-danger-soft text-danger underline decoration-danger/60 decoration-dotted',
} as const;

/**
 * The rendered prompt (TASK-021).
 *
 * The text is shown exactly as it would be produced — same characters, same
 * newlines — in a monospace block that wraps rather than scrolls sideways, so it
 * stays readable at 390 px. Placeholders that could not be resolved are marked
 * inline *and* listed underneath, because a highlight alone is not an
 * explanation.
 *
 * When a required variable is missing the render is blocked: showing half a
 * prompt would look like a finished one. The panel says what is missing instead,
 * and offers no copy button for text that does not exist.
 */
export function RenderedPreview({ rendered, pending, onCopied }: RenderedPreviewProps) {
  const errors = rendered.issues.filter((issue) => issue.severity === 'error');
  const warnings = rendered.issues.filter((issue) => issue.severity === 'warning');
  const hasHighlighted = rendered.sections.some((section) =>
    section.segments.some((segment) => segment.kind !== 'text' && segment.kind !== 'value'),
  );

  return (
    <section aria-labelledby="playground-preview" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id="playground-preview" className="text-sm font-semibold text-ink">
            Rendered prompt
          </h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">
            {describeRenderedPrompt(rendered)} Variables are substituted; the document is not
            changed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" aria-live="polite" className="text-2xs text-ink-muted">
            {pending ? 'Updating preview…' : ''}
          </span>
          {rendered.blocked || rendered.text.length === 0 ? null : (
            <CopyButton
              value={rendered.text}
              label="Copy rendered text"
              copiedLabel="Copied"
              onCopied={onCopied}
            />
          )}
        </div>
      </div>

      {rendered.blocked ? (
        <Alert tone="danger" title="Rendering is paused" live="polite">
          <p className="text-xs leading-relaxed">
            Nothing is shown until these are fixed, because a partially rendered prompt looks
            finished when it is not.
          </p>
          <ul className="mt-2 space-y-1 text-2xs leading-relaxed">
            {errors.map((issue) => (
              <li key={`${issue.code}-${issue.name ?? issue.message}`} className="flex gap-1.5">
                <span aria-hidden="true">•</span>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </Alert>
      ) : rendered.text.length === 0 ? (
        <div className="rounded-md border border-dashed border-line px-3 py-6 text-center">
          <p className="text-xs font-medium text-ink">Nothing to render yet</p>
          <p className="mx-auto mt-1 max-w-prose text-2xs leading-relaxed text-ink-muted">
            This document has no role, objective, instructions, context, references, or constraints
            with text in them. Add one in the editor and it will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-line bg-[var(--pf-editor-bg)]">
          <pre
            tabIndex={0}
            role="region"
            aria-label="Rendered prompt text"
            className="max-h-[60vh] overflow-auto px-3 py-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <code>
              {rendered.sections.map((section, index) => (
                <span key={section.id}>
                  {index > 0 ? '\n\n' : ''}
                  <span className="text-ink-muted">{section.title.toUpperCase()}</span>
                  {'\n'}
                  {section.segments.map((segment, segmentIndex) => {
                    if (segment.kind === 'text' || segment.kind === 'value') {
                      return <span key={segmentIndex}>{segment.text}</span>;
                    }

                    return (
                      <span
                        key={segmentIndex}
                        className={cn(HIGHLIGHT[segment.kind])}
                        title={
                          segment.name
                            ? `{{${segment.name}}} is ${segment.kind === 'unknown' ? 'not declared' : 'unresolved'}`
                            : 'This placeholder cannot be resolved'
                        }
                      >
                        {segment.text}
                      </span>
                    );
                  })}
                </span>
              ))}
            </code>
          </pre>
        </div>
      )}

      {hasHighlighted ? (
        <p className="text-2xs leading-relaxed text-ink-muted">
          Highlighted placeholders are shown as written: they have no value, or they are not
          declared. They are listed below with the reason.
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-md border border-warning/35 bg-warning-soft p-3">
          <h3 className="flex items-center gap-1.5 text-2xs font-semibold tracking-wide text-warning uppercase">
            <TriangleAlert aria-hidden="true" size={12} />
            {warnings.length} {warnings.length === 1 ? 'placeholder is' : 'placeholders are'} shown
            as written
          </h3>
          <ul className="mt-1.5 space-y-1 text-2xs leading-relaxed text-ink-secondary">
            {warnings.map((issue) => (
              <li key={`${issue.code}-${issue.name ?? issue.message}`}>
                {issue.message}
                {issue.path ? <span className="text-ink-muted"> ({issue.path})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rendered.missing.length > 0 && !rendered.blocked ? (
        <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-ink-muted">
          <Eye aria-hidden="true" size={12} className="mt-0.5 shrink-0" />
          <span>
            Optional variables without a value keep their placeholders visible. Fill them in to
            resolve them.
          </span>
        </p>
      ) : null}
    </section>
  );
}
