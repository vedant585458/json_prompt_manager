import { AlertTriangle, CheckCircle2, CircleSlash, Info, ShieldAlert } from 'lucide-react';

import { StatusPill } from '@/components/ui';
import { describeValidation, type ValidationReport } from '@/domain/validation';

/**
 * The one-line verdict for a validation report (TASK-016).
 *
 * Its whole job is to be exact: it names what was checked, and it never suggests
 * that valid JSON means a good prompt. When a schema is attached but unusable,
 * the pill says so instead of showing a green tick.
 */

export interface ValidationSummaryProps {
  readonly report: ValidationReport;
  /** Name of the attached schema, when there is one. */
  readonly schemaName?: string | null;
}

export function ValidationSummary({ report, schemaName = null }: ValidationSummaryProps) {
  const pill = (() => {
    if (report.status === 'skipped') {
      return {
        tone: 'info' as const,
        icon: <CircleSlash size={12} strokeWidth={1.75} />,
        label: 'Not checked',
      };
    }
    if (report.counts.syntax > 0) {
      return {
        tone: 'danger' as const,
        icon: <AlertTriangle size={12} strokeWidth={1.75} />,
        label: 'Syntax error',
      };
    }
    if (report.schemaStatus === 'rejected') {
      return {
        tone: 'danger' as const,
        icon: <ShieldAlert size={12} strokeWidth={1.75} />,
        label: 'Schema cannot be checked',
      };
    }
    if (report.counts.schema > 0) {
      return {
        tone: 'danger' as const,
        icon: <ShieldAlert size={12} strokeWidth={1.75} />,
        label: 'Does not meet the schema',
      };
    }
    if (report.counts.document > 0) {
      return {
        tone: 'warning' as const,
        icon: <Info size={12} strokeWidth={1.75} />,
        label: 'Shape warnings',
      };
    }
    return {
      tone: 'success' as const,
      icon: <CheckCircle2 size={12} strokeWidth={1.75} />,
      label: report.schemaStatus === 'checked' ? 'Valid JSON and schema' : 'Valid JSON',
    };
  })();

  return (
    <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={pill.tone} icon={pill.icon}>
          {pill.label}
        </StatusPill>
        {report.truncated ? (
          <span className="text-2xs text-warning">
            Stopped after {report.counts.total} findings.
          </span>
        ) : null}
        {schemaName ? (
          <span className="text-2xs text-ink-muted">
            against <span className="font-mono text-ink-secondary">{schemaName}</span>
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-ink-secondary">{describeValidation(report)}</p>
      {report.status === 'skipped' && report.skippedReason ? (
        <p className="text-2xs text-ink-muted">{report.skippedReason}</p>
      ) : null}
    </div>
  );
}

/**
 * The non-negotiable scope statement (ADR-85).
 *
 * Rendered on every validation surface, non-dismissible, and phrased so it
 * cannot be read as a quality score.
 */
export function ValidationScopeNote({ className }: { readonly className?: string }) {
  return (
    <p className={className}>
      Validation checks <strong className="font-medium text-ink-secondary">syntax</strong> and, when
      a schema is attached, <strong className="font-medium text-ink-secondary">structure</strong>.
      It is not a judgement of prompt quality, clarity, or whether a model will follow it.
    </p>
  );
}
