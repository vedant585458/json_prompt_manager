import { useMemo, useState } from 'react';

import { Badge, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { describeCoverage, formatCaseInputs, resolveCaseInputs } from '@/domain/lab';
import type { PlaygroundCarryOver } from '@/features/testCases/playgroundBridge';
import type { JsonValue, PromptSchema, VariableDefinition } from '@/domain/types';
import { formatVariableInput, parseVariableInput } from '@/domain/variables';
import { cn } from '@/lib/cn';

export interface CaseDraft {
  readonly name: string;
  readonly inputValues: Readonly<Record<string, JsonValue>>;
  readonly expectedStructure: string | null;
}

export interface CaseEditorProps {
  readonly variables: readonly VariableDefinition[];
  /** Schemas that may be attached as the expected structure. */
  readonly schemas: readonly PromptSchema[];
  /** The case being edited; omitted when creating a new one. */
  readonly existing?: CaseDraft | null;
  /** Values carried over from the playground, used only when creating. */
  readonly seed?: PlaygroundCarryOver | null;
  readonly pending: boolean;
  /** A save error from the store, already phrased for the user. */
  readonly error: string | null;
  readonly onSubmit: (draft: CaseDraft) => void;
  readonly onCancel: () => void;
}

const NOT_SET = '';

/** Form text for a case's stored values, one entry per declared variable. */
function textFor(
  variables: readonly VariableDefinition[],
  values: Readonly<Record<string, JsonValue>>,
): Record<string, string> {
  const formatted = formatCaseInputs(variables, values);
  return Object.fromEntries(
    variables.map((variable) => [variable.name, formatted[variable.name] ?? NOT_SET]),
  );
}

interface ParsedFields {
  readonly values: Record<string, JsonValue>;
  readonly errors: Readonly<Record<string, string>>;
}

function parseFields(
  variables: readonly VariableDefinition[],
  inputs: Readonly<Record<string, string>>,
): ParsedFields {
  const values: Record<string, JsonValue> = {};
  const errors: Record<string, string> = {};

  for (const variable of variables) {
    const raw = inputs[variable.name] ?? NOT_SET;

    // An empty field means "no answer", exactly as it does in the playground. A
    // string type would otherwise parse to `''` and quietly turn "unanswered"
    // into "answered with nothing" every time a case was edited.
    if (raw === '') continue;

    const parsed = parseVariableInput(variable, raw);
    if (parsed.state === 'value') {
      values[variable.name] = parsed.value;
    } else if (parsed.state === 'invalid') {
      errors[variable.name] = parsed.error;
    }
  }

  return { values, errors };
}

/**
 * Creates or edits one saved test case (TASK-022).
 *
 * A case is data, not an execution. The form therefore refuses only what cannot
 * be stored faithfully — an unusable typed value, an empty name — and shows the
 * coverage it would have, so "this case cannot run yet" is visible before the
 * user saves rather than only after a run is blocked.
 */
export function CaseEditor({
  variables,
  schemas,
  existing = null,
  seed = null,
  pending,
  error,
  onSubmit,
  onCancel,
}: CaseEditorProps) {
  const [name, setName] = useState(existing?.name ?? '');
  const [structure, setStructure] = useState(existing?.expectedStructure ?? NOT_SET);
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    textFor(variables, existing?.inputValues ?? seed?.values ?? {}),
  );

  const parsed = useMemo(() => parseFields(variables, inputs), [variables, inputs]);
  const report = useMemo(
    () => resolveCaseInputs(variables, parsed.values),
    [variables, parsed.values],
  );

  const invalidFields = Object.keys(parsed.errors);
  const requiredMissing = report.problems.filter(
    (problem) => problem.severity === 'error' && problem.category === 'inputs',
  );
  const canSubmit = name.trim().length > 0 && invalidFields.length === 0 && !pending;

  const seedNotes = existing === null && seed ? seed.problems : [];

  return (
    <form
      className="flex min-w-0 flex-col gap-3"
      aria-labelledby="case-editor-heading"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          name,
          inputValues: parsed.values,
          expectedStructure: structure === NOT_SET ? null : structure,
        });
      }}
    >
      <div>
        <h3 id="case-editor-heading" className="text-sm font-semibold text-ink">
          {existing ? 'Edit test case' : 'New test case'}
        </h3>
        <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">
          Values are stored with this prompt in this browser. Nothing is sent anywhere and no model
          is called.
        </p>
      </div>

      <Field label="Case name" required error={error ?? undefined}>
        {(control) => (
          <Input
            {...control}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Billing, urgent"
            autoComplete="off"
          />
        )}
      </Field>

      <Field
        label="Expected structure"
        hint="Optional. Checks the rendered text against a stored schema when the case runs."
      >
        {(control) => (
          <Select
            {...control}
            value={structure}
            onChange={(event) => setStructure(event.target.value)}
            options={[
              { value: NOT_SET, label: 'No expected structure' },
              ...schemas.map((schema) => ({ value: schema.id, label: schema.name })),
            ]}
          />
        )}
      </Field>

      {seedNotes.length > 0 ? (
        <ul className="space-y-1 rounded-sm border border-warning/35 bg-warning-soft p-2 text-2xs leading-relaxed text-ink-secondary">
          {seedNotes.map((problem) => (
            <li key={problem.name ?? problem.message}>{problem.message}</li>
          ))}
        </ul>
      ) : null}

      {variables.length === 0 ? (
        <p className="text-2xs leading-relaxed text-ink-muted">
          This prompt declares no variables, so a case only needs a name.
        </p>
      ) : (
        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
            Variable values
          </legend>
          {variables.map((variable) => {
            const value = inputs[variable.name] ?? NOT_SET;
            const fieldError = parsed.errors[variable.name];

            return (
              <Field
                key={variable.name}
                label={variable.name}
                required={variable.required}
                error={fieldError}
                hint={[
                  `${variable.type}${variable.required ? ' · required' : ' · optional'}`,
                  variable.defaultValue === undefined
                    ? null
                    : `default ${formatVariableInput(variable, variable.defaultValue)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              >
                {(control) =>
                  variable.type === 'json' ? (
                    <Textarea
                      {...control}
                      mono
                      rows={4}
                      value={value}
                      onChange={(event) =>
                        setInputs((current) => ({
                          ...current,
                          [variable.name]: event.target.value,
                        }))
                      }
                      placeholder='{"key": "value"}'
                    />
                  ) : variable.type === 'boolean' ? (
                    <Select
                      {...control}
                      value={value}
                      onChange={(event) =>
                        setInputs((current) => ({
                          ...current,
                          [variable.name]: event.target.value,
                        }))
                      }
                      options={[
                        { value: NOT_SET, label: 'Not answered' },
                        { value: 'true', label: 'true' },
                        { value: 'false', label: 'false' },
                      ]}
                    />
                  ) : (
                    <Input
                      {...control}
                      mono={variable.type === 'number'}
                      inputMode={variable.type === 'number' ? 'decimal' : undefined}
                      value={value}
                      onChange={(event) =>
                        setInputs((current) => ({
                          ...current,
                          [variable.name]: event.target.value,
                        }))
                      }
                      autoComplete="off"
                    />
                  )
                }
              </Field>
            );
          })}
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-2 text-2xs text-ink-muted">
        <Badge tone={requiredMissing.length > 0 ? 'warning' : 'neutral'}>
          {describeCoverage(report.coverage)}
        </Badge>
        {requiredMissing.length > 0 ? (
          <span>
            {requiredMissing.length === 1
              ? 'One required value is missing, so a run will be blocked until it is filled in.'
              : `${requiredMissing.length} required values are missing, so a run will be blocked until they are filled in.`}
          </span>
        ) : (
          <span>Every required value is present.</span>
        )}
      </div>

      <div className={cn('flex flex-wrap gap-2')}>
        <Button type="submit" variant="primary" size="sm" disabled={!canSubmit} loading={pending}>
          {existing ? 'Save changes' : 'Save test case'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
