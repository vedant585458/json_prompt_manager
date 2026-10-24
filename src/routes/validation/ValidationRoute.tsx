import {
  AlertTriangle,
  FileJson,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Select,
  SkeletonText,
  StatusPill,
  buttonVariants,
  useToast,
} from '@/components/ui';
import { IssueCounts, IssueList } from '@/components/validation/IssueList';
import { SchemaEditorDialog } from '@/components/validation/SchemaEditorDialog';
import { ValidationScopeNote, ValidationSummary } from '@/components/validation/ValidationSummary';
import { formatRelativeTime } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { countSchemaUsage, validateJsonText, type ValidationIssue } from '@/domain/validation';
import type { JsonObject } from '@/domain/types';
import { useSchemaLibrary } from '@/features/schemas/useSchemaLibrary';
import { useDataStoreApi } from '@/store/dataStoreContext';

/**
 * Validation studio (TASK-016).
 *
 * One screen answers three questions without ever merging them: does the text
 * parse, does the attached schema accept it, and does it still look like a
 * PromptForge document. The prompt is edited in the workspace, not here — this
 * screen is a reading surface, so nothing it shows can be mistaken for an edit.
 *
 * The scope statement at the top is not dismissible: "valid" here means syntax
 * and structure, never prompt quality (ADR-85).
 */

type Filter = 'all' | 'errors' | 'warnings';

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'All findings' },
  { value: 'errors', label: 'Errors only' },
  { value: 'warnings', label: 'Warnings only' },
];

export function ValidationRoute() {
  const store = useDataStoreApi();
  const prompts = store((state) => state.prompts);
  const status = store((state) => state.status);
  const schemaLibrary = useSchemaLibrary();
  const toast = useToast();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPromptId = searchParams.get('prompt');
  const [filter, setFilter] = useState<Filter>('all');
  const [recheckToken, setRecheckToken] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSchemaId, setEditingSchemaId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const activePrompts = useMemo(
    () => [...prompts].sort((left, right) => left.title.localeCompare(right.title)),
    [prompts],
  );

  const selected =
    activePrompts.find((prompt) => prompt.id === requestedPromptId) ?? activePrompts[0] ?? null;

  const attachedSchema = selected?.schemaId
    ? (schemaLibrary.schemas.find((schema) => schema.id === selected.schemaId) ?? null)
    : null;

  // A schema that the prompt references but this browser no longer stores is a
  // fact worth saying out loud, not a silent "no schema".
  const missingSchemaId = selected?.schemaId && !attachedSchema ? selected.schemaId : null;

  const report = useMemo(() => {
    if (!selected) return null;
    const text = JSON.stringify(selected.content, null, 2);
    void recheckToken;
    return validateJsonText(text, attachedSchema ? { schema: attachedSchema.schemaContent } : {});
  }, [attachedSchema, recheckToken, selected]);

  const editingSchema =
    schemaLibrary.schemas.find((schema) => schema.id === editingSchemaId) ?? null;
  const deletingSchema = schemaLibrary.schemas.find((schema) => schema.id === deleteTarget) ?? null;
  const editingUsage = editingSchema ? countSchemaUsage(prompts, editingSchema.id) : 0;
  const deletingUsage = deletingSchema ? countSchemaUsage(prompts, deletingSchema.id) : 0;

  useEffect(() => {
    if (schemaLibrary.error) {
      toast.error({ title: 'That change was not saved', description: schemaLibrary.error });
      schemaLibrary.clearError();
    }
  }, [schemaLibrary, toast]);

  function selectPrompt(promptId: string) {
    const next = new URLSearchParams(searchParams);
    next.set('prompt', promptId);
    setSearchParams(next, { replace: true });
    setFilter('all');
  }

  const visibleIssues = (report?.issues ?? []).filter((issue) => {
    if (filter === 'errors') return issue.severity === 'error';
    if (filter === 'warnings') return issue.severity === 'warning';
    return true;
  });

  async function handleSaveSchema(input: {
    name: string;
    description: string;
    schemaContent: JsonObject;
  }) {
    if (editingSchema) {
      const updated = await schemaLibrary.updateSchema(editingSchema.id, input);
      if (!updated) throw new Error(schemaLibrary.error ?? 'The schema could not be saved.');
      toast.success({
        title: 'Schema updated',
        description:
          editingUsage > 0
            ? `${editingUsage} ${editingUsage === 1 ? 'prompt uses' : 'prompts use'} it and will be checked against the new version.`
            : updated.name,
      });
      return;
    }

    const created = await schemaLibrary.createSchema(input);
    if (!created) throw new Error(schemaLibrary.error ?? 'The schema could not be created.');
    toast.success({ title: 'Schema created', description: created.name });
  }

  async function handleDeleteSchema() {
    if (!deletingSchema) return;
    const result = await schemaLibrary.deleteSchema(deletingSchema.id);
    if (!result) {
      toast.error({
        title: 'The schema was not deleted',
        description: schemaLibrary.error ?? 'The change could not be stored.',
      });
      return;
    }

    setDeleteTarget(null);
    toast.success({
      title: 'Schema deleted',
      description:
        result.detached > 0
          ? `${result.detached} ${result.detached === 1 ? 'prompt' : 'prompts'} no longer reference it.`
          : deletingSchema.name,
    });
  }

  async function attachSchema(schemaId: string) {
    if (!selected) return;
    const saved = await schemaLibrary.attachSchema(selected.id, schemaId === '' ? null : schemaId);
    if (!saved) {
      toast.error({
        title: 'The schema was not attached',
        description: schemaLibrary.error ?? 'The prompt could not be written.',
      });
      return;
    }
    toast.success({
      title: schemaId === '' ? 'Schema detached' : 'Schema attached',
      description: saved.title,
    });
  }

  function jumpTo(issue: ValidationIssue) {
    if (!selected) return;
    // The workspace owns the caret; the studio sends the user there with the
    // line already in the URL fragment so the editor can focus it.
    navigate(
      issue.line !== undefined
        ? `/prompts/${selected.id}?line=${issue.line}`
        : `/prompts/${selected.id}`,
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="mx-auto w-full max-w-5xl" aria-busy="true">
        <SkeletonText lines={4} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-5">
      <header className="space-y-2">
        <p className="metadata-rail">Validation studio · syntax and structure</p>
        <h1 className="font-display text-3xl leading-tight text-ink">Validation</h1>
        <p className="max-w-prose text-sm leading-relaxed text-ink-secondary">
          Check a stored prompt against the PromptForge document rules and against any JSON Schema
          you have attached to it. The prompt is read, never edited, here.
        </p>
        <ValidationScopeNote className="max-w-prose text-xs leading-relaxed text-ink-muted" />
      </header>

      {activePrompts.length === 0 ? (
        <EmptyState
          title="No prompts to validate"
          description="Create a prompt in the library first. Validation reads stored prompts, so there is nothing to check yet."
          action={
            <Link to="/library?new=prompt" className={cn(buttonVariants({ variant: 'primary' }))}>
              New prompt
            </Link>
          }
        />
      ) : (
        <>
          <Card as="section" aria-labelledby="validation-target" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="validation-target" className="text-sm font-semibold text-ink">
                  Document
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  The stored content of one prompt. Edits happen in the workspace.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRecheckToken((token) => token + 1)}
              >
                <RefreshCw aria-hidden="true" size={12} />
                Re-check
              </Button>
            </div>

            <Field label="Prompt">
              {(control) => (
                <Select
                  {...control}
                  value={selected?.id ?? ''}
                  onChange={(event) => selectPrompt(event.target.value)}
                  options={activePrompts.map((prompt) => ({
                    value: prompt.id,
                    label: prompt.title,
                  }))}
                />
              )}
            </Field>

            {selected ? (
              <div className="space-y-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
                  <dt className="text-ink-muted">Status</dt>
                  <dd className="text-ink">{selected.status}</dd>
                  <dt className="text-ink-muted">Last edited</dt>
                  <dd className="text-ink">{formatRelativeTime(selected.updatedAt, new Date())}</dd>
                  <dt className="text-ink-muted">Version</dt>
                  <dd className="font-mono text-ink">{selected.version}</dd>
                  <dt className="text-ink-muted">Schema</dt>
                  <dd className="truncate text-ink">{attachedSchema?.name ?? 'None attached'}</dd>
                </dl>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/prompts/${selected.id}`}
                    className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
                  >
                    <FileJson aria-hidden="true" size={12} />
                    Open in the editor
                  </Link>

                  <Select
                    size="sm"
                    aria-label="Schema attached to this prompt"
                    value={selected.schemaId ?? ''}
                    onChange={(event) => void attachSchema(event.target.value)}
                    disabled={schemaLibrary.busy || schemaLibrary.schemas.length === 0}
                    options={[
                      { value: '', label: 'No schema' },
                      ...schemaLibrary.schemas.map((schema) => ({
                        value: schema.id,
                        label: schema.name,
                      })),
                    ]}
                  />
                </div>

                {missingSchemaId ? (
                  <Alert tone="warning" title="The attached schema is missing">
                    <p className="text-xs leading-relaxed">
                      This prompt references a schema that is not stored in this browser, so only
                      syntax and document shape were checked. Attach another schema or choose “No
                      schema” to clear the reference.
                    </p>
                  </Alert>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card as="section" aria-labelledby="validation-results" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="validation-results" className="text-sm font-semibold text-ink">
                  Results
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Findings are grouped by what produced them, not by severity alone.
                </p>
              </div>
              {report ? <IssueCounts counts={report.counts} /> : null}
            </div>

            {report && selected ? (
              <>
                <ValidationSummary report={report} schemaName={attachedSchema?.name ?? null} />

                <div
                  role="group"
                  aria-label="Filter findings"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {FILTERS.map((option) => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={filter === option.value ? 'secondary' : 'ghost'}
                      aria-pressed={filter === option.value}
                      onClick={() => setFilter(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <IssueList
                  label={`Findings for ${selected.title}`}
                  issues={visibleIssues}
                  onJump={jumpTo}
                  emptyMessage={
                    report.issues.length === 0
                      ? 'Nothing was flagged. That means the text parses and, if a schema is attached, the document matches it.'
                      : `No ${filter === 'errors' ? 'errors' : 'warnings'} in this report.`
                  }
                />

                {report.schemaWarnings.length > 0 ? (
                  <div className="space-y-1.5">
                    <h3 className="text-2xs tracking-wide text-ink-muted uppercase">
                      Schema notes — not checked against your document
                    </h3>
                    <IssueList
                      label="Schema notes"
                      issues={report.schemaWarnings}
                      emptyMessage="No schema notes."
                    />
                  </div>
                ) : null}

                {report.truncated ? (
                  <p className="flex items-center gap-1.5 text-2xs text-warning">
                    <AlertTriangle aria-hidden="true" size={11} />
                    The error list stopped at the limit; fix the first findings and check again.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-ink-muted">Choose a prompt to see its report.</p>
            )}
          </Card>

          <Card as="section" aria-labelledby="validation-schemas" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="validation-schemas" className="text-sm font-semibold text-ink">
                  Schema library
                </h2>
                <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-muted">
                  Schemas live in this browser and can be attached to any prompt. This build
                  implements a documented subset of JSON Schema and refuses a schema that uses
                  keywords it cannot evaluate, so a result is never a partial pass.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingSchemaId(null);
                  setEditorOpen(true);
                }}
              >
                <Plus aria-hidden="true" size={12} />
                New schema
              </Button>
            </div>

            {schemaLibrary.schemas.length === 0 ? (
              <div className="rounded-md border border-dashed border-line bg-surface-2 px-4 py-6 text-center">
                <ShieldCheck aria-hidden="true" size={18} className="mx-auto text-ink-muted" />
                <p className="mt-2 text-sm font-medium text-ink">No schemas yet</p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-muted">
                  A schema is optional. Without one, validation still checks that the text parses
                  and that the document has the PromptForge shape.
                </p>
              </div>
            ) : (
              <ul
                aria-label="Stored schemas"
                className="divide-y divide-line rounded-md border border-line"
              >
                {schemaLibrary.schemas.map((schema) => {
                  const usage = countSchemaUsage(prompts, schema.id);
                  const isAttached = selected?.schemaId === schema.id;

                  return (
                    <li
                      key={schema.id}
                      className="flex min-w-0 flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-medium text-ink">{schema.name}</h3>
                          {isAttached ? <Badge tone="accent">attached</Badge> : null}
                          <span className="text-2xs text-ink-muted">
                            {usage === 0
                              ? 'unused'
                              : `${usage} ${usage === 1 ? 'prompt' : 'prompts'}`}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">
                          {schema.description.length > 0 ? schema.description : 'No description.'}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingSchemaId(schema.id);
                            setEditorOpen(true);
                          }}
                          aria-label={`Edit ${schema.name}`}
                        >
                          <Pencil aria-hidden="true" size={12} />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(schema.id)}
                          aria-label={`Delete ${schema.name}`}
                        >
                          <Trash2 aria-hidden="true" size={12} />
                          Delete
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      <SchemaEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        schema={editingSchema}
        onSave={handleSaveSchema}
      />

      {editorOpen && editingSchema && editingUsage > 0 ? (
        <p className="text-2xs text-ink-muted">
          {editingUsage} {editingUsage === 1 ? 'prompt uses' : 'prompts use'} this schema; saving
          changes what they are checked against.
        </p>
      ) : null}

      <ConfirmDialog
        open={deletingSchema !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete “${deletingSchema?.name ?? ''}”?`}
        description={
          deletingUsage > 0
            ? `${deletingUsage} ${deletingUsage === 1 ? 'prompt uses' : 'prompts use'} this schema. They keep their content and lose the schema reference, so they will no longer be checked against it. This cannot be undone.`
            : 'No prompt uses this schema. This cannot be undone.'
        }
        confirmLabel="Delete schema"
        tone="destructive"
        pending={schemaLibrary.busy}
        onConfirm={() => void handleDeleteSchema()}
      />

      <p className="flex items-center gap-1.5 text-2xs text-ink-muted">
        <StatusPill tone="info" icon={<ShieldCheck size={11} />}>
          Read-only
        </StatusPill>
        Nothing on this screen writes to your prompts except attaching or detaching a schema.
      </p>
    </div>
  );
}
