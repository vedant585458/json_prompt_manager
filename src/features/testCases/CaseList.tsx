import { Copy, FlaskConical, Pencil, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge, Button, ConfirmDialog, EmptyState, IconButton, Tooltip } from '@/components/ui';
import { describeCoverage, resolveCaseInputs } from '@/domain/lab';
import type { JsonValue, VariableDefinition } from '@/domain/types';
import { formatRelativeTime } from '@/lib/dates';

export interface CaseSummary {
  readonly id: string;
  readonly name: string;
  readonly inputValues: Readonly<Record<string, JsonValue>>;
  readonly expectedStructure: string | null;
  readonly updatedAt: string;
}

export interface CaseListProps {
  readonly cases: readonly CaseSummary[];
  readonly variables: readonly VariableDefinition[];
  /** Resolves a schema id to its display name, or null when it is missing. */
  readonly schemaName: (schemaId: string) => string | null;
  readonly now?: Date;
  readonly onCreate: () => void;
  readonly onEdit: (testCase: CaseSummary) => void;
  readonly onRun: (testCase: CaseSummary) => void;
  readonly onLoadIntoPlayground: (testCase: CaseSummary) => void;
  readonly onDuplicate: (testCase: CaseSummary) => void;
  readonly onDelete: (testCase: CaseSummary) => void;
  readonly pendingId: string | null;
}

/**
 * The saved test cases of one prompt (TASK-022).
 *
 * Each row states what the case actually holds — how many declared variables it
 * answers and when it last changed — so a stale case is visible as stale rather
 * than as a nameless option in a dropdown. Deleting asks first and says that the
 * prompt itself is unaffected.
 */
export function CaseList({
  cases,
  variables,
  schemaName,
  now = new Date(),
  onCreate,
  onEdit,
  onRun,
  onLoadIntoPlayground,
  onDuplicate,
  onDelete,
  pendingId,
}: CaseListProps) {
  const [pending, setPending] = useState<CaseSummary | null>(null);

  if (cases.length === 0) {
    return (
      <EmptyState
        title="No saved test cases yet"
        description="A test case is a named set of variable values. Save one, then render it here to see exactly what this prompt produces for those inputs."
        action={
          <Button variant="secondary" size="sm" onClick={() => onCreate()}>
            New test case
          </Button>
        }
      />
    );
  }

  return (
    <>
      <ul className="flex min-w-0 flex-col divide-y divide-line">
        {cases.map((testCase) => {
          const report = resolveCaseInputs(variables, testCase.inputValues);
          const blocking = report.problems.filter((problem) => problem.severity === 'error');
          const expected = testCase.expectedStructure
            ? schemaName(testCase.expectedStructure)
            : null;
          const pendingThis = pendingId === testCase.id;

          return (
            <li
              key={testCase.id}
              className="flex min-w-0 flex-col gap-2 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{testCase.name}</p>
                  <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">
                    {describeCoverage(report.coverage)} · updated{' '}
                    {formatRelativeTime(testCase.updatedAt, now)}
                    {testCase.expectedStructure
                      ? expected
                        ? ` · expects ${expected}`
                        : ' · expects a schema that no longer exists'
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  {blocking.length > 0 ? (
                    <Badge tone="warning">
                      {blocking.length === 1
                        ? '1 missing value blocks a run'
                        : `${blocking.length} missing values block a run`}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Ready to run</Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onRun(testCase)}
                  disabled={pendingId !== null}
                  loading={pendingThis}
                >
                  <Play aria-hidden="true" size={12} />
                  Run
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEdit(testCase)}>
                  <Pencil aria-hidden="true" size={12} />
                  Edit
                </Button>
                <Tooltip content="Copy this case's values into the playground for this tab">
                  <Button variant="ghost" size="sm" onClick={() => onLoadIntoPlayground(testCase)}>
                    <FlaskConical aria-hidden="true" size={12} />
                    Open in playground
                  </Button>
                </Tooltip>
                <Tooltip content="Copy this case under a new name">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDuplicate(testCase)}
                    disabled={pendingId !== null}
                  >
                    <Copy aria-hidden="true" size={12} />
                    Duplicate
                  </Button>
                </Tooltip>
                <IconButton
                  label={`Delete the “${testCase.name}” test case`}
                  variant="ghost"
                  size="sm"
                  onClick={() => setPending(testCase)}
                  disabled={pendingId !== null}
                >
                  <Trash2 aria-hidden="true" size={12} />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        tone="destructive"
        title={`Delete “${pending?.name ?? ''}”?`}
        description={
          <p>
            This removes the saved values and the expected structure from this browser. The prompt,
            its history, and the other test cases are not affected. This cannot be undone.
          </p>
        }
        confirmLabel="Delete the case"
        pending={pending !== null && pendingId === pending.id}
        onConfirm={() => {
          if (pending) onDelete(pending);
          setPending(null);
        }}
      />
    </>
  );
}
