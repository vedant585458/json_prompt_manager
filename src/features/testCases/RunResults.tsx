import { AlertTriangle, CheckCircle2, FileWarning, OctagonX } from 'lucide-react';
import type { ReactElement } from 'react';

import { Badge, Card, CopyButton } from '@/components/ui';
import {
  describeLabRun,
  type LabProblem,
  type LabProblemCategory,
  type LabRun,
  type StructureStatus,
} from '@/domain/lab';
import { cn } from '@/lib/cn';

const CATEGORY_ORDER: readonly LabProblemCategory[] = ['document', 'inputs', 'render'];

const CATEGORY_LABEL: Readonly<Record<LabProblemCategory, string>> = {
  document: 'Document',
  inputs: 'Inputs',
  render: 'Rendering',
};

const STRUCTURE_LABEL: Readonly<Record<StructureStatus, string>> = {
  none: 'No structure expected',
  'missing-schema': 'Expected schema is missing',
  'invalid-schema': 'Expected schema is unusable',
  'not-json': 'Rendered text is not JSON',
  pass: 'Structure matches',
  fail: 'Structure does not match',
};

const STRUCTURE_TONE: Readonly<
  Record<StructureStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'>
> = {
  none: 'neutral',
  'missing-schema': 'warning',
  'invalid-schema': 'danger',
  'not-json': 'info',
  pass: 'success',
  fail: 'danger',
};

function ProblemGroup({
  category,
  problems,
}: {
  readonly category: LabProblemCategory;
  readonly problems: readonly LabProblem[];
}) {
  if (problems.length === 0) return null;

  return (
    <div className="min-w-0">
      <h4 className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
        {CATEGORY_LABEL[category]} problems
      </h4>
      <ul className="mt-1 space-y-1">
        {problems.map((problem) => (
          <li
            key={`${category}-${problem.name ?? ''}-${problem.path ?? ''}-${problem.message}`}
            className="flex min-w-0 flex-wrap items-baseline gap-1.5 text-2xs leading-relaxed"
          >
            <span
              className={cn(
                'shrink-0 font-semibold',
                problem.severity === 'error' ? 'text-danger' : 'text-warning',
              )}
            >
              {problem.severity === 'error' ? 'Blocking' : 'Warning'}
            </span>
            {problem.name ? <span className="font-mono text-ink">{problem.name}</span> : null}
            {problem.path ? <span className="font-mono text-ink-muted">{problem.path}</span> : null}
            <span className="min-w-0 text-ink-secondary">{problem.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface RunResultsProps {
  readonly runs: readonly LabRun[];
}

/**
 * The outcome of running saved cases (TASK-022).
 *
 * Every number here is what the local renderer produced: characters, counted
 * literally. There is no token estimate and no quality score, because nothing
 * here ran a model. Problems are grouped by where they came from — the document,
 * the case's inputs, or the renderer — so "my case is incomplete" never reads as
 * "my prompt is broken".
 */
export function RunResults({ runs }: RunResultsProps) {
  if (runs.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-ink-muted">
        Nothing has been run yet. Run a case to render this prompt locally with its saved values.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-2xs leading-relaxed text-ink-muted">
        These are rendered prompts, not model output. No model provider is connected, so no run
        below can tell you how the prompt would be answered.
      </p>

      <ul className="flex min-w-0 flex-col gap-3">
        {runs.map((run) => {
          const errorCount = run.problems.filter((problem) => problem.severity === 'error').length;
          const warningCount = run.problems.filter(
            (problem) => problem.severity === 'warning',
          ).length;

          return (
            <li key={run.caseId}>
              <Card className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink">{run.caseName}</h3>
                    <p className="mt-0.5 text-2xs leading-relaxed text-ink-secondary">
                      {describeLabRun(run)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={run.status === 'rendered' ? 'success' : 'danger'}>
                      {run.status === 'rendered' ? 'Rendered' : 'Blocked'}
                    </Badge>
                    <Badge tone={STRUCTURE_TONE[run.structure.status]}>
                      {STRUCTURE_LABEL[run.structure.status]}
                    </Badge>
                  </div>
                </div>

                <dl className="mt-2 grid grid-cols-2 gap-2 text-2xs sm:grid-cols-4">
                  <div>
                    <dt className="text-ink-muted">Characters</dt>
                    <dd className="tabular font-mono text-ink">
                      {run.characters.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Variables answered</dt>
                    <dd className="tabular font-mono text-ink">
                      {run.inputs.coverage.answered} of {run.inputs.coverage.declared}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Unresolved</dt>
                    <dd className="tabular font-mono text-ink">{run.unresolved.length}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Problems</dt>
                    <dd className="tabular font-mono text-ink">
                      {errorCount} blocking · {warningCount} warning
                      {warningCount === 1 ? '' : 's'}
                    </dd>
                  </div>
                </dl>

                {run.problems.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-sm border border-line bg-surface-2 p-2">
                    {CATEGORY_ORDER.map((category) => (
                      <ProblemGroup
                        key={category}
                        category={category}
                        problems={run.problems.filter((problem) => problem.category === category)}
                      />
                    ))}
                  </div>
                ) : null}

                {run.structure.status !== 'none' ? (
                  <p className="mt-2 text-2xs leading-relaxed text-ink-secondary">
                    <span className="font-semibold text-ink">Expected structure:</span>{' '}
                    {run.structure.message}
                    {run.structure.findings.length > 0 ? (
                      <span className="ml-1 text-ink-muted">
                        ({run.structure.findings.length} finding
                        {run.structure.findings.length === 1 ? '' : 's'})
                      </span>
                    ) : null}
                  </p>
                ) : null}

                {run.status === 'rendered' ? (
                  <div className="mt-3 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
                        Rendered prompt
                      </h4>
                      <CopyButton value={run.text} label="Copy rendered prompt" />
                    </div>
                    <pre className="mt-1 max-h-80 min-w-0 overflow-auto rounded-sm border border-line bg-surface-2 p-2 font-mono text-2xs leading-relaxed whitespace-pre-wrap break-words text-ink">
                      {run.text}
                    </pre>
                  </div>
                ) : (
                  <p className="mt-2 flex items-start gap-1.5 text-2xs leading-relaxed text-ink-secondary">
                    {errorCount > 0 ? (
                      <OctagonX
                        aria-hidden="true"
                        size={12}
                        className="mt-0.5 shrink-0 text-danger"
                      />
                    ) : (
                      <AlertTriangle
                        aria-hidden="true"
                        size={12}
                        className="mt-0.5 shrink-0 text-warning"
                      />
                    )}
                    Nothing was rendered. The blocking problems above are checked before the prompt
                    is rendered, so no partial text was produced.
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A one-line summary of a set of runs, used beside the run button. */
export function RunSummaryLine({
  rendered,
  blocked,
  total,
}: {
  readonly rendered: number;
  readonly blocked: number;
  readonly total: number;
}): ReactElement {
  return (
    <p className="flex items-center gap-1.5 text-2xs leading-relaxed text-ink-secondary">
      {blocked === 0 ? (
        <CheckCircle2 aria-hidden="true" size={12} className="shrink-0 text-success" />
      ) : (
        <FileWarning aria-hidden="true" size={12} className="shrink-0 text-warning" />
      )}
      {total === 0
        ? 'No cases to run.'
        : `${rendered} rendered, ${blocked} blocked of ${total} case${total === 1 ? '' : 's'}.`}
    </p>
  );
}
