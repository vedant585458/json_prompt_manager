import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import { JsonValueField } from '@/components/composer/JsonValueField';
import { Button, Checkbox, Field, IconButton, Input, Select } from '@/components/ui';
import { moveListItem, type ComposerIssue, type ComposerVariable } from '@/domain/composer';
import type { VariableType } from '@/domain/types';

const TYPE_OPTIONS: readonly { value: VariableType; label: string }[] = [
  { value: 'string', label: 'Text (string)' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'json', label: 'JSON value' },
];

export interface VariablesEditorProps {
  readonly variables: readonly ComposerVariable[];
  readonly issues: readonly ComposerIssue[];
  readonly onChange: (variables: ComposerVariable[]) => void;
  /** Reports JSON fields whose text does not parse, so a save can be blocked. */
  readonly onInvalidJsonChange: (key: string, invalid: boolean) => void;
  readonly disabled?: boolean;
}

/**
 * Variable declarations (TASK-017).
 *
 * Each variable is its own fieldset with a legend, so a screen reader announces
 * "Variable 2" before reading its controls. Duplicate and malformed names are
 * errors from the domain model, shown against the row they belong to; a default
 * that contradicts the declared type is refused the same way.
 */
export function VariablesEditor({
  variables,
  issues,
  onChange,
  onInvalidJsonChange,
  disabled = false,
}: VariablesEditorProps) {
  function replace(index: number, changes: Partial<ComposerVariable>) {
    onChange(
      variables.map((variable, position) =>
        position === index ? { ...variable, ...changes } : variable,
      ),
    );
  }

  function issuesFor(index: number) {
    return issues.filter((issue) => issue.path.startsWith(`variables[${index}]`));
  }

  return (
    <div className="space-y-3">
      {variables.length === 0 ? (
        <p className="rounded-sm border border-dashed border-line px-3 py-2 text-xs text-ink-muted">
          No variables yet. A variable is a value the caller supplies before the prompt runs.
        </p>
      ) : null}

      <ol className="space-y-3">
        {variables.map((variable, index) => {
          const rowIssues = issuesFor(index);
          const nameError = rowIssues.find((issue) => issue.path.endsWith('.name'));
          const defaultError = rowIssues.find((issue) => issue.path.endsWith('.defaultValue'));
          const other = rowIssues.filter(
            (issue) => !issue.path.endsWith('.name') && !issue.path.endsWith('.defaultValue'),
          );

          return (
            <li key={index}>
              <fieldset className="min-w-0 space-y-2 rounded-md border border-line bg-surface-1 p-3">
                <legend className="px-1 text-xs font-medium tracking-wide text-ink uppercase">
                  Variable {index + 1}
                </legend>

                {variable.unreadable !== undefined ? (
                  <p className="text-2xs text-warning">
                    This entry is not an object, so it cannot be edited here. It is kept as written.
                  </p>
                ) : (
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    <Field
                      label="Name"
                      required
                      hint="Letters, digits, and underscores; starts with a letter or underscore."
                      {...(nameError ? { error: nameError.message } : {})}
                    >
                      {(control) => (
                        <Input
                          {...control}
                          value={variable.name}
                          disabled={disabled}
                          mono
                          onChange={(event) => replace(index, { name: event.target.value })}
                        />
                      )}
                    </Field>

                    <Field label="Type">
                      {(control) => (
                        <Select
                          {...control}
                          value={variable.type}
                          disabled={disabled}
                          options={TYPE_OPTIONS}
                          onChange={(event) =>
                            replace(index, { type: event.target.value as VariableType })
                          }
                        />
                      )}
                    </Field>

                    <Field label="Description" optionalLabel="Optional">
                      {(control) => (
                        <Input
                          {...control}
                          value={variable.description}
                          disabled={disabled}
                          onChange={(event) => replace(index, { description: event.target.value })}
                        />
                      )}
                    </Field>

                    <div className="flex items-end pb-1">
                      <Checkbox
                        id={`variable-${index}-required`}
                        label="Required"
                        checked={variable.required}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          replace(index, { required: checked === true })
                        }
                      />
                    </div>
                  </div>
                )}

                {variable.unreadable === undefined ? (
                  <JsonValueField
                    label="Default value"
                    hint="Leave empty for no default. The value must match the declared type."
                    value={variable.defaultValue}
                    rows={2}
                    onChange={(value) =>
                      replace(index, {
                        ...(value === undefined
                          ? { defaultValue: undefined }
                          : { defaultValue: value }),
                      })
                    }
                    onValidityChange={(valid) =>
                      onInvalidJsonChange(`variables[${index}].defaultValue`, !valid)
                    }
                  />
                ) : null}

                {defaultError ? (
                  <p className="text-2xs text-danger">{defaultError.message}</p>
                ) : null}
                {other.map((issue) => (
                  <p
                    key={issue.message}
                    className={
                      issue.severity === 'error' ? 'text-2xs text-danger' : 'text-2xs text-warning'
                    }
                  >
                    {issue.message}
                  </p>
                ))}

                <div className="flex items-center gap-1">
                  <IconButton
                    label={`Move variable ${index + 1} up`}
                    size="sm"
                    disabled={disabled || index === 0}
                    onClick={() => onChange(moveListItem(variables, index, -1))}
                  >
                    <ChevronUp size={14} />
                  </IconButton>
                  <IconButton
                    label={`Move variable ${index + 1} down`}
                    size="sm"
                    disabled={disabled || index === variables.length - 1}
                    onClick={() => onChange(moveListItem(variables, index, 1))}
                  >
                    <ChevronDown size={14} />
                  </IconButton>
                  <IconButton
                    label={`Remove variable ${index + 1}`}
                    size="sm"
                    disabled={disabled}
                    onClick={() => onChange(variables.filter((_, position) => position !== index))}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>

      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...variables,
            { name: '', type: 'string', required: true, description: '', extras: {} },
          ])
        }
      >
        <Plus size={14} aria-hidden="true" />
        Add a variable
      </Button>
    </div>
  );
}
