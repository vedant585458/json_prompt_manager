import { useEffect, useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { checkTemplateName } from '@/domain/templates';
import { documentStats } from '@/domain/promptDocument';
import type { Prompt, PromptTemplate } from '@/domain/types';

export type TemplateDialogMode = 'from-prompt' | 'edit' | 'duplicate';

export interface TemplateDialogInput {
  /** Set in `from-prompt` mode: the prompt whose document is saved. */
  readonly promptId: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
}

export interface TemplateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: TemplateDialogMode;
  /** Source template for `edit` and `duplicate`. */
  readonly template?: PromptTemplate | null;
  /** Prompts offered in `from-prompt` mode. */
  readonly prompts: readonly Prompt[];
  /** Every stored template, for the duplicate-name check. */
  readonly templates: readonly PromptTemplate[];
  readonly onSave: (input: TemplateDialogInput) => Promise<void>;
}

const COPY = {
  'from-prompt': {
    title: 'Save a prompt as a template',
    description:
      'The template keeps a copy of the document. Later edits to the prompt do not change it, and using it never changes the prompt.',
    submit: 'Create template',
  },
  edit: {
    title: 'Edit template details',
    description:
      'Only the name, description, and category change. The document itself is fixed; duplicate the template to change its content.',
    submit: 'Save details',
  },
  duplicate: {
    title: 'Duplicate template',
    description: 'The copy is a custom template you can edit. The source stays exactly as it is.',
    submit: 'Create copy',
  },
} as const;

/**
 * Create, rename, or duplicate a template (TASK-018).
 *
 * One dialog for three operations because they share one rule set: a distinct
 * name, a description worth reading, and a category. The name check runs against
 * the live catalogue on every keystroke, so a duplicate is refused before the
 * write is attempted — and the store refuses it again with the same message.
 */
export function TemplateDialog({
  open,
  onOpenChange,
  mode,
  template = null,
  prompts,
  templates,
  onSave,
}: TemplateDialogProps) {
  const [promptId, setPromptId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPromptId(mode === 'from-prompt' ? (prompts[0]?.id ?? '') : '');
    setName(mode === 'from-prompt' ? '' : (template?.name ?? ''));
    setDescription(mode === 'from-prompt' ? '' : (template?.description ?? ''));
    setCategory(mode === 'from-prompt' ? '' : (template?.category ?? ''));
    setFailure(null);
    setSaving(false);
  }, [mode, open, prompts, template]);

  const selectedPrompt = prompts.find((prompt) => prompt.id === promptId) ?? null;
  const nameIssues = checkTemplateName(name, templates, {
    ...(mode === 'edit' && template ? { excludeId: template.id } : {}),
  });
  const nameError = nameIssues.find((issue) => issue.severity === 'error')?.message ?? null;
  const categoryError =
    category.trim().length === 0 ? 'Choose a category, for example “Extraction”.' : null;
  const promptError = mode === 'from-prompt' && !selectedPrompt ? 'Choose a prompt to save.' : null;
  const canSave = !saving && nameError === null && categoryError === null && promptError === null;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setFailure(null);
    try {
      await onSave({
        promptId,
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
      });
      onOpenChange(false);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The template could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const copy = COPY[mode];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={copy.title}
        description={copy.description}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={!canSave}>
              {copy.submit}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {mode === 'from-prompt' ? (
            prompts.length === 0 ? (
              <Alert tone="info" title="No prompts to save yet">
                <p className="text-xs leading-relaxed">
                  A template is made from a stored prompt. Create a prompt first, then come back to
                  save it here.
                </p>
              </Alert>
            ) : (
              <Field
                label="Prompt"
                required
                hint="The document is copied; snippet references are left out because they belong to that one prompt."
              >
                {(control) => (
                  <Select
                    {...control}
                    value={promptId}
                    onChange={(event) => setPromptId(event.target.value)}
                    options={prompts.map((prompt) => ({
                      value: prompt.id,
                      label: prompt.title,
                    }))}
                  />
                )}
              </Field>
            )
          ) : null}

          {mode === 'from-prompt' && selectedPrompt ? (
            <p className="rounded-md border border-line bg-surface-2 px-3 py-2 text-2xs leading-relaxed text-ink-secondary">
              “{selectedPrompt.title}” has {documentStats(selectedPrompt.content).instructions}{' '}
              instructions and {documentStats(selectedPrompt.content).variables} variables.
            </p>
          ) : null}

          <Field label="Name" required error={nameError ?? undefined}>
            {(control) => (
              <Input
                {...control}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Invoice extraction"
                autoComplete="off"
              />
            )}
          </Field>

          <Field label="Description" hint="One line about what this template is for.">
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Turn an invoice PDF into a fixed JSON shape."
              />
            )}
          </Field>

          <Field
            label="Category"
            required
            error={categoryError ?? undefined}
            hint="Categories group the catalogue. A new name creates a new group."
          >
            {(control) => (
              <Input
                {...control}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Extraction"
                autoComplete="off"
              />
            )}
          </Field>

          {failure ? (
            <p role="alert" className="text-xs text-danger">
              {failure}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
