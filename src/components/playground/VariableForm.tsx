import { RotateCcw } from 'lucide-react';

import { Badge, Button, Field, Input, Switch, Textarea } from '@/components/ui';
import {
  VARIABLE_TYPE_HINTS,
  describeVariableDefault,
  describeVariableType,
  type VariableInputState,
  type VariableReconciliation,
} from '@/domain/variables';
import type { VariableDefinition } from '@/domain/types';
import { cn } from '@/lib/cn';

export interface VariableFormProps {
  readonly variables: readonly VariableDefinition[];
  readonly inputs: Readonly<Record<string, string>>;
  readonly parsed: Readonly<Record<string, VariableInputState>>;
  readonly reconciliation: VariableReconciliation;
  /** How many placeholders in the document are not usable names. */
  readonly problemCount: number;
  readonly onChange: (name: string, raw: string) => void;
  readonly onReset: (name: string) => void;
  readonly onResetAll: () => void;
}

/**
 * Typed inputs for a document's declared variables (TASK-021).
 *
 * Each field is labelled with the variable's name, carries a worded type badge
 * and a required marker, and reports parse errors through the shared `Field`
 * wiring (`aria-describedby` + `aria-invalid`). A boolean gets a switch and an
 * explicit "not set" state, because a switch that is merely off cannot say
 * whether it means `false` or "no answer yet".
 *
 * Nothing here is decorated for looks: the report at the bottom names unused
 * declarations, undeclared references, and unusable placeholders, which is the
 * difference between a prompt that renders and one that only looks finished.
 */
export function VariableForm({
  variables,
  inputs,
  parsed,
  reconciliation,
  problemCount,
  onChange,
  onReset,
  onResetAll,
}: VariableFormProps) {
  return (
    <section aria-labelledby="playground-variables" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id="playground-variables" className="text-sm font-semibold text-ink">
            Variables
          </h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">
            {variables.length === 0
              ? 'This prompt declares no variables.'
              : `${variables.length} declared · values are kept in this tab only.`}
          </p>
        </div>
        {variables.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={onResetAll}>
            <RotateCcw aria-hidden="true" size={12} />
            Reset all to defaults
          </Button>
        ) : null}
      </div>

      {variables.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-3 text-xs leading-relaxed text-ink-secondary">
          Add a variable to the document and reference it as{' '}
          <span className="font-mono">{'{{name}}'}</span> to fill it in here.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {variables.map((variable) => (
            <VariableField
              key={variable.name}
              variable={variable}
              raw={inputs[variable.name] ?? ''}
              state={parsed[variable.name] ?? { state: 'empty' }}
              onChange={onChange}
              onReset={onReset}
            />
          ))}
        </ul>
      )}

      <VariableReport
        reconciliation={reconciliation}
        problemCount={problemCount}
        variableCount={variables.length}
      />
    </section>
  );
}

interface VariableFieldProps {
  readonly variable: VariableDefinition;
  readonly raw: string;
  readonly state: VariableInputState;
  readonly onChange: (name: string, raw: string) => void;
  readonly onReset: (name: string) => void;
}

function VariableField({ variable, raw, state, onChange, onReset }: VariableFieldProps) {
  const error = state.state === 'invalid' ? state.error : undefined;
  const defaultValue = describeVariableDefault(variable);
  const id = `variable-${variable.name}`;
  const booleanValue = raw === 'true' ? 'true' : raw === 'false' ? 'false' : 'not set';

  return (
    <li className="rounded-md border border-line bg-surface-1 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 id={`${id}-label`} className="font-mono text-xs font-medium break-all text-ink">
          {variable.name}
        </h3>
        <Badge tone="neutral">{describeVariableType(variable.type)}</Badge>
        <Badge tone={variable.required ? 'warning' : 'neutral'}>
          {variable.required ? 'Required' : 'Optional'}
        </Badge>
      </div>

      {variable.description ? (
        <p className="mt-1 text-2xs leading-relaxed text-ink-muted">{variable.description}</p>
      ) : null}

      <div className="mt-2">
        {variable.type === 'boolean' ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Switch
              id={id}
              label={<span className="text-xs text-ink-secondary">Value</span>}
              hint="Off is false. Until you toggle it, the variable has no answer."
              checked={raw === 'true'}
              onCheckedChange={(checked) => onChange(variable.name, checked ? 'true' : 'false')}
            />
            <span
              className={cn(
                'font-mono text-2xs',
                raw === 'true' || raw === 'false' ? 'text-ink' : 'text-ink-muted italic',
              )}
            >
              {booleanValue}
            </span>
          </div>
        ) : (
          <Field
            label={variable.name}
            hideLabel
            required={variable.required}
            error={error}
            hint={VARIABLE_TYPE_HINTS[variable.type]}
          >
            {(control) =>
              variable.type === 'json' ? (
                <Textarea
                  {...control}
                  mono
                  autoResize
                  rows={5}
                  invalid={Boolean(error)}
                  value={raw}
                  placeholder={'{ "key": "value" }'}
                  spellCheck={false}
                  onChange={(event) => onChange(variable.name, event.target.value)}
                />
              ) : variable.type === 'number' ? (
                <Input
                  {...control}
                  // Deliberately not `type="number"`: a browser silently discards
                  // text it does not consider numeric, which would drop a typed
                  // character without saying so. A decimal keyboard plus the
                  // parser's own message keeps the entry and explains it.
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  invalid={Boolean(error)}
                  value={raw}
                  placeholder="42"
                  onChange={(event) => onChange(variable.name, event.target.value)}
                />
              ) : (
                <Textarea
                  {...control}
                  autoResize
                  rows={3}
                  invalid={Boolean(error)}
                  value={raw}
                  placeholder="Text for this variable"
                  onChange={(event) => onChange(variable.name, event.target.value)}
                />
              )
            }
          </Field>
        )}

        {variable.type === 'boolean' && error ? (
          <p role="alert" className="mt-1 text-2xs text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
        <p className="min-w-0 text-2xs break-words text-ink-muted">
          {defaultValue === null ? (
            'No default value.'
          ) : (
            <>
              Default: <span className="font-mono text-ink-secondary">{defaultValue}</span>
            </>
          )}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onReset(variable.name)}
          aria-label={`Reset ${variable.name} to ${defaultValue === null ? 'empty' : 'its default'}`}
        >
          <RotateCcw aria-hidden="true" size={11} />
          Reset
        </Button>
      </div>
    </li>
  );
}

interface VariableReportProps {
  readonly reconciliation: VariableReconciliation;
  readonly problemCount: number;
  readonly variableCount: number;
}

function VariableReport({ reconciliation, problemCount, variableCount }: VariableReportProps) {
  const nothingToSay =
    reconciliation.unused.length === 0 &&
    reconciliation.undeclared.length === 0 &&
    problemCount === 0;

  if (nothingToSay) {
    return (
      <p className="text-2xs leading-relaxed text-ink-muted">
        {variableCount === 0
          ? 'No variables are declared, so the text renders exactly as written.'
          : 'Every declared variable is used, and every placeholder is declared.'}
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-warning/35 bg-warning-soft p-3">
      <h3 className="text-2xs font-semibold tracking-wide text-warning uppercase">
        What will not render as written
      </h3>
      <ul className="space-y-1 text-2xs leading-relaxed text-ink-secondary">
        {reconciliation.unused.length > 0 ? (
          <li>
            <span className="font-medium text-ink">Declared but never used:</span>{' '}
            {reconciliation.unused.map((variable) => variable.name).join(', ')}. These inputs do not
            appear in the text.
          </li>
        ) : null}
        {reconciliation.undeclared.length > 0 ? (
          <li>
            <span className="font-medium text-ink">Used but not declared:</span>{' '}
            {reconciliation.undeclared
              .map((entry) => `${entry.name} (${entry.paths[0] ?? 'unknown place'})`)
              .join(', ')}
            . Their placeholders stay visible.
          </li>
        ) : null}
        {problemCount > 0 ? (
          <li>
            <span className="font-medium text-ink">
              {problemCount} {problemCount === 1 ? 'placeholder is' : 'placeholders are'} not a
              variable name.
            </span>{' '}
            Only <span className="font-mono">{'{{letters_and_digits}}'}</span> can be resolved; no
            expressions are evaluated.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
