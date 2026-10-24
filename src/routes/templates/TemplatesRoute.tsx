import { LayoutTemplate, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { TemplateCard } from '@/components/templates/TemplateCard';
import { TemplateDialog, type TemplateDialogMode } from '@/components/templates/TemplateDialog';
import { TemplatePreviewSheet } from '@/components/templates/TemplatePreviewSheet';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Select,
  SkeletonText,
  buttonVariants,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  filterTemplates,
  sortUserTemplatesByRecency,
  templateCategories,
  type TemplateKind,
} from '@/domain/templates';
import type { PromptTemplate } from '@/domain/types';
import { useTemplateLibrary } from '@/features/templates/useTemplateLibrary';
import { useDataStoreApi } from '@/store/dataStoreContext';

/** The three ways the catalogue can be narrowed; `all` shows both kinds. */
const KIND_OPTIONS: readonly { readonly value: TemplateKind; readonly label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'built-in', label: 'Built-in' },
  { value: 'custom', label: 'Custom' },
];

interface DialogState {
  readonly mode: TemplateDialogMode;
  readonly template: PromptTemplate | null;
}

/**
 * Templates catalogue (TASK-018).
 *
 * One screen, two kinds of content, one rule: a template is a blueprint and
 * using it never touches it. Built-ins ship with the app and are read-only;
 * custom templates are made from a stored prompt and can be renamed or deleted.
 * The distinction is carried by words ("Built-in" / "Custom"), by the badge
 * tone, and by which operations exist — a built-in menu has no delete item.
 *
 * Filters live in component state because they describe this visit; the open
 * preview lives in the URL (`?template=<id>`) so the dashboard can deep-link
 * into one, and so Back closes the panel instead of leaving the screen.
 */
export function TemplatesRoute() {
  const store = useDataStoreApi();
  const templates = store((state) => state.templates);
  const prompts = store((state) => state.prompts);
  const schemas = store((state) => state.schemas);
  const status = store((state) => state.status);
  const library = useTemplateLibrary();
  const toast = useToast();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState<TemplateKind>('all');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const knownSchemaIds = useMemo(() => new Set(schemas.map((schema) => schema.id)), [schemas]);
  const categories = useMemo(() => templateCategories(templates), [templates]);

  const previewId = searchParams.get('template');
  const previewTemplate = templates.find((template) => template.id === previewId) ?? null;

  const builtIns = useMemo(
    () => filterTemplates(templates, { query, category, kind: 'built-in' }),
    [category, query, templates],
  );
  const userTemplates = useMemo(
    () =>
      sortUserTemplatesByRecency(filterTemplates(templates, { query, category, kind: 'custom' })),
    [category, query, templates],
  );

  const userTemplateTotal = templates.filter((template) => !template.isBuiltIn).length;
  const visibleCount = builtIns.length + userTemplates.length;
  const hasFilters = query.trim().length > 0 || category.length > 0 || kind !== 'all';
  const deleteTarget = templates.find((template) => template.id === deleteTargetId) ?? null;

  // A deep link or a delete can leave the panel pointing at nothing; the URL is
  // corrected rather than showing an empty sheet.
  useEffect(() => {
    if (previewId !== null && !previewTemplate) {
      const next = new URLSearchParams(searchParams);
      next.delete('template');
      setSearchParams(next, { replace: true });
    }
  }, [previewId, previewTemplate, searchParams, setSearchParams]);

  function openPreview(template: PromptTemplate) {
    const next = new URLSearchParams(searchParams);
    next.set('template', template.id);
    setSearchParams(next);
  }

  function closePreview() {
    const next = new URLSearchParams(searchParams);
    next.delete('template');
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setQuery('');
    setCategory('');
    setKind('all');
  }

  async function handleUse(template: PromptTemplate) {
    const outcome = await library.useTemplate(template.id);
    if (!outcome.ok) {
      toast.error({ title: 'The prompt was not created', description: outcome.error });
      return;
    }

    toast.success({
      title: 'Prompt created',
      description: `“${outcome.value.title}” is a separate copy of the template.`,
    });
    navigate(`/prompts/${outcome.value.id}/compose`);
  }

  async function handleDuplicate(template: PromptTemplate) {
    const outcome = await library.duplicateTemplate(template.id);
    if (!outcome.ok) {
      toast.error({ title: 'The template was not duplicated', description: outcome.error });
      return;
    }

    toast.success({
      title: 'Template duplicated',
      description: `“${outcome.value.name}” is now a custom template you can edit.`,
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const outcome = await library.deleteTemplate(deleteTarget.id);
    if (!outcome.ok) {
      toast.error({ title: 'The template was not deleted', description: outcome.error });
      return;
    }

    setDeleteTargetId(null);
    toast.success({ title: 'Template deleted', description: outcome.value.name });
  }

  async function handleSave(input: {
    promptId: string;
    name: string;
    description: string;
    category: string;
  }) {
    if (!dialog) return;

    if (dialog.mode === 'from-prompt') {
      const outcome = await library.createFromPrompt(input.promptId, {
        name: input.name,
        description: input.description,
        category: input.category,
      });
      if (!outcome.ok) throw new Error(outcome.error);
      toast.success({
        title: 'Template created',
        description: `“${outcome.value.name}” is ready to use from this catalogue.`,
      });
      return;
    }

    if (!dialog.template) return;

    if (dialog.mode === 'edit') {
      const outcome = await library.updateTemplate(dialog.template.id, {
        name: input.name,
        description: input.description,
        category: input.category,
      });
      if (!outcome.ok) throw new Error(outcome.error);
      toast.success({ title: 'Template updated', description: outcome.value.name });
      return;
    }

    const outcome = await library.duplicateTemplate(dialog.template.id, {
      name: input.name,
      description: input.description,
      category: input.category,
    });
    if (!outcome.ok) throw new Error(outcome.error);
    toast.success({
      title: 'Template duplicated',
      description: `“${outcome.value.name}” is now a custom template.`,
    });
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="mx-auto w-full max-w-6xl" aria-busy="true">
        <SkeletonText lines={4} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="metadata-rail">Template catalog · starting points</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink">Templates</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">
            Start from a document written for a common job, or turn one of your own prompts into a
            reusable blueprint. Using a template always creates a new prompt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={() => setDialog({ mode: 'from-prompt', template: null })}
          >
            <Plus aria-hidden="true" size={15} />
            New template
          </Button>
          <Link
            to="/composer"
            className={cn(buttonVariants({ variant: 'secondary', size: 'md' }), 'gap-2')}
          >
            <LayoutTemplate aria-hidden="true" size={15} />
            Compose a prompt
          </Link>
        </div>
      </header>

      <Card as="section" aria-labelledby="template-filters" className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="template-filters" className="text-sm font-semibold text-ink">
              Find a template
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Search across names, descriptions, categories, tags, and variable names.
            </p>
          </div>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X aria-hidden="true" size={12} />
              Clear filters
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Field label="Search templates" className="min-w-0 flex-1 sm:min-w-[16rem]">
            {(control) => (
              <div className="relative">
                <Search
                  aria-hidden="true"
                  size={14}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-muted"
                />
                <Input
                  {...control}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Code review, transformation, transcript…"
                  className="pl-8"
                  autoComplete="off"
                />
              </div>
            )}
          </Field>

          <Field label="Category" className="w-full sm:w-52">
            {(control) => (
              <Select
                {...control}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                options={[
                  { value: '', label: 'All categories' },
                  ...categories.map((name) => ({ value: name, label: name })),
                ]}
              />
            )}
          </Field>

          <fieldset className="min-w-0">
            <legend className="mb-1 text-2xs font-medium text-ink-secondary">Show</legend>
            <div role="group" aria-label="Template kind" className="flex flex-wrap gap-1.5">
              {KIND_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={kind === option.value ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={kind === option.value}
                  onClick={() => setKind(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </fieldset>
        </div>

        <p role="status" className="text-2xs text-ink-muted">
          Showing {visibleCount} of {templates.length}{' '}
          {templates.length === 1 ? 'template' : 'templates'}
          {hasFilters ? ' after filtering' : ''}.
        </p>
      </Card>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates stored"
          description="Templates ship with the app, and custom ones are saved from your prompts. Nothing is stored in this browser yet."
          action={
            <Button
              variant="primary"
              onClick={() => setDialog({ mode: 'from-prompt', template: null })}
            >
              Save a prompt as a template
            </Button>
          }
        />
      ) : visibleCount === 0 ? (
        <EmptyState
          title="No templates match"
          description="Nothing in the catalogue matches that search and filter combination. Clear them to see every template again."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          {kind !== 'custom' && builtIns.length > 0 ? (
            <section aria-labelledby="built-in-templates" className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="built-in-templates" className="text-sm font-semibold text-ink">
                  Built-in templates
                </h2>
                <p className="text-2xs text-ink-muted">
                  {builtIns.length} shipped with this build · read-only
                </p>
              </div>
              <ul className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {builtIns.map((template) => (
                  <li key={template.id} className="min-w-0">
                    <TemplateCard
                      template={template}
                      now={now}
                      busy={library.busy}
                      onPreview={() => openPreview(template)}
                      onUse={() => void handleUse(template)}
                      onDuplicate={() => void handleDuplicate(template)}
                      onEdit={() => setDialog({ mode: 'edit', template })}
                      onDelete={() => setDeleteTargetId(template.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {kind !== 'built-in' ? (
            <section aria-labelledby="custom-templates" className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="custom-templates" className="text-sm font-semibold text-ink">
                  Your templates
                </h2>
                <p className="text-2xs text-ink-muted">
                  {userTemplateTotal} {userTemplateTotal === 1 ? 'template' : 'templates'} ·
                  editable
                </p>
              </div>

              {userTemplates.length > 0 ? (
                <ul className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {userTemplates.map((template) => (
                    <li key={template.id} className="min-w-0">
                      <TemplateCard
                        template={template}
                        now={now}
                        busy={library.busy}
                        onPreview={() => openPreview(template)}
                        onUse={() => void handleUse(template)}
                        onDuplicate={() => void handleDuplicate(template)}
                        onEdit={() => setDialog({ mode: 'edit', template })}
                        onDelete={() => setDeleteTargetId(template.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : userTemplateTotal === 0 ? (
                <EmptyState
                  title="No custom templates yet"
                  description="Save a prompt that already works well as a template, then reuse it across projects without touching the original."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => setDialog({ mode: 'from-prompt', template: null })}
                    >
                      Save a prompt as a template
                    </Button>
                  }
                />
              ) : (
                <p className="rounded-md border border-line bg-surface-1 px-3 py-2 text-xs text-ink-muted">
                  None of your {userTemplateTotal} custom templates match the current filters.
                </p>
              )}
            </section>
          ) : null}
        </div>
      )}

      <TemplatePreviewSheet
        open={previewTemplate !== null}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
        template={previewTemplate}
        knownSchemaIds={knownSchemaIds}
        now={now}
        busy={library.busy}
        onUse={(template) => void handleUse(template)}
        onDuplicate={(template) => void handleDuplicate(template)}
      />

      <TemplateDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        mode={dialog?.mode ?? 'from-prompt'}
        template={dialog?.template ?? null}
        prompts={prompts}
        templates={templates}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
        title={deleteTarget ? `Delete “${deleteTarget.name}”?` : 'Delete template'}
        description={
          <>
            <p className="text-sm leading-relaxed">
              The template is removed from this browser. Prompts already created from it are not
              affected — they were separate copies all along.
            </p>
            <p className="mt-2 text-xs text-ink-muted">This cannot be undone.</p>
          </>
        }
        confirmLabel="Delete template"
        tone="destructive"
        pending={library.busy}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
