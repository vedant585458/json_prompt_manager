import { ExamplesEditor } from '@/components/composer/ExamplesEditor';
import { JsonValueField } from '@/components/composer/JsonValueField';
import { StringListEditor } from '@/components/composer/StringListEditor';
import { VariablesEditor } from '@/components/composer/VariablesEditor';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import {
  COMPOSER_SECTIONS,
  issueForField,
  type ComposerField,
  type ComposerIssue,
  type ComposerPatch,
  type ComposerView,
} from '@/domain/composer';
import type { OutputFormat, PromptSchema, Snippet } from '@/domain/types';

const FORMAT_OPTIONS: readonly { value: OutputFormat; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Plain text' },
  { value: 'markdown', label: 'Markdown' },
];

export interface ComposerFieldsProps {
  readonly view: ComposerView;
  readonly issues: readonly ComposerIssue[];
  readonly schemas: readonly PromptSchema[];
  readonly snippets: readonly Snippet[];
  readonly onPatch: (patch: ComposerPatch) => void;
  /** Reports JSON fields whose text does not parse, so saving can be held back. */
  readonly onInvalidJsonChange: (key: string, invalid: boolean) => void;
  readonly disabled?: boolean;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  // Rendered as the fieldset's own first child, so the legend really is the
  // group's accessible name rather than a heading that looks like one.
  return (
    <>
      <legend className="px-1 font-display text-lg leading-tight text-ink">{title}</legend>
      <p className="text-2xs text-ink-muted">{description}</p>
    </>
  );
}

/**
 * The composer's form (TASK-017).
 *
 * One fieldset per section, one labelled control per field, and no control that
 * is not wired to `onPatch`. Fields outside this form are never rendered here —
 * the JSON preview and the "preserved fields" notice are how they stay visible.
 */
export function ComposerFields({
  view,
  issues,
  schemas,
  snippets,
  onPatch,
  onInvalidJsonChange,
  disabled = false,
}: ComposerFieldsProps) {
  const errorFor = (field: ComposerField) => {
    const issue = issueForField(issues, field, 'error');
    return issue && issue.severity === 'error' ? issue.message : undefined;
  };

  const section = (id: string) => COMPOSER_SECTIONS.find((candidate) => candidate.id === id);

  const schemaOptions = [
    { value: '', label: 'No schema' },
    ...schemas.map((schema) => ({ value: schema.id, label: schema.name })),
  ];

  const snippetNames = new Map(snippets.map((snippet) => [snippet.id, snippet.name]));

  return (
    <div className="space-y-6">
      <fieldset className="min-w-0 space-y-3 rounded-md border border-line bg-surface-1 p-4">
        <SectionHeading
          title={section('identity')?.title ?? 'Identity'}
          description={section('identity')?.description ?? ''}
        />

        <Field
          label="Name"
          required
          hint="How this prompt appears in the library."
          {...(errorFor('name') ? { error: errorFor('name') } : {})}
        >
          {(control) => (
            <Input
              {...control}
              value={view.name}
              maxLength={120}
              disabled={disabled}
              onChange={(event) => onPatch({ field: 'name', value: event.target.value })}
            />
          )}
        </Field>

        <Field label="Role" hint="Who the model is writing as, in one sentence.">
          {(control) => (
            <Input
              {...control}
              value={view.role}
              disabled={disabled}
              onChange={(event) => onPatch({ field: 'role', value: event.target.value })}
            />
          )}
        </Field>
      </fieldset>

      <fieldset className="min-w-0 space-y-3 rounded-md border border-line bg-surface-1 p-4">
        <SectionHeading
          title={section('task')?.title ?? 'Task'}
          description={section('task')?.description ?? ''}
        />

        <Field
          label="Objective"
          hint="What the prompt must achieve, in the user's words."
          {...(errorFor('objective') ? { error: errorFor('objective') } : {})}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              value={view.objective}
              disabled={disabled}
              onChange={(event) => onPatch({ field: 'objective', value: event.target.value })}
            />
          )}
        </Field>

        <StringListEditor
          legend="Instructions"
          description="Steps the model should follow, in order."
          items={view.instructions}
          itemLabel="instruction"
          addLabel="Add an instruction"
          placeholder="Group changes by area, strongest impact first."
          emptyText="No instructions yet. The prompt has no steps to follow."
          disabled={disabled}
          {...(errorFor('instructions') ? { error: errorFor('instructions') } : {})}
          onChange={(value) => onPatch({ field: 'instructions', value })}
        />

        <StringListEditor
          legend="Constraints"
          description="Rules the answer must respect."
          items={view.constraints}
          itemLabel="constraint"
          addLabel="Add a constraint"
          placeholder="Do not invent entries that are absent from the input."
          emptyText="No constraints yet."
          disabled={disabled}
          {...(errorFor('constraints') ? { error: errorFor('constraints') } : {})}
          onChange={(value) => onPatch({ field: 'constraints', value })}
        />
      </fieldset>

      <fieldset className="min-w-0 space-y-3 rounded-md border border-line bg-surface-1 p-4">
        <SectionHeading
          title={section('context')?.title ?? 'Context'}
          description={section('context')?.description ?? ''}
        />

        <Field label="Description" hint="Background the prompt may rely on.">
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              value={view.contextDescription}
              disabled={disabled}
              onChange={(event) =>
                onPatch({ field: 'context.description', value: event.target.value })
              }
            />
          )}
        </Field>

        <StringListEditor
          legend="References"
          description="Named sources the prompt may cite."
          items={view.contextReferences}
          itemLabel="reference"
          addLabel="Add a reference"
          placeholder="House style guide, section 4"
          emptyText="No references yet."
          disabled={disabled}
          onChange={(value) => onPatch({ field: 'context.references', value })}
        />

        <JsonValueField
          label="Structured data"
          hint="Optional JSON the prompt is allowed to use, shown as-is."
          value={view.contextData}
          rows={3}
          onChange={(value) => onPatch({ field: 'context.data', value })}
          onValidityChange={(valid) => onInvalidJsonChange('context.data', !valid)}
        />
      </fieldset>

      <fieldset className="min-w-0 space-y-3 rounded-md border border-line bg-surface-1 p-4">
        <SectionHeading
          title={section('variables')?.title ?? 'Variables'}
          description={section('variables')?.description ?? ''}
        />

        <VariablesEditor
          variables={view.variables}
          issues={issues}
          disabled={disabled}
          onChange={(value) => onPatch({ field: 'variables', value })}
          onInvalidJsonChange={onInvalidJsonChange}
        />
      </fieldset>

      <fieldset className="min-w-0 space-y-3 rounded-md border border-line bg-surface-1 p-4">
        <SectionHeading
          title={section('output')?.title ?? 'Output and examples'}
          description={section('output')?.description ?? ''}
        />

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Field label="Output format">
            {(control) => (
              <Select
                {...control}
                value={view.outputFormat}
                disabled={disabled}
                options={FORMAT_OPTIONS}
                onChange={(event) =>
                  onPatch({ field: 'output.format', value: event.target.value as OutputFormat })
                }
              />
            )}
          </Field>

          <Field
            label="Attached schema"
            hint="Checks the answer's shape in the validation studio."
            {...(errorFor('output.schemaRef') ? { error: errorFor('output.schemaRef') } : {})}
          >
            {(control) => (
              <Select
                {...control}
                value={view.outputSchemaRef}
                disabled={disabled}
                options={schemaOptions}
                onChange={(event) =>
                  onPatch({ field: 'output.schemaRef', value: event.target.value })
                }
              />
            )}
          </Field>
        </div>

        <JsonValueField
          label="Example output"
          hint="What a good answer looks like; it is never treated as a guarantee."
          value={view.outputExample}
          rows={3}
          onChange={(value) => onPatch({ field: 'output.example', value })}
          onValidityChange={(valid) => onInvalidJsonChange('output.example', !valid)}
        />

        <ExamplesEditor
          examples={view.examples}
          issues={issues}
          disabled={disabled}
          onChange={(value) => onPatch({ field: 'examples', value })}
          onInvalidJsonChange={onInvalidJsonChange}
        />
      </fieldset>

      <fieldset className="min-w-0 space-y-3 rounded-md border border-line bg-surface-1 p-4">
        <SectionHeading
          title={section('metadata')?.title ?? 'Metadata'}
          description={section('metadata')?.description ?? ''}
        />

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Field label="Author">
            {(control) => (
              <Input
                {...control}
                value={view.author}
                disabled={disabled}
                onChange={(event) =>
                  onPatch({ field: 'metadata.author', value: event.target.value })
                }
              />
            )}
          </Field>

          <Field label="Tags" hint="Comma separated; duplicates are dropped on save.">
            {(control) => (
              <Input
                {...control}
                value={view.tags.join(', ')}
                disabled={disabled}
                onChange={(event) =>
                  onPatch({
                    field: 'metadata.tags',
                    value: event.target.value
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter((tag) => tag.length > 0),
                  })
                }
              />
            )}
          </Field>
        </div>

        <Field label="Notes">
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              value={view.notes}
              disabled={disabled}
              onChange={(event) => onPatch({ field: 'metadata.notes', value: event.target.value })}
            />
          )}
        </Field>

        <div className="space-y-2">
          <h4 className="text-xs font-medium tracking-wide text-ink uppercase">Snippets used</h4>
          {view.includes.length === 0 ? (
            <p className="text-2xs text-ink-muted">
              No snippets are recorded in this document. Inserting one from the panel above records
              it here.
            </p>
          ) : (
            <ul className="space-y-1">
              {view.includes.map((id) => (
                <li key={id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">
                    {snippetNames.get(id) ?? id}
                    {snippetNames.has(id) ? null : (
                      <span className="text-ink-muted"> — not in this library</span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() =>
                      onPatch({
                        field: 'includes',
                        value: view.includes.filter((candidate) => candidate !== id),
                      })
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </fieldset>
    </div>
  );
}
