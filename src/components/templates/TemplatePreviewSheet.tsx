import { Copy, Play } from 'lucide-react';
import { useMemo } from 'react';

import { Alert, Badge, Button, Sheet } from '@/components/ui';
import { formatRelativeTime } from '@/lib/dates';
import { instantiateTemplate, summariseTemplate } from '@/domain/templates';
import type { PromptTemplate } from '@/domain/types';

export interface TemplatePreviewSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly template: PromptTemplate | null;
  readonly knownSchemaIds: ReadonlySet<string>;
  readonly now: Date;
  readonly busy: boolean;
  readonly onUse: (template: PromptTemplate) => void;
  readonly onDuplicate: (template: PromptTemplate) => void;
}

function SectionHeading({ children }: { readonly children: string }) {
  return (
    <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">{children}</h3>
  );
}

/**
 * Template preview (TASK-018).
 *
 * Everything shown here is computed from the stored template with the same
 * function that creates the prompt, so the preview cannot drift from the result:
 * the variable table, the size, and the two "will be removed" notices all come
 * from `instantiateTemplate`.
 */
export function TemplatePreviewSheet({
  open,
  onOpenChange,
  template,
  knownSchemaIds,
  now,
  busy,
  onUse,
  onDuplicate,
}: TemplatePreviewSheetProps) {
  const summary = useMemo(() => (template ? summariseTemplate(template) : null), [template]);
  const instantiation = useMemo(
    () => (template ? instantiateTemplate(template, { knownSchemaIds }) : null),
    [knownSchemaIds, template],
  );

  if (!template || !summary || !instantiation) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Template preview">
        <p className="text-sm text-ink-secondary">
          This template is not stored any more. Close this panel and pick another one.
        </p>
      </Sheet>
    );
  }

  const document = instantiation.content;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={template.name}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone={template.isBuiltIn ? 'info' : 'accent'}>
            {template.isBuiltIn ? 'Built-in' : 'Custom'}
          </Badge>
          <span className="font-mono text-2xs">{template.category}</span>
        </span>
      }
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => onDuplicate(template)} disabled={busy}>
            <Copy aria-hidden="true" size={13} />
            {template.isBuiltIn ? 'Duplicate to customise' : 'Duplicate'}
          </Button>
          <Button variant="primary" onClick={() => onUse(template)} disabled={busy}>
            <Play aria-hidden="true" size={13} />
            Use template
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-ink-secondary">
          {template.description.length > 0 ? template.description : 'No description yet.'}
        </p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-ink-muted">Variables</dt>
            <dd className="font-mono text-ink">
              {summary.variables.length} ({summary.requiredVariables} required)
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Document size</dt>
            <dd className="font-mono text-ink">
              {summary.jsonCharacters.toLocaleString()} characters of JSON
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Instructions / constraints</dt>
            <dd className="font-mono text-ink">
              {summary.instructions} / {summary.constraints}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Output</dt>
            <dd className="font-mono text-ink">{document.output.format}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Examples</dt>
            <dd className="font-mono text-ink">{summary.examples}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Last edited</dt>
            <dd className="text-ink">{formatRelativeTime(template.updatedAt, now)}</dd>
          </div>
        </dl>

        {summary.tags.length > 0 ? (
          <section aria-labelledby="preview-tags" className="space-y-1.5">
            <SectionHeading>Tags</SectionHeading>
            <ul id="preview-tags" className="flex flex-wrap gap-1">
              {summary.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-pill border border-line bg-surface-2 px-2 py-0.5 font-mono text-2xs text-ink-muted"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="preview-document" className="space-y-2">
          <h2 id="preview-document" className="text-sm font-semibold text-ink">
            What the prompt will contain
          </h2>
          <p className="text-xs leading-relaxed text-ink-secondary">
            <span className="text-ink-muted">Role: </span>
            {document.role.length > 0 ? document.role : 'not set'}
          </p>
          <p className="text-xs leading-relaxed text-ink-secondary">
            <span className="text-ink-muted">Objective: </span>
            {document.objective.length > 0 ? document.objective : 'not set'}
          </p>
          {document.instructions.length > 0 ? (
            <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-ink-secondary">
              {document.instructions.map((instruction, index) => (
                <li key={`${index}-${instruction}`}>{instruction}</li>
              ))}
            </ol>
          ) : null}
          {document.constraints.length > 0 ? (
            <div className="space-y-1">
              <SectionHeading>Constraints</SectionHeading>
              <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink-secondary">
                {document.constraints.map((constraint, index) => (
                  <li key={`${index}-${constraint}`}>{constraint}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="preview-variables" className="space-y-2">
          <h2 id="preview-variables" className="text-sm font-semibold text-ink">
            Variables
          </h2>
          {summary.variables.length === 0 ? (
            <p className="text-xs leading-relaxed text-ink-muted">
              This template declares no variables, so the prompt it creates is fixed text.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] border-collapse text-left text-xs">
                <caption className="sr-only">
                  Variables declared by {template.name}, with type and requirement
                </caption>
                <thead>
                  <tr className="border-b border-line text-2xs uppercase tracking-wide text-ink-muted">
                    <th scope="col" className="py-1.5 pr-2 font-medium">
                      Name
                    </th>
                    <th scope="col" className="py-1.5 pr-2 font-medium">
                      Type
                    </th>
                    <th scope="col" className="py-1.5 pr-2 font-medium">
                      Required
                    </th>
                    <th scope="col" className="py-1.5 font-medium">
                      Default
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.variables.map((variable) => (
                    <tr key={variable.name} className="border-b border-line/60 last:border-0">
                      <th scope="row" className="py-1.5 pr-2 font-mono font-normal text-ink">
                        {variable.name}
                      </th>
                      <td className="py-1.5 pr-2 font-mono text-ink-secondary">{variable.type}</td>
                      <td className="py-1.5 pr-2 text-ink-secondary">
                        {variable.required ? 'Yes' : 'No'}
                      </td>
                      <td className="max-w-[10rem] truncate py-1.5 font-mono text-ink-secondary">
                        {variable.defaultValue === undefined
                          ? '—'
                          : JSON.stringify(variable.defaultValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {instantiation.droppedSchemaRef !== null || instantiation.droppedIncludes.length > 0 ? (
          <Alert tone="warning" title="What will not be copied">
            <ul className="space-y-1 text-xs leading-relaxed">
              {instantiation.droppedSchemaRef !== null ? (
                <li>
                  The output schema reference “{instantiation.droppedSchemaRef}” is not stored in
                  this browser, so the new prompt starts without it.
                </li>
              ) : null}
              {instantiation.droppedIncludes.length > 0 ? (
                <li>
                  {instantiation.droppedIncludes.length}{' '}
                  {instantiation.droppedIncludes.length === 1
                    ? 'snippet reference'
                    : 'snippet references'}{' '}
                  will not be carried over. Snippet text already written into the sections is kept;
                  the composer can insert the snippet again.
                </li>
              ) : null}
            </ul>
          </Alert>
        ) : null}

        <p className="text-2xs leading-relaxed text-ink-muted">
          Using a template creates a new prompt with its own identifier and version. Editing that
          prompt never changes the template or any other prompt.
        </p>
      </div>
    </Sheet>
  );
}
