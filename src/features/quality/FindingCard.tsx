import { AlertTriangle, CircleAlert, Info, ScanSearch } from 'lucide-react';
import { useId } from 'react';

import { Badge, Button, CopyButton, StatusPill } from '@/components/ui';
import {
  QUALITY_CLASSIFICATION_LABELS,
  QUALITY_SEVERITY_LABELS,
  findingToText,
  type QualityFinding,
  type QualitySeverity,
} from '@/domain/quality';

const SEVERITY_META: Readonly<
  Record<QualitySeverity, { icon: typeof CircleAlert; tone: 'danger' | 'warning' | 'info' }>
> = {
  error: { icon: CircleAlert, tone: 'danger' },
  warning: { icon: AlertTriangle, tone: 'warning' },
  info: { icon: Info, tone: 'info' },
};

/** A document path as a reader can use it, with the root spelled out. */
function displayPath(path: string): string {
  return path.length === 0 ? '(the whole document)' : path;
}

export interface FindingCardProps {
  readonly finding: QualityFinding;
  /** Puts the editor caret on the finding's field. Never edits anything. */
  readonly onOpenPath: (path: string) => void;
  /** Opens the dismiss form; the reason is required there. */
  readonly onDismiss: (finding: QualityFinding) => void;
}

/**
 * One quality finding (TASK-024).
 *
 * The card states a fact about the document, why the rule fired, and what the
 * reader could do — and it says which kind of rule it came from, so a rule of
 * thumb is never presented as a defect. Nothing on this card changes the prompt:
 * the actions are "go to the field", "copy", and "dismiss".
 */
export function FindingCard({ finding, onOpenPath, onDismiss }: FindingCardProps) {
  const meta = SEVERITY_META[finding.severity];
  const Icon = meta.icon;
  const disclosureId = useId();

  return (
    <article className="min-w-0 rounded-md border border-line bg-surface-1 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <StatusPill tone={meta.tone} icon={<Icon size={12} strokeWidth={2} />}>
            {QUALITY_SEVERITY_LABELS[finding.severity]}
          </StatusPill>
          <Badge tone={finding.classification === 'deterministic' ? 'accent' : 'neutral'}>
            {QUALITY_CLASSIFICATION_LABELS[finding.classification]}
          </Badge>
          <span className="font-mono text-2xs text-ink-muted">{displayPath(finding.path)}</span>
        </div>
      </div>

      <h4 className="mt-2 text-sm font-medium text-ink">{finding.title}</h4>

      {finding.evidence.length > 0 ? (
        <pre className="mt-2 max-h-24 overflow-auto rounded-xs border border-line bg-surface-2 px-2 py-1.5 font-mono text-2xs break-words whitespace-pre-wrap text-ink-secondary">
          {finding.evidence}
        </pre>
      ) : null}

      <details className="group mt-2">
        <summary
          id={disclosureId}
          className="cursor-pointer rounded-xs text-xs text-ink-muted marker:text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Why this was flagged
        </summary>
        <div className="mt-2 space-y-2 border-l-2 border-line pl-3 text-xs leading-relaxed">
          <p className="text-ink-secondary">{finding.explanation}</p>
          <p className="text-ink-muted">
            <span className="font-medium text-ink-secondary">Suggested fix: </span>
            {finding.suggestion}
          </p>
          <p className="text-ink-muted">
            Nothing here edits your prompt; this is a suggestion you can ignore.
          </p>
        </div>
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {finding.inDocument ? (
          <Button variant="secondary" size="sm" onClick={() => onOpenPath(finding.path)}>
            <ScanSearch aria-hidden="true" size={13} />
            Go to the field
          </Button>
        ) : null}
        <CopyButton
          value={findingToText(finding)}
          label="Copy finding"
          copiedLabel="Finding copied"
          size="sm"
          variant="ghost"
        />
        <Button variant="ghost" size="sm" onClick={() => onDismiss(finding)}>
          Dismiss…
        </Button>
      </div>
    </article>
  );
}
