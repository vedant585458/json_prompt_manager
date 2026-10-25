import { ListChecks, RotateCcw, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Select,
  buttonVariants,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  QUALITY_CLASSIFICATION_LABELS,
  QUALITY_CLASSIFICATION_NOTES,
  QUALITY_LIMITS,
  QUALITY_RULES,
  QUALITY_SEVERITIES,
  QUALITY_SEVERITY_LABELS,
  applyDismissals,
  describeQualityRule,
  summarizeQuality,
  type QualityClassification,
  type QualityFinding,
  type QualityReport,
  type QualitySeverity,
} from '@/domain/quality';
import { DismissDialog } from '@/features/quality/DismissDialog';
import { FindingCard } from '@/features/quality/FindingCard';
import type { QualityDismissalsApi } from '@/features/quality/useQualityDismissals';

type SeverityFilter = 'all' | QualitySeverity;
type ClassificationFilter = 'all' | QualityClassification;

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'Every severity' },
  ...QUALITY_SEVERITIES.map((severity) => ({
    value: severity,
    label: QUALITY_SEVERITY_LABELS[severity],
  })),
];

const CLASSIFICATION_OPTIONS = [
  { value: 'all', label: 'Every kind of rule' },
  { value: 'deterministic', label: QUALITY_CLASSIFICATION_LABELS.deterministic },
  { value: 'heuristic', label: QUALITY_CLASSIFICATION_LABELS.heuristic },
];

export interface QualityPanelProps {
  /** The inspection of the current draft, derived by the caller. */
  readonly report: QualityReport;
  readonly promptId: string;
  /** Dismissal state, owned by the caller so the header chip agrees with the tab. */
  readonly dismissals: QualityDismissalsApi;
  /** Puts the editor caret on a document path. Never edits the prompt. */
  readonly onOpenPath: (path: string) => void;
}

/**
 * Quality inspector (TASK-024).
 *
 * Rule-based review of the draft document: what is missing, what refers to
 * something that is gone, and what a rule of thumb would change. Every finding
 * names its rule, its classification, and why it fired; dismissals are stored per
 * prompt, with a reason, and come back when the content they name changes.
 *
 * The screen cannot edit anything. Its actions are "go to the field", "copy",
 * and "dismiss", and it says so at the top.
 */
export function QualityPanel({ report, promptId, dismissals: api, onOpenPath }: QualityPanelProps) {
  const toast = useToast();
  const { dismissals, available, error: storageError, dismiss, restore, restoreAll } = api;

  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [classification, setClassification] = useState<ClassificationFilter>('all');
  const [showDismissed, setShowDismissed] = useState(false);
  const [pending, setPending] = useState<QualityFinding | null>(null);

  const split = useMemo(
    () => applyDismissals(report.findings, dismissals),
    [dismissals, report.findings],
  );

  const filtered = useMemo(
    () =>
      split.visible.filter(
        (finding) =>
          (severity === 'all' || finding.severity === severity) &&
          (classification === 'all' || finding.classification === classification),
      ),
    [classification, severity, split.visible],
  );

  const groups = useMemo(
    () =>
      QUALITY_SEVERITIES.map((value) => ({
        severity: value,
        findings: filtered.filter((finding) => finding.severity === value),
      })).filter((group) => group.findings.length > 0),
    [filtered],
  );

  const handleConfirm = (finding: QualityFinding, reason: string): string | null => {
    const outcome = dismiss(finding, reason);
    if (!outcome.ok) return outcome.error;

    setPending(null);
    toast.success({
      title: 'Finding dismissed',
      description: `${describeQualityRule(finding.ruleId)} stays hidden for this prompt until its content changes.`,
    });
    return null;
  };

  const handleRestoreAll = () => {
    const outcome = restoreAll();
    if (!outcome.ok) {
      toast.error({ title: 'The dismissals were not cleared', description: outcome.error });
      return;
    }

    toast.success({ title: 'Dismissals cleared' });
  };

  const handleRestore = (fingerprint: string) => {
    const outcome = restore(fingerprint);
    if (!outcome.ok) {
      toast.error({ title: 'The dismissal was not restored', description: outcome.error });
      return;
    }

    toast.success({ title: 'Finding restored' });
  };

  const hasAnything = report.findings.length > 0;
  const visibleCount = split.visible.length;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Alert tone="info" title="Rule-based review, not a score">
        <p className="text-xs leading-relaxed">
          Every finding comes from a written rule in this build, checked against this draft. Nothing
          here calls a model, and nothing here changes your prompt.
        </p>
        <dl className="mt-2 space-y-1 text-2xs leading-relaxed">
          {(['deterministic', 'heuristic'] as const).map((value) => (
            <div key={value} className="flex flex-wrap gap-x-1.5">
              <dt className="font-mono tracking-wide uppercase text-ink-secondary">
                {QUALITY_CLASSIFICATION_LABELS[value]}
              </dt>
              <dd className="text-ink-muted">{QUALITY_CLASSIFICATION_NOTES[value]}</dd>
            </div>
          ))}
        </dl>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-secondary" role="status">
          {summarizeQuality(split.visible)}
          {split.dismissed.length > 0 ? ` · ${split.dismissed.length} dismissed` : ''}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-2xs tracking-wide text-ink-muted uppercase">
              Severity
            </span>
            <Select
              size="sm"
              aria-label="Filter by severity"
              value={severity}
              options={SEVERITY_OPTIONS}
              onChange={(event) => setSeverity(event.target.value as SeverityFilter)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-2xs tracking-wide text-ink-muted uppercase">Rule</span>
            <Select
              size="sm"
              aria-label="Filter by rule kind"
              value={classification}
              options={CLASSIFICATION_OPTIONS}
              onChange={(event) => setClassification(event.target.value as ClassificationFilter)}
            />
          </label>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={showDismissed}
            onClick={() => setShowDismissed((open) => !open)}
            disabled={split.dismissed.length === 0}
          >
            <ListChecks aria-hidden="true" size={13} />
            Dismissed
            <span className="font-mono text-2xs text-ink-muted">{split.dismissed.length}</span>
          </Button>
        </div>
      </div>

      {!available ? (
        <Alert tone="warning" title="Dismissals cannot be stored here">
          <p className="text-xs leading-relaxed">
            This browser refuses local storage, so a dismissal would be forgotten on reload. The
            findings below are unaffected.
          </p>
        </Alert>
      ) : null}

      {storageError ? (
        <Alert tone="warning" title="The last dismissal was not stored">
          <p className="text-xs leading-relaxed">{storageError}</p>
        </Alert>
      ) : null}

      {!hasAnything ? (
        <EmptyState
          icon={ShieldCheck}
          title="No structural findings"
          description="Every rule ran and found nothing to report in this draft. That is a statement about structure — missing pieces and broken references — not about how well the prompt works."
          action={
            <Link
              to={`/validation?prompt=${encodeURIComponent(promptId)}`}
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
            >
              Check it against a schema
            </Link>
          }
        />
      ) : null}

      {hasAnything && visibleCount === 0 ? (
        <Alert tone="success" title="Every finding is dismissed">
          <p className="text-xs leading-relaxed">
            {split.dismissed.length === 1
              ? 'The one finding in this draft has been dismissed with a reason.'
              : `All ${split.dismissed.length} findings in this draft have been dismissed with a reason.`}{' '}
            Open “Dismissed” to read them or bring one back.
          </p>
        </Alert>
      ) : null}

      {hasAnything && visibleCount > 0 && filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-4 text-xs text-ink-muted">
          No finding matches these filters.{' '}
          <button
            type="button"
            className="rounded-xs underline hover:text-ink"
            onClick={() => {
              setSeverity('all');
              setClassification('all');
            }}
          >
            Clear the filters
          </button>{' '}
          to see all {visibleCount}.
        </p>
      ) : null}

      {groups.map((group) => {
        const headingId = `quality-group-${group.severity}`;

        return (
          <section key={group.severity} aria-labelledby={headingId} className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 id={headingId} className="font-display text-sm text-ink">
                {group.severity === 'info'
                  ? 'Suggestions'
                  : `${QUALITY_SEVERITY_LABELS[group.severity]}s`}
              </h3>
              <Badge tone="neutral">{group.findings.length}</Badge>
            </div>
            <ul className="mt-2 space-y-2">
              {group.findings.map((finding) => (
                <li key={finding.id} className="min-w-0">
                  <FindingCard
                    finding={finding}
                    onOpenPath={onOpenPath}
                    onDismiss={(target) => setPending(target)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {showDismissed && split.dismissed.length > 0 ? (
        <section aria-labelledby="quality-dismissed" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="quality-dismissed" className="font-display text-sm text-ink">
              Dismissed
            </h3>
            <Button variant="ghost" size="sm" onClick={handleRestoreAll}>
              <RotateCcw aria-hidden="true" size={13} />
              Restore all
            </Button>
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-ink-muted">
            Stored in this browser for this prompt. A dismissal is tied to the exact content it was
            made about, so editing that field brings the finding back.
          </p>
          <ul className="mt-2 space-y-2">
            {split.dismissed.map(({ finding, dismissal }) => (
              <li
                key={finding.id}
                className="min-w-0 rounded-md border border-line bg-surface-2 px-3 py-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-ink">{finding.title}</p>
                    <p className="mt-0.5 font-mono text-2xs text-ink-muted">
                      {finding.path.length === 0 ? '(the whole document)' : finding.path} ·{' '}
                      {dismissal.ruleId}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      “{dismissal.reason}”
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(finding.fingerprint)}
                  >
                    Restore
                  </Button>
                </div>
                <p className="mt-1 text-2xs text-ink-muted">
                  Dismissed {new Date(dismissal.dismissedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {split.orphaned.length > 0 ? (
        <Alert tone="info" title="Some dismissals no longer match">
          <p className="text-xs leading-relaxed">
            {split.orphaned.length === 1
              ? 'One stored dismissal'
              : `${split.orphaned.length} stored dismissals`}{' '}
            no longer match a finding in this draft — the content they were made about has changed,
            so the finding is shown again.
          </p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={handleRestoreAll}>
            Forget the stale dismissals
          </Button>
        </Alert>
      ) : null}

      {report.dropped > 0 ? (
        <p className="text-2xs leading-relaxed text-ink-muted">
          {report.dropped} further {report.dropped === 1 ? 'finding was' : 'findings were'} not
          shown: this screen lists at most {QUALITY_LIMITS.maxFindingsPerRule} findings per rule.
        </p>
      ) : null}

      {report.skipped.length > 0 ? (
        <details className="rounded-md border border-line bg-surface-1 px-3 py-2">
          <summary className="cursor-pointer rounded-xs text-xs text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {report.skipped.length}{' '}
            {report.skipped.length === 1 ? 'check did not run' : 'checks did not run'} — and why
          </summary>
          <ul className="mt-2 space-y-1 text-2xs leading-relaxed text-ink-muted">
            {report.skipped.map((skip) => (
              <li key={skip.ruleId}>
                <span className="text-ink-secondary">{describeQualityRule(skip.ruleId)}</span> —{' '}
                {skip.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <details className="rounded-md border border-line bg-surface-1 px-3 py-2">
        <summary className="cursor-pointer rounded-xs text-xs text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          The {QUALITY_RULES.length} rules and their thresholds
        </summary>
        <div className="mt-2 space-y-2 text-2xs leading-relaxed text-ink-muted">
          <p>
            Length thresholds used by the oversized-content rule: objective{' '}
            {report.thresholds.objective.toLocaleString()}, each instruction{' '}
            {report.thresholds.instruction.toLocaleString()}, context description{' '}
            {report.thresholds.contextDescription.toLocaleString()}, notes{' '}
            {report.thresholds.notes.toLocaleString()}, whole document{' '}
            {report.thresholds.document.toLocaleString()} characters. Nothing is truncated or
            refused at these sizes.
          </p>
          <ul className="space-y-1">
            {QUALITY_RULES.map((rule) => (
              <li key={rule.id}>
                <span className="font-mono text-ink-secondary">{rule.id}</span> —{' '}
                {QUALITY_CLASSIFICATION_LABELS[rule.classification].toLowerCase()},{' '}
                {QUALITY_SEVERITY_LABELS[rule.severity].toLowerCase()}. {rule.checks}
              </li>
            ))}
          </ul>
          <p className="text-ink-muted">
            These rules read the document; they never run it and never rewrite it.
          </p>
        </div>
      </details>

      <p className="text-2xs leading-relaxed text-ink-muted">
        Findings describe structure — missing pieces, broken references, duplicated lines — and are
        not a judgement of prompt quality. Nothing on this screen edits the prompt.
      </p>

      <DismissDialog
        finding={pending}
        onCancel={() => setPending(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
