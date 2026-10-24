import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import { JsonValueField } from '@/components/composer/JsonValueField';
import { Button, IconButton } from '@/components/ui';
import { moveListItem, type ComposerExample, type ComposerIssue } from '@/domain/composer';

export interface ExamplesEditorProps {
  readonly examples: readonly ComposerExample[];
  readonly issues: readonly ComposerIssue[];
  readonly onChange: (examples: ComposerExample[]) => void;
  readonly onInvalidJsonChange: (key: string, invalid: boolean) => void;
  readonly disabled?: boolean;
}

/**
 * Worked examples (TASK-017).
 *
 * Either side may be empty while drafting — an example with neither side is a
 * warning from the domain model, not an invented placeholder.
 */
export function ExamplesEditor({
  examples,
  issues,
  onChange,
  onInvalidJsonChange,
  disabled = false,
}: ExamplesEditorProps) {
  function replace(index: number, changes: Partial<ComposerExample>) {
    onChange(
      examples.map((example, position) =>
        position === index ? { ...example, ...changes } : example,
      ),
    );
  }

  function issuesFor(index: number) {
    return issues.filter((issue) => issue.path.startsWith(`examples[${index}]`));
  }

  return (
    <div className="space-y-3">
      {examples.length === 0 ? (
        <p className="rounded-sm border border-dashed border-line px-3 py-2 text-xs text-ink-muted">
          No examples yet. An example shows one input and the output it should produce.
        </p>
      ) : null}

      <ol className="space-y-3">
        {examples.map((example, index) => (
          <li key={index}>
            <fieldset className="min-w-0 space-y-2 rounded-md border border-line bg-surface-1 p-3">
              <legend className="px-1 text-xs font-medium tracking-wide text-ink uppercase">
                Example {index + 1}
              </legend>

              {example.unreadable !== undefined ? (
                <p className="text-2xs text-warning">
                  This example is not an object, so it cannot be edited here. It is kept as written.
                </p>
              ) : (
                <div className="grid min-w-0 gap-2 lg:grid-cols-2">
                  <JsonValueField
                    label="Input"
                    value={example.input}
                    rows={3}
                    onChange={(value) =>
                      replace(index, {
                        ...(value === undefined ? { input: undefined } : { input: value }),
                      })
                    }
                    onValidityChange={(valid) =>
                      onInvalidJsonChange(`examples[${index}].input`, !valid)
                    }
                  />
                  <JsonValueField
                    label="Expected output"
                    value={example.output}
                    rows={3}
                    onChange={(value) =>
                      replace(index, {
                        ...(value === undefined ? { output: undefined } : { output: value }),
                      })
                    }
                    onValidityChange={(valid) =>
                      onInvalidJsonChange(`examples[${index}].output`, !valid)
                    }
                  />
                </div>
              )}

              {issuesFor(index).map((issue) => (
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
                  label={`Move example ${index + 1} up`}
                  size="sm"
                  disabled={disabled || index === 0}
                  onClick={() => onChange(moveListItem(examples, index, -1))}
                >
                  <ChevronUp size={14} />
                </IconButton>
                <IconButton
                  label={`Move example ${index + 1} down`}
                  size="sm"
                  disabled={disabled || index === examples.length - 1}
                  onClick={() => onChange(moveListItem(examples, index, 1))}
                >
                  <ChevronDown size={14} />
                </IconButton>
                <IconButton
                  label={`Remove example ${index + 1}`}
                  size="sm"
                  disabled={disabled}
                  onClick={() => onChange(examples.filter((_, position) => position !== index))}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => onChange([...examples, { extras: {} }])}
      >
        <Plus size={14} aria-hidden="true" />
        Add an example
      </Button>
    </div>
  );
}
