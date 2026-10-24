import type { ComposerCompleteness, ComposerIssue } from '@/domain/composer';

export interface ComposerIssuesProps {
  readonly issues: readonly ComposerIssue[];
  readonly completeness: ComposerCompleteness;
  /** JSON fields whose text is not applied yet, by human-readable label. */
  readonly unappliedFields: readonly string[];
}

/**
 * The composer's own checks, stated in words (TASK-017).
 *
 * Two different things live here on purpose: an honest count of how much of the
 * form has something in it, and the problems that would make a save dishonest.
 * Neither is a score — "4 of 6 sections filled" says nothing about quality, and
 * the copy says so.
 */
export function ComposerIssues({ issues, completeness, unappliedFields }: ComposerIssuesProps) {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const blocked = errors.length > 0 || unappliedFields.length > 0;

  return (
    <section
      aria-label="Composer checks"
      className="space-y-2 rounded-md border border-line bg-surface-1 p-3"
    >
      <h2 className="text-xs font-medium tracking-wide text-ink uppercase">Checks</h2>

      <p role="status" className="text-xs leading-relaxed text-ink-secondary">
        {completeness.completed} of {completeness.total} sections have something in them.
        {completeness.missing.length > 0
          ? ` Still empty: ${completeness.missing.join(', ')}.`
          : ' Every section has content.'}
      </p>

      <p className="text-2xs text-ink-muted">
        These are shape checks on this document, not a judgement of the prompt’s quality or of
        whether a model will follow it.
      </p>

      {blocked ? (
        <p className="text-2xs font-medium text-danger">
          Saving is held back until the problems below are fixed.
        </p>
      ) : null}

      {errors.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Problems that block saving">
          {errors.map((issue) => (
            <li
              key={`${issue.path}-${issue.message}`}
              className="text-2xs leading-relaxed text-danger"
            >
              <span className="font-medium">Error</span> — {issue.message}{' '}
              <span className="font-mono text-ink-muted">{issue.path}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {unappliedFields.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Fields that are not applied">
          {unappliedFields.map((label) => (
            <li key={label} className="text-2xs leading-relaxed text-danger">
              <span className="font-medium">Error</span> — {label} is not valid JSON yet, so the
              document still holds its previous value.
            </li>
          ))}
        </ul>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Warnings">
          {warnings.map((issue) => (
            <li
              key={`${issue.path}-${issue.message}`}
              className="text-2xs leading-relaxed text-warning"
            >
              <span className="font-medium">Warning</span> — {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      {!blocked && warnings.length === 0 ? (
        <p className="text-2xs text-ink-muted">
          No errors or warnings from these checks. They do not claim the prompt is good.
        </p>
      ) : null}
    </section>
  );
}
