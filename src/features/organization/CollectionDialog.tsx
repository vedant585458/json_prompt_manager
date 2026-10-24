import { useEffect, useState, type FormEvent } from 'react';

import { Button, Dialog, DialogContent, Field, Input, Textarea } from '@/components/ui';
import { RuleViolationError } from '@/domain/errors';
import type { Collection } from '@/domain/types';

export interface CollectionFormValues {
  readonly name: string;
  readonly description: string;
}

export interface CollectionDialogProps {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly collection?: Collection | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (values: CollectionFormValues) => Promise<void>;
}

/**
 * Create/rename collection dialog (TASK-012).
 *
 * A collection is a cross-folder grouping, so the form has only a name and a
 * description; membership is edited on the prompt itself. Names are unique
 * across the library, and the domain's message lands under the name field.
 */
export function CollectionDialog({
  open,
  mode,
  collection = null,
  onOpenChange,
  onSubmit,
}: CollectionDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;

    setName(collection?.name ?? '');
    setDescription(collection?.description ?? '');
    setNameError(undefined);
    setFormError(undefined);
    setPending(false);
  }, [open, collection]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      setNameError('Give the collection a name.');
      return;
    }

    setNameError(undefined);
    setFormError(undefined);
    setPending(true);

    try {
      await onSubmit({ name: trimmed, description: description.trim() });
      onOpenChange(false);
    } catch (error) {
      if (error instanceof RuleViolationError) {
        const nameIssue = error.issueFor('name');
        setNameError(nameIssue);
        // The field already explains itself; do not repeat it in the alert.
        if (nameIssue !== undefined) return;
      }
      setFormError(error instanceof Error ? error.message : 'The collection could not be saved.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent
        title={mode === 'create' ? 'New collection' : 'Collection settings'}
        description="Collections group prompts across folders. A prompt can belong to more than one."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" form="collection-form" loading={pending} loadingLabel="Saving">
              {mode === 'create' ? 'Create collection' : 'Save collection'}
            </Button>
          </>
        }
      >
        <form
          id="collection-form"
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
        >
          {formError ? (
            <p
              role="alert"
              className="rounded-sm border border-danger/35 bg-danger-soft px-3 py-2 text-xs text-danger"
            >
              {formError}
            </p>
          ) : null}

          <Field label="Name" required error={nameError}>
            {(control) => (
              <Input
                {...control}
                value={name}
                autoFocus
                maxLength={80}
                placeholder="Support replies"
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>

          <Field label="Description" hint="What belongs in this collection.">
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            )}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
