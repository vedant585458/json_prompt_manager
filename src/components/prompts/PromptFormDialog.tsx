import { useEffect, useState, type FormEvent } from 'react';

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { formatTagInput, folderOptions, parseTagInput } from '@/features/organization/organization';
import { RuleViolationError } from '@/domain/errors';
import type {
  Collection,
  Folder,
  Prompt,
  PromptSchema,
  PromptStatus,
  PromptTemplate,
} from '@/domain/types';

export interface PromptFormValues {
  readonly title: string;
  readonly description: string;
  readonly folderId: string | null;
  readonly collectionIds: readonly string[];
  readonly tags: readonly string[];
  readonly status: PromptStatus;
  readonly schemaId: string | null;
  /** Create only: which template fills the document, or `null` for blank. */
  readonly templateId: string | null;
}

export interface PromptFormDialogProps {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly prompt?: Prompt | null;
  readonly folders: readonly Folder[];
  readonly collections: readonly Collection[];
  readonly templates: readonly PromptTemplate[];
  readonly schemas: readonly PromptSchema[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (values: PromptFormValues) => Promise<void>;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'deprecated', label: 'Deprecated' },
];

const MAX_VISIBLE_TAGS = 8;

function messageFor(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'The change could not be saved. Nothing was altered.';
}

/**
 * Create/edit prompt dialog (TASK-012).
 *
 * Metadata only: the document body belongs to the JSON editor (TASK-014), so
 * this form never pretends to edit content. Validation is local for the title
 * and delegated to the store for names, folders, and collections, whose rules
 * throw `RuleViolationError` with one message per field.
 */
export function PromptFormDialog({
  open,
  mode,
  prompt = null,
  folders,
  collections,
  templates,
  schemas,
  onOpenChange,
  onSubmit,
}: PromptFormDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('');
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState<PromptStatus>('draft');
  const [schemaId, setSchemaId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [titleError, setTitleError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;

    setTitle(prompt?.title ?? '');
    setDescription(prompt?.description ?? '');
    setFolder(prompt?.folderId ?? '');
    setCollectionIds([...(prompt?.collectionIds ?? [])]);
    setTagInput(formatTagInput(prompt?.tags ?? []));
    setStatus(prompt?.status ?? 'draft');
    setSchemaId(prompt?.schemaId ?? '');
    setTemplateId('');
    setTitleError(undefined);
    setFormError(undefined);
    setPending(false);
  }, [open, prompt]);

  const tags = parseTagInput(tagInput);
  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = tags.length - visibleTags.length;
  const selectedTemplate = templates.find((template) => template.id === templateId) ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (title.trim().length === 0) {
      setTitleError('Give the prompt a title.');
      return;
    }

    setTitleError(undefined);
    setFormError(undefined);
    setPending(true);

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        folderId: folder.length > 0 ? folder : null,
        collectionIds,
        tags,
        status,
        schemaId: schemaId.length > 0 ? schemaId : null,
        templateId: mode === 'create' && templateId.length > 0 ? templateId : null,
      });
      onOpenChange(false);
    } catch (error) {
      setFormError(messageFor(error));
      if (error instanceof RuleViolationError) setTitleError(error.issueFor('title'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent
        title={mode === 'create' ? 'New prompt' : 'Edit prompt details'}
        description={
          mode === 'create'
            ? 'Metadata now; the document opens in the editor straight after.'
            : 'Change how this prompt is filed and labelled. The document itself is unchanged.'
        }
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" form="prompt-form" loading={pending} loadingLabel="Saving">
              {mode === 'create' ? 'Create prompt' : 'Save details'}
            </Button>
          </>
        }
      >
        <form
          id="prompt-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-3"
          noValidate
        >
          {formError ? (
            <p
              role="alert"
              className="rounded-sm border border-danger/35 bg-danger-soft px-3 py-2 text-xs text-danger"
            >
              {formError}
            </p>
          ) : null}

          <Field label="Title" required error={titleError}>
            {(control) => (
              <Input
                {...control}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
                maxLength={120}
                placeholder="Invoice line-item extractor"
              />
            )}
          </Field>

          <Field label="Description" hint="One line on what this prompt is for.">
            {(control) => (
              <Textarea
                {...control}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Folder">
              {(control) => (
                <Select
                  {...control}
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                  options={folderOptions(folders)}
                />
              )}
            </Field>

            <Field label="Status">
              {(control) => (
                <Select
                  {...control}
                  value={status}
                  onChange={(event) => setStatus(event.target.value as PromptStatus)}
                  options={STATUS_OPTIONS}
                />
              )}
            </Field>
          </div>

          {mode === 'create' ? (
            <Field
              label="Start from"
              hint={
                selectedTemplate?.description ??
                'A template fills the document with a working structure. Blank starts with the schema defaults.'
              }
            >
              {(control) => (
                <Select
                  {...control}
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                  options={[
                    { value: '', label: 'Blank prompt' },
                    ...templates.map((template) => ({
                      value: template.id,
                      label: `${template.name} · ${template.category}`,
                    })),
                  ]}
                />
              )}
            </Field>
          ) : null}

          {schemas.length > 0 ? (
            <Field label="JSON schema" hint="Used by the validation studio for structural checks.">
              {(control) => (
                <Select
                  {...control}
                  value={schemaId}
                  onChange={(event) => setSchemaId(event.target.value)}
                  options={[
                    { value: '', label: 'No schema' },
                    ...schemas.map((schema) => ({ value: schema.id, label: schema.name })),
                  ]}
                />
              )}
            </Field>
          ) : null}

          <Field label="Tags" hint="Comma separated. Tags are lowercased and de-duplicated.">
            {(control) => (
              <Input
                {...control}
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="finance, extraction"
                mono
              />
            )}
          </Field>

          {tags.length > 0 ? (
            <p className="-mt-1 flex flex-wrap gap-1.5 text-2xs text-ink-muted">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-pill border border-line bg-surface-2 px-2 py-0.5"
                >
                  #{tag}
                </span>
              ))}
              {hiddenTagCount > 0 ? <span>+{hiddenTagCount} more</span> : null}
            </p>
          ) : null}

          <fieldset className="min-w-0">
            <legend className="text-xs font-medium text-ink-secondary">Collections</legend>
            {collections.length === 0 ? (
              <p className="mt-1.5 text-xs text-ink-muted">
                No collections yet. Create one from the library rail to group prompts across
                folders.
              </p>
            ) : (
              <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto rounded-sm border border-line bg-surface-2 p-2">
                {collections.map((collection) => (
                  <Checkbox
                    key={collection.id}
                    id={`collection-${collection.id}`}
                    name={`collection-${collection.id}`}
                    checked={collectionIds.includes(collection.id)}
                    onCheckedChange={(checked) =>
                      setCollectionIds((current) =>
                        checked === true
                          ? [...new Set([...current, collection.id])]
                          : current.filter((id) => id !== collection.id),
                      )
                    }
                    label={collection.name}
                  />
                ))}
              </div>
            )}
          </fieldset>

          {mode === 'edit' ? (
            <p className="text-2xs leading-relaxed text-ink-muted">
              Favourites, pins, and archive live in the row menu, not here.
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
