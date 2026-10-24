import { AlertTriangle, ArrowLeftRight, Info, ShieldAlert, TextCursorInput } from 'lucide-react';

import { Badge, Button, CopyButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { ValidationIssue, ValidationKind, ValidationSeverity } from '@/domain/validation';

/**
 * Findings table (TASK-016).
 *
 * Every row states its kind in words ("syntax", "schema", "document"), so the
 * three classes are never distinguished by colour alone. The path is selectable
 * text with a copy control, because the fastest way to act on a finding is to
 * paste its path into a schema or a ticket.
 */

export interface IssueListProps {
  readonly issues: readonly ValidationIssue[];
  /** Called with the issue's line when it has one (syntax findings only). */
  readonly onJump?: (issue: ValidationIssue) => void;
  /** Called to focus a document path in the editor. */
  readonly onFocusPath?: (issue: ValidationIssue) => void;
  readonly emptyMessage?: string;
  readonly label: string;
}

const KIND_META: Record<ValidationKind, { label: string; icon: typeof Info }> = {
  syntax: { label: 'syntax', icon: TextCursorInput },
  schema: { label: 'schema', icon: ShieldAlert },
  document: { label: 'document', icon: Info },
};

const SEVERITY_TONE: Record<ValidationSeverity, string> = {
  error: 'text-danger',
  warning: 'text-warning',
};

export function IssueList({
  issues,
  onJump,
  onFocusPath,
  emptyMessage = 'No findings.',
  label,
}: IssueListProps) {
  if (issues.length === 0) {
    return <p className="px-1 py-2 text-xs text-ink-muted">{emptyMessage}</p>;
  }

  return (
    <ul aria-label={label} className="divide-y divide-line rounded-md border border-line">
      {issues.map((issue, index) => {
        const meta = KIND_META[issue.kind];
        const Icon = meta.icon;
        const location = issue.line !== undefined ? `line ${issue.line}` : issue.path;

        return (
          <li
            key={`${issue.kind}-${issue.pointer}-${issue.keyword ?? ''}-${index}`}
            className="flex min-w-0 flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:gap-3"
          >
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <Icon
                aria-hidden="true"
                size={13}
                className={cn('mt-0.5 shrink-0', SEVERITY_TONE[issue.severity])}
              />
              <div className="min-w-0 space-y-1">
                <p className="text-xs leading-relaxed text-ink">{issue.message}</p>
                <p className="flex flex-wrap items-center gap-2 font-mono text-2xs text-ink-muted">
                  <span className="sr-only">Severity: {issue.severity}. Kind: </span>
                  <Badge tone={issue.severity === 'error' ? 'danger' : 'warning'}>
                    {issue.severity}
                  </Badge>
                  <span>{meta.label}</span>
                  <span aria-hidden="true">·</span>
                  <span className="break-all">{location}</span>
                  {issue.keyword && issue.keyword !== 'schema' ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{issue.keyword}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:pl-2">
              {issue.kind === 'syntax' && issue.line !== undefined && onJump ? (
                <Button variant="secondary" size="sm" onClick={() => onJump(issue)}>
                  Go to line {issue.line}
                </Button>
              ) : null}

              {issue.kind !== 'syntax' && onFocusPath ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFocusPath(issue)}
                  aria-label={`Find ${issue.path} in the editor`}
                >
                  <ArrowLeftRight aria-hidden="true" size={11} />
                  Find
                </Button>
              ) : null}

              <CopyButton
                value={issue.pointer.length > 0 ? issue.pointer : ''}
                label="Copy path"
                copiedLabel="Copied"
                variant="ghost"
                size="sm"
                aria-label={`Copy the JSON Pointer for ${issue.path}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** A count of findings by kind, with words rather than colour alone. */
export function IssueCounts({
  counts,
}: {
  readonly counts: {
    readonly syntax: number;
    readonly schema: number;
    readonly document: number;
    readonly errors: number;
    readonly warnings: number;
  };
}) {
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-ink-muted">
      <div className="flex items-center gap-1.5">
        <dt>Syntax</dt>
        <dd className={cn('font-mono', counts.syntax > 0 && 'text-danger')}>{counts.syntax}</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt>Schema</dt>
        <dd className={cn('font-mono', counts.schema > 0 && 'text-danger')}>{counts.schema}</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt>Document</dt>
        <dd className={cn('font-mono', counts.document > 0 && 'text-warning')}>
          {counts.document}
        </dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt>
          <AlertTriangle aria-hidden="true" size={10} className="inline" /> Errors
        </dt>
        <dd className="font-mono">{counts.errors}</dd>
      </div>
    </dl>
  );
}
